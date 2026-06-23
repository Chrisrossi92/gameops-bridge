import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { PalworldBackupReadiness } from '@gameops/shared';

type BackupReadinessModule = {
  getPalworldBackupReadiness: (serverId: string) => PalworldBackupReadiness;
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

function settingsPath(savePath: string): string {
  return join(savePath, 'Config', 'LinuxServer', 'PalWorldSettings.ini');
}

function writePalworldSettings(savePath: string): void {
  const path = settingsPath(savePath);
  mkdirSync(join(savePath, 'Config', 'LinuxServer'), { recursive: true });
  writeFileSync(path, 'OptionSettings=(ExpRate=1.000000)', 'utf8');
}

async function withFreshBackupReadiness(run: (modules: {
  readiness: BackupReadinessModule;
  tempDir: string;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-palworld-backup-readiness-test-'));
  const previousConfigPath = process.env.GAMEOPS_CONFIG_PATH;
  const previousTelemetryPath = process.env.PALWORLD_TELEMETRY_STORE_PATH;
  const previousServicePath = process.env.PALWORLD_SYSTEMD_SERVICE_PATH;

  process.env.GAMEOPS_CONFIG_PATH = join(tempDir, 'gameops.config.json');
  process.env.PALWORLD_TELEMETRY_STORE_PATH = join(tempDir, 'palworld-telemetry.json');
  process.env.PALWORLD_SYSTEMD_SERVICE_PATH = join(tempDir, 'palworld.service');

  try {
    const nonce = `${Date.now()}-${Math.random()}`;
    const servicePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/palworld-backup-readiness.ts')).href;
    const readiness: BackupReadinessModule = await import(`${servicePath}?t=${nonce}`);
    await run({ readiness, tempDir });
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

test('Palworld backup readiness reports readable config file', async () => {
  await withFreshBackupReadiness(({ readiness, tempDir }) => {
    const savePath = join(tempDir, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: 'palworld-backup-ready', savePath }));
    writePalworldSettings(savePath);

    const result = readiness.getPalworldBackupReadiness('palworld-backup-ready');

    assert.equal(result.readinessStatus, 'ready_for_manual_backup_plan');
    assert.equal(result.filesToBackup[0]?.exists, true);
    assert.equal(result.filesToBackup[0]?.readable, true);
    assert.equal(result.proposedBackupDirectory, join(savePath, 'Config', 'LinuxServer', 'gameops-backups'));
    assert.equal(result.proposedBackupFilenamePattern, 'PalWorldSettings.ini.{timestamp}.bak');
    assert.equal(result.runtimeAlignmentStatus, 'unknown');
    assert.equal(result.canCreateBackup, false);
  });
});

test('Palworld backup readiness reports missing config file', async () => {
  await withFreshBackupReadiness(({ readiness, tempDir }) => {
    const savePath = join(tempDir, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: 'palworld-backup-missing', savePath }));

    const result = readiness.getPalworldBackupReadiness('palworld-backup-missing');

    assert.equal(result.readinessStatus, 'blocked_missing_config_file');
    assert.equal(result.filesToBackup.length > 0, true);
    assert.equal(result.filesToBackup.every((file) => file.exists === false), true);
    assert.equal(result.canCreateBackup, false);
  });
});

test('Palworld backup readiness reports unreadable selected path', async () => {
  await withFreshBackupReadiness(({ readiness, tempDir }) => {
    const savePath = join(tempDir, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: 'palworld-backup-unreadable', savePath }));
    mkdirSync(settingsPath(savePath), { recursive: true });

    const result = readiness.getPalworldBackupReadiness('palworld-backup-unreadable');

    assert.equal(result.readinessStatus, 'blocked_unreadable_file');
    assert.equal(result.filesToBackup[0]?.exists, true);
    assert.equal(result.filesToBackup[0]?.readable, false);
    assert.equal(result.canCreateBackup, false);
  });
});

test('Palworld backup readiness reports unknown when no savePath exists', async () => {
  await withFreshBackupReadiness(({ readiness, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: 'palworld-backup-no-path' }));

    const result = readiness.getPalworldBackupReadiness('palworld-backup-no-path');

    assert.equal(result.readinessStatus, 'unknown');
    assert.equal(result.filesToBackup.length, 0);
    assert.equal(result.proposedBackupDirectory, null);
    assert.equal(result.canCreateBackup, false);
  });
});
