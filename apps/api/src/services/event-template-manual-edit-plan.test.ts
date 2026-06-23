import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { EventTemplateDraftCatalog, EventTemplateManualEditPlan } from '@gameops/shared';

type PlanModule = {
  getEventTemplateManualEditPlan: (serverId: string, templateId: string) => EventTemplateManualEditPlan | null;
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

async function withFreshPlan(run: (modules: {
  plan: PlanModule;
  settings: SettingsModule;
  tempDir: string;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-event-template-manual-plan-test-'));
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
    const planPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/event-template-manual-edit-plan.ts')).href;
    const settingsPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/settings-capabilities.ts')).href;
    const plan: PlanModule = await import(`${planPath}?t=${nonce}`);
    const settings: SettingsModule = await import(`${settingsPath}?t=${nonce}`);
    await run({ plan, settings, tempDir });
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

test('manual edit plan is limited with exact changes when restart is unknown', async () => {
  await withFreshPlan(({ plan, settings, tempDir }) => {
    const serverId = 'palworld-manual-plan-limited';
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

    const result = plan.getEventTemplateManualEditPlan(serverId, 'xp-boost-event');

    assert.equal(result?.planStatus, 'limited');
    assert.equal(result?.exactChanges[0]?.key, 'ExpRate');
    assert.equal(result?.exactChanges[0]?.fromValue, 1);
    assert.equal(result?.exactChanges[0]?.toValue, 2);
    assert.equal(result?.canApply, false);
  });
});

test('manual edit plan is blocked when checklist is blocked', async () => {
  await withFreshPlan(({ plan, settings, tempDir }) => {
    const serverId = 'palworld-manual-plan-blocked';
    const savePath = join(tempDir, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: serverId, savePath }));
    writeTelemetry(join(tempDir, 'palworld-telemetry.json'), serverId, { ExpRate: 1 });
    settings.saveEventTemplateDraftCustomization({
      serverId,
      templateId: 'xp-boost-event',
      override: { targetMultiplier: 2 }
    });

    const result = plan.getEventTemplateManualEditPlan(serverId, 'xp-boost-event');

    assert.equal(result?.planStatus, 'blocked');
    assert.equal(result?.exactChanges.length, 0);
    assert.equal(result?.canApply, false);
  });
});

test('manual edit plan copyable text includes target path and key changes', async () => {
  await withFreshPlan(({ plan, settings, tempDir }) => {
    const serverId = 'palworld-manual-plan-copy';
    const workingDirectory = join(tempDir, 'pal1');
    const savePath = join(workingDirectory, 'Pal', 'Saved');
    const targetPath = join(savePath, 'Config', 'LinuxServer', 'PalWorldSettings.ini');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: serverId, savePath }));
    writeTelemetry(join(tempDir, 'palworld-telemetry.json'), serverId, { ExpRate: 1 });
    writePalworldSettings(savePath, 'OptionSettings=(ExpRate=1.000000)');
    writeSystemdService(join(tempDir, 'palworld.service'), workingDirectory);
    settings.saveEventTemplateDraftCustomization({
      serverId,
      templateId: 'xp-boost-event',
      override: { targetMultiplier: 2 }
    });

    const result = plan.getEventTemplateManualEditPlan(serverId, 'xp-boost-event');

    assert.match(result?.copyableText ?? '', new RegExp(targetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(result?.copyableText ?? '', /ExpRate: 1 -> 2/);
    assert.match(result?.copyableText ?? '', /GameOps will not change the server/);
    assert.equal(result?.canApply, false);
  });
});
