import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { PalworldConfigAudit } from '@gameops/shared';

type PalworldConfigAuditModule = {
  getPalworldConfigAudit: (serverId: string) => PalworldConfigAudit;
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

async function withFreshPalworldConfigAudit(run: (modules: {
  audit: PalworldConfigAuditModule;
  tempDir: string;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-palworld-config-audit-test-'));
  const previousConfigPath = process.env.GAMEOPS_CONFIG_PATH;
  const previousTelemetryPath = process.env.PALWORLD_TELEMETRY_STORE_PATH;

  process.env.GAMEOPS_CONFIG_PATH = join(tempDir, 'gameops.config.json');
  process.env.PALWORLD_TELEMETRY_STORE_PATH = join(tempDir, 'palworld-telemetry.json');

  try {
    const nonce = `${Date.now()}-${Math.random()}`;
    const servicePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/palworld-config-audit.ts')).href;
    const audit: PalworldConfigAuditModule = await import(`${servicePath}?t=${nonce}`);
    await run({ audit, tempDir });
  } finally {
    if (previousConfigPath === undefined) delete process.env.GAMEOPS_CONFIG_PATH;
    else process.env.GAMEOPS_CONFIG_PATH = previousConfigPath;

    if (previousTelemetryPath === undefined) delete process.env.PALWORLD_TELEMETRY_STORE_PATH;
    else process.env.PALWORLD_TELEMETRY_STORE_PATH = previousTelemetryPath;

    rmSync(tempDir, { recursive: true, force: true });
  }
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

function writeTelemetry(path: string, serverId: string, raw: Record<string, unknown>): void {
  writeFileSync(path, JSON.stringify({
    latestSettingsSnapshots: [{
      server_id: serverId,
      observed_at: '2026-06-22T12:00:00.000Z',
      raw_json: raw
    }]
  }, null, 2), 'utf8');
}

test('Palworld config audit reports no savePath or related config path', async () => {
  await withFreshPalworldConfigAudit(({ audit, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: 'palworld-no-path' }));

    const result = audit.getPalworldConfigAudit('palworld-no-path');

    assert.equal(result.discoveryStatus, 'no_config_path');
    assert.equal(result.selectedPath, null);
    assert.equal(result.parseStatus, 'not_attempted');
    assert.equal(result.fileEditViability, 'unknown');
  });
});

test('Palworld config audit reports candidate file not found', async () => {
  await withFreshPalworldConfigAudit(({ audit, tempDir }) => {
    const savePath = join(tempDir, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: 'palworld-not-found', savePath }));

    const result = audit.getPalworldConfigAudit('palworld-not-found');

    assert.equal(result.discoveryStatus, 'candidate_not_found');
    assert.equal(result.canReadFile, false);
    assert.equal(result.candidatePaths.some((path) => path.endsWith('Config/LinuxServer/PalWorldSettings.ini')), true);
  });
});

test('Palworld config audit parses fake PalWorldSettings.ini', async () => {
  await withFreshPalworldConfigAudit(({ audit, tempDir }) => {
    const savePath = join(tempDir, 'Pal', 'Saved');
    const configDir = join(savePath, 'Config', 'LinuxServer');
    mkdirSync(configDir, { recursive: true });
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: 'palworld-parseable', savePath }));
    writeFileSync(join(configDir, 'PalWorldSettings.ini'), [
      '[/Script/Pal.PalGameWorldSettings]',
      'OptionSettings=(Difficulty="None",ExpRate=2.000000,ServerName="Test Server",IsMultiplay=True)'
    ].join('\n'), 'utf8');

    const result = audit.getPalworldConfigAudit('palworld-parseable');

    assert.equal(result.discoveryStatus, 'found');
    assert.equal(result.canReadFile, true);
    assert.equal(result.parseStatus, 'parsed');
    assert.equal(result.parsedSettingCount, 4);
    assert.equal(result.unmatchedFileSettings.includes('ExpRate'), true);
    assert.equal(result.fileEditViability, 'unknown');
  });
});

test('Palworld config audit reports corrupt or unparseable settings file', async () => {
  await withFreshPalworldConfigAudit(({ audit, tempDir }) => {
    const savePath = join(tempDir, 'Pal', 'Saved');
    const configDir = join(savePath, 'Config', 'LinuxServer');
    mkdirSync(configDir, { recursive: true });
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: 'palworld-corrupt', savePath }));
    writeFileSync(join(configDir, 'PalWorldSettings.ini'), 'not an ini with settings', 'utf8');

    const result = audit.getPalworldConfigAudit('palworld-corrupt');

    assert.equal(result.discoveryStatus, 'found');
    assert.equal(result.canReadFile, true);
    assert.equal(result.parseStatus, 'failed');
    assert.equal(result.fileEditViability, 'not_viable');
  });
});

test('Palworld config audit compares parsed settings with latest REST snapshot', async () => {
  await withFreshPalworldConfigAudit(({ audit, tempDir }) => {
    const savePath = join(tempDir, 'Pal', 'Saved');
    const configDir = join(savePath, 'Config', 'LinuxServer');
    mkdirSync(configDir, { recursive: true });
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: 'palworld-compare', savePath }));
    writeTelemetry(join(tempDir, 'palworld-telemetry.json'), 'palworld-compare', {
      Difficulty: 'None',
      ExpRate: 3,
      DropItemRate: 1
    });
    writeFileSync(join(configDir, 'PalWorldSettings.ini'), [
      '[/Script/Pal.PalGameWorldSettings]',
      'OptionSettings=(Difficulty="None",ExpRate=2.000000,ServerName="Test Server")'
    ].join('\n'), 'utf8');

    const result = audit.getPalworldConfigAudit('palworld-compare');
    const difficulty = result.matchedRestSettings.find((setting) => setting.key === 'Difficulty');
    const expRate = result.matchedRestSettings.find((setting) => setting.key === 'ExpRate');

    assert.equal(result.parseStatus, 'parsed');
    assert.equal(difficulty?.valuesMatch, true);
    assert.equal(expRate?.valuesMatch, false);
    assert.equal(result.unmatchedFileSettings.includes('ServerName'), true);
    assert.equal(result.unmatchedRestSettings.includes('DropItemRate'), true);
    assert.equal(result.fileEditViability, 'unknown');
    assert.equal(result.safetyWarnings.some((warning) => /different values/.test(warning)), true);
  });
});
