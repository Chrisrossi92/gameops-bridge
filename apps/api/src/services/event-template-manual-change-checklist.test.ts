import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { EventTemplateDraftCatalog, EventTemplateManualChangeChecklist } from '@gameops/shared';

type ChecklistModule = {
  getEventTemplateManualChangeChecklist: (serverId: string, templateId: string) => EventTemplateManualChangeChecklist | null;
};

type SettingsModule = {
  saveEventTemplateDraftCustomization: (input: {
    serverId: string;
    templateId: string;
    override: {
      targetMultiplier?: number | null;
      targetValue?: string | number | boolean | null;
    };
  }) => EventTemplateDraftCatalog | null;
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

function writeTelemetry(path: string, serverId: string, raw: Record<string, unknown>): void {
  writeFileSync(path, JSON.stringify({
    latestSettingsSnapshots: [{
      server_id: serverId,
      observed_at: '2026-06-22T12:00:00.000Z',
      raw_json: raw
    }]
  }, null, 2), 'utf8');
}

function writePalworldSettings(savePath: string, settingsLine: string): void {
  const configDir = join(savePath, 'Config', 'LinuxServer');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, 'PalWorldSettings.ini'), [
    '[/Script/Pal.PalGameWorldSettings]',
    settingsLine
  ].join('\n'), 'utf8');
}

function writeSystemdService(path: string, workingDirectory: string): void {
  writeFileSync(path, [
    '[Service]',
    `WorkingDirectory=${workingDirectory}`,
    'ExecStart=/opt/steamcmd/palserver PalServer.sh'
  ].join('\n'), 'utf8');
}

function activeConfigPath(workingDirectory: string): string {
  return join(workingDirectory, 'Pal', 'Saved', 'Config', 'LinuxServer', 'PalWorldSettings.ini');
}

async function withFreshChecklist(run: (modules: {
  checklist: ChecklistModule;
  settings: SettingsModule;
  tempDir: string;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-event-template-checklist-test-'));
  const previousConfigPath = process.env.GAMEOPS_CONFIG_PATH;
  const previousTelemetryPath = process.env.PALWORLD_TELEMETRY_STORE_PATH;
  const previousDraftStorePath = process.env.EVENT_TEMPLATE_DRAFT_STORE_PATH;
  const previousServicePath = process.env.PALWORLD_SYSTEMD_SERVICE_PATH;

  process.env.GAMEOPS_CONFIG_PATH = join(tempDir, 'gameops.config.json');
  process.env.PALWORLD_TELEMETRY_STORE_PATH = join(tempDir, 'palworld-telemetry.json');
  process.env.EVENT_TEMPLATE_DRAFT_STORE_PATH = join(tempDir, 'event-template-drafts.json');
  process.env.PALWORLD_SYSTEMD_SERVICE_PATH = join(tempDir, 'palworld.service');

  try {
    const nonce = `${Date.now()}-${Math.random()}`;
    const checklistPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/event-template-manual-change-checklist.ts')).href;
    const settingsPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/settings-capabilities.ts')).href;
    const checklist: ChecklistModule = await import(`${checklistPath}?t=${nonce}`);
    const settings: SettingsModule = await import(`${settingsPath}?t=${nonce}`);
    await run({ checklist, settings, tempDir });
  } finally {
    if (previousConfigPath === undefined) delete process.env.GAMEOPS_CONFIG_PATH;
    else process.env.GAMEOPS_CONFIG_PATH = previousConfigPath;

    if (previousTelemetryPath === undefined) delete process.env.PALWORLD_TELEMETRY_STORE_PATH;
    else process.env.PALWORLD_TELEMETRY_STORE_PATH = previousTelemetryPath;

    if (previousDraftStorePath === undefined) delete process.env.EVENT_TEMPLATE_DRAFT_STORE_PATH;
    else process.env.EVENT_TEMPLATE_DRAFT_STORE_PATH = previousDraftStorePath;

    if (previousServicePath === undefined) delete process.env.PALWORLD_SYSTEMD_SERVICE_PATH;
    else process.env.PALWORLD_SYSTEMD_SERVICE_PATH = previousServicePath;

    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('manual change checklist is ready with config diff and backup readiness', async () => {
  await withFreshChecklist(({ checklist, settings, tempDir }) => {
    const serverId = 'palworld-checklist-ready';
    const savePath = join(tempDir, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: serverId, savePath }));
    writeTelemetry(join(tempDir, 'palworld-telemetry.json'), serverId, { ExpRate: 1 });
    writePalworldSettings(savePath, 'OptionSettings=(ExpRate=1.000000)');
    settings.saveEventTemplateDraftCustomization({
      serverId,
      templateId: 'xp-boost-event',
      override: { targetMultiplier: 2 }
    });

    const result = checklist.getEventTemplateManualChangeChecklist(serverId, 'xp-boost-event');

    assert.equal(result?.checklistStatus, 'limited');
    assert.equal(result?.checklistItems.some((item) => item.label === 'Config diff' && item.status === 'pass'), true);
    assert.equal(result?.checklistItems.some((item) => item.label === 'Backup plan' && item.status === 'pass'), true);
    assert.equal(result?.checklistItems.some((item) => item.label === 'Active runtime config identified' && item.status === 'warning'), true);
    assert.equal(result?.checklistItems.some((item) => item.label === 'Draft targets active server config' && item.status === 'warning'), true);
    assert.equal(result?.canApply, false);
  });
});

test('manual change checklist passes runtime alignment when active config matches discovery path', async () => {
  await withFreshChecklist(({ checklist, settings, tempDir }) => {
    const serverId = 'palworld-checklist-runtime-match';
    const workingDirectory = join(tempDir, 'pal1');
    const savePath = join(workingDirectory, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: serverId, savePath }));
    writeTelemetry(join(tempDir, 'palworld-telemetry.json'), serverId, { ExpRate: 1 });
    writePalworldSettings(savePath, 'OptionSettings=(ExpRate=1.000000)');
    writeSystemdService(join(tempDir, 'palworld.service'), workingDirectory);
    settings.saveEventTemplateDraftCustomization({
      serverId,
      templateId: 'xp-boost-event',
      override: { targetMultiplier: 2 }
    });

    const result = checklist.getEventTemplateManualChangeChecklist(serverId, 'xp-boost-event');

    assert.equal(result?.checklistItems.some((item) => item.label === 'Active runtime config identified' && item.status === 'pass'), true);
    assert.equal(result?.checklistItems.some((item) => item.label === 'Draft targets active server config' && item.status === 'pass' && item.detail.includes(activeConfigPath(workingDirectory))), true);
    assert.equal(result?.checklistItems.some((item) => item.label === 'Runtime/config audit path match' && item.status === 'pass'), true);
    assert.equal(result?.canApply, false);
  });
});

