import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { PalworldRuntimeAudit } from '@gameops/shared';

type RuntimeAuditModule = {
  getPalworldRuntimeAudit: (serverId: string) => PalworldRuntimeAudit;
};

function baseConfig(server: Record<string, unknown>): Record<string, unknown> {
  return {
    version: 1,
    workspace: {
      workspaceId: 'test',
      workspaceName: 'Test',
      ownerName: 'Test Owner',
      hostingMode: 'self_hosted',
      timezone: 'UTC'
    },
    api: {
      baseUrl: 'http://localhost:3001',
      port: 3001
    },
    discord: {
      enabled: false
    },
    servers: [server],
    featureFlags: {
      dashboardEnabled: true,
      botEnabled: true,
      connectorEnabled: true,
      identityResolutionEnabled: true,
      sessionReconciliationEnabled: true
    }
  };
}

function writeConfig(path: string, server: Record<string, unknown>): void {
  writeFileSync(path, JSON.stringify(baseConfig(server), null, 2), 'utf8');
}

function palworldRestServer(input: { id: string; savePath?: string }): Record<string, unknown> {
  return {
    id: input.id,
    displayName: input.id,
    game: 'palworld',
    connector: {
      mode: 'rest',
      restHost: '127.0.0.1',
      restPort: 8212,
      restUsername: 'admin',
      restPassword: 'secret',
      restPath: '/v1/api',
      ...(input.savePath ? { savePath: input.savePath } : {})
    }
  };
}

function activeConfigPath(workingDirectory: string): string {
  return join(workingDirectory, 'Pal', 'Saved', 'Config', 'LinuxServer', 'PalWorldSettings.ini');
}

function writeActiveConfig(workingDirectory: string): void {
  const path = activeConfigPath(workingDirectory);
  mkdirSync(join(workingDirectory, 'Pal', 'Saved', 'Config', 'LinuxServer'), { recursive: true });
  writeFileSync(path, 'OptionSettings=(ExpRate=1.000000)', 'utf8');
}

async function withFreshRuntimeAudit(run: (modules: {
  audit: RuntimeAuditModule;
  tempDir: string;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-palworld-runtime-audit-test-'));
  const previousConfigPath = process.env.GAMEOPS_CONFIG_PATH;
  const previousTelemetryPath = process.env.PALWORLD_TELEMETRY_STORE_PATH;
  const previousServicePath = process.env.PALWORLD_SYSTEMD_SERVICE_PATH;

  process.env.GAMEOPS_CONFIG_PATH = join(tempDir, 'gameops.config.json');
  process.env.PALWORLD_TELEMETRY_STORE_PATH = join(tempDir, 'palworld-telemetry.json');
  process.env.PALWORLD_SYSTEMD_SERVICE_PATH = join(tempDir, 'palworld.service');

  try {
    const nonce = `${Date.now()}-${Math.random()}`;
    const servicePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/palworld-runtime-audit.ts')).href;
    const audit: RuntimeAuditModule = await import(`${servicePath}?t=${nonce}`);
    await run({ audit, tempDir });
  } finally {
    if (previousConfigPath === undefined) delete process.env.GAMEOPS_CONFIG_PATH;
    else process.env.GAMEOPS_CONFIG_PATH = previousConfigPath;

    if (previousTelemetryPath === undefined) delete process.env.PALWORLD_TELEMETRY_STORE_PATH;
    else process.env.PALWORLD_TELEMETRY_STORE_PATH = previousTelemetryPath;

    if (previousServicePath === undefined) delete process.env.PALWORLD_SYSTEMD_SERVICE_PATH;
    else process.env.PALWORLD_SYSTEMD_SERVICE_PATH = previousServicePath;

    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('Palworld runtime audit parses systemd WorkingDirectory', async () => {
  await withFreshRuntimeAudit(({ audit, tempDir }) => {
    const workingDirectory = join(tempDir, 'pal1');
    const savePath = join(workingDirectory, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: 'palworld-runtime-match', savePath }));
    writeActiveConfig(workingDirectory);
    writeFileSync(join(tempDir, 'palworld.service'), [
      '[Service]',
      `WorkingDirectory=${workingDirectory}`,
      'ExecStart=/opt/steamcmd/palserver PalServer.sh'
    ].join('\n'), 'utf8');

    const result = audit.getPalworldRuntimeAudit('palworld-runtime-match');

    assert.equal(result.serviceReadable, true);
    assert.equal(result.workingDirectory, workingDirectory);
    assert.equal(result.inferredActiveConfigPath, activeConfigPath(workingDirectory));
    assert.equal(result.pathsMatch, true);
    assert.equal(result.runtimeAuditStatus, 'matched_active_config');
  });
});

test('Palworld runtime audit reports missing service file', async () => {
  await withFreshRuntimeAudit(({ audit, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: 'palworld-runtime-missing' }));

    const result = audit.getPalworldRuntimeAudit('palworld-runtime-missing');

    assert.equal(result.serviceReadable, false);
    assert.equal(result.runtimeAuditStatus, 'missing_systemd_service');
  });
});

test('Palworld runtime audit reports mismatched configured savePath', async () => {
  await withFreshRuntimeAudit(({ audit, tempDir }) => {
    const workingDirectory = join(tempDir, 'pal1');
    const wrongSavePath = join(tempDir, 'pal2', 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: 'palworld-runtime-mismatch', savePath: wrongSavePath }));
    writeActiveConfig(workingDirectory);
    mkdirSync(join(wrongSavePath, 'Config', 'LinuxServer'), { recursive: true });
    writeFileSync(join(wrongSavePath, 'Config', 'LinuxServer', 'PalWorldSettings.ini'), 'OptionSettings=(ExpRate=1.000000)', 'utf8');
    writeFileSync(join(tempDir, 'palworld.service'), [
      '[Service]',
      `WorkingDirectory=${workingDirectory}`,
      'ExecStart=/opt/steamcmd/palserver PalServer.sh'
    ].join('\n'), 'utf8');

    const result = audit.getPalworldRuntimeAudit('palworld-runtime-mismatch');

    assert.equal(result.pathsMatch, false);
    assert.equal(result.runtimeAuditStatus, 'mismatched_config');
    assert.match(result.summary, /Warning: active Palworld config appears/);
  });
});

test('Palworld runtime audit reports unreadable active config', async () => {
  await withFreshRuntimeAudit(({ audit, tempDir }) => {
    const workingDirectory = join(tempDir, 'pal1');
    const savePath = join(workingDirectory, 'Pal', 'Saved');
    const configPath = activeConfigPath(workingDirectory);
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: 'palworld-runtime-unreadable', savePath }));
    mkdirSync(configPath, { recursive: true });
    writeFileSync(join(tempDir, 'palworld.service'), [
      '[Service]',
      `WorkingDirectory=${workingDirectory}`,
      'ExecStart=/opt/steamcmd/palserver PalServer.sh'
    ].join('\n'), 'utf8');

    const result = audit.getPalworldRuntimeAudit('palworld-runtime-unreadable');

    assert.equal(result.pathsMatch, true);
    assert.equal(result.inferredActiveConfigExists, true);
    assert.equal(result.inferredActiveConfigReadable, false);
    assert.equal(result.runtimeAuditStatus, 'active_config_unreadable');
  });
});