test('manual change checklist blocks when active config mismatches discovery path', async () => {
  await withFreshChecklist(({ checklist, settings, tempDir }) => {
    const serverId = 'palworld-checklist-runtime-mismatch';
    const workingDirectory = join(tempDir, 'pal1');
    const savePath = join(tempDir, 'pal2', 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: serverId, savePath }));
    writeTelemetry(join(tempDir, 'palworld-telemetry.json'), serverId, { ExpRate: 1 });
    writePalworldSettings(savePath, 'OptionSettings=(ExpRate=1.000000)');
    writePalworldSettings(join(workingDirectory, 'Pal', 'Saved'), 'OptionSettings=(ExpRate=1.000000)');
    writeSystemdService(join(tempDir, 'palworld.service'), workingDirectory);
    settings.saveEventTemplateDraftCustomization({
      serverId,
      templateId: 'xp-boost-event',
      override: { targetMultiplier: 2 }
    });

    const result = checklist.getEventTemplateManualChangeChecklist(serverId, 'xp-boost-event');

    assert.equal(result?.checklistStatus, 'blocked');
    assert.equal(result?.checklistItems.some((item) => item.label === 'Draft targets active server config' && item.status === 'blocked'), true);
    assert.equal(result?.checklistItems.some((item) => item.label === 'Runtime/config audit path match' && item.status === 'blocked'), true);
    assert.equal(result?.canApply, false);
  });
});

test('manual change checklist is blocked when no config file exists', async () => {
  await withFreshChecklist(({ checklist, settings, tempDir }) => {
    const serverId = 'palworld-checklist-no-config';
    const savePath = join(tempDir, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: serverId, savePath }));
    writeTelemetry(join(tempDir, 'palworld-telemetry.json'), serverId, { ExpRate: 1 });
    settings.saveEventTemplateDraftCustomization({
      serverId,
      templateId: 'xp-boost-event',
      override: { targetMultiplier: 2 }
    });

    const result = checklist.getEventTemplateManualChangeChecklist(serverId, 'xp-boost-event');

    assert.equal(result?.checklistStatus, 'blocked');
    assert.equal(result?.checklistItems.some((item) => item.label === 'Config file' && item.status === 'blocked'), true);
    assert.equal(result?.canApply, false);
  });
});

test('manual change checklist is limited when restart requirement is unknown', async () => {
  await withFreshChecklist(({ checklist, settings, tempDir }) => {
    const serverId = 'palworld-checklist-restart-unknown';
    const savePath = join(tempDir, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: serverId, savePath }));
    writeTelemetry(join(tempDir, 'palworld-telemetry.json'), serverId, { ExpRate: 1 });
    writePalworldSettings(savePath, 'OptionSettings=(ExpRate=1.000000)');
    settings.saveEventTemplateDraftCustomization({
      serverId,
      templateId: 'xp-boost-event',
      override: { targetMultiplier: 2 }
    });

    const result = checklist.getEventTemplateManualChangeChecklist(serverId, 'xp-boost-event');

    assert.equal(result?.checklistStatus, 'limited');
    assert.equal(result?.checklistItems.some((item) => item.label === 'Restart requirement' && item.status === 'warning'), true);
    assert.equal(result?.canApply, false);
  });
});

test('manual change checklist is blocked when draft has no target value', async () => {
  await withFreshChecklist(({ checklist, tempDir }) => {
    const serverId = 'palworld-checklist-no-target';
    const savePath = join(tempDir, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: serverId, savePath }));
    writeTelemetry(join(tempDir, 'palworld-telemetry.json'), serverId, { ExpRate: 1 });
    writePalworldSettings(savePath, 'OptionSettings=(ExpRate=1.000000)');

    const result = checklist.getEventTemplateManualChangeChecklist(serverId, 'xp-boost-event');

    assert.equal(result?.checklistStatus, 'blocked');
    assert.equal(result?.checklistItems.some((item) => item.label === 'Draft target' && item.status === 'blocked'), true);
    assert.equal(result?.canApply, false);
  });
});
