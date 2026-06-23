import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { EventTemplateConfigDiffPreview, EventTemplateDraftCatalog } from '@gameops/shared';

type PreviewModule = {
  getEventTemplateConfigDiffPreview: (serverId: string, templateId: string) => EventTemplateConfigDiffPreview | null;
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

async function withFreshPreview(run: (modules: {
  preview: PreviewModule;
  settings: SettingsModule;
  tempDir: string;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-event-template-config-diff-test-'));
  const previousConfigPath = process.env.GAMEOPS_CONFIG_PATH;
  const previousTelemetryPath = process.env.PALWORLD_TELEMETRY_STORE_PATH;
  const previousDraftStorePath = process.env.EVENT_TEMPLATE_DRAFT_STORE_PATH;

  process.env.GAMEOPS_CONFIG_PATH = join(tempDir, 'gameops.config.json');
  process.env.PALWORLD_TELEMETRY_STORE_PATH = join(tempDir, 'palworld-telemetry.json');
  process.env.EVENT_TEMPLATE_DRAFT_STORE_PATH = join(tempDir, 'event-template-drafts.json');

  try {
    const nonce = `${Date.now()}-${Math.random()}`;
    const previewPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/event-template-config-diff-preview.ts')).href;
    const settingsPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/settings-capabilities.ts')).href;
    const preview: PreviewModule = await import(`${previewPath}?t=${nonce}`);
    const settings: SettingsModule = await import(`${settingsPath}?t=${nonce}`);
    await run({ preview, settings, tempDir });
  } finally {
    if (previousConfigPath === undefined) delete process.env.GAMEOPS_CONFIG_PATH;
    else process.env.GAMEOPS_CONFIG_PATH = previousConfigPath;

    if (previousTelemetryPath === undefined) delete process.env.PALWORLD_TELEMETRY_STORE_PATH;
    else process.env.PALWORLD_TELEMETRY_STORE_PATH = previousTelemetryPath;

    if (previousDraftStorePath === undefined) delete process.env.EVENT_TEMPLATE_DRAFT_STORE_PATH;
    else process.env.EVENT_TEMPLATE_DRAFT_STORE_PATH = previousDraftStorePath;

    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('config diff preview is available when config file and draft target match', async () => {
  await withFreshPreview(({ preview, settings, tempDir }) => {
    const serverId = 'palworld-diff-available';
    const savePath = join(tempDir, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: serverId, savePath }));
    writeTelemetry(join(tempDir, 'palworld-telemetry.json'), serverId, { ExpRate: 1 });
    writePalworldSettings(savePath, 'OptionSettings=(ExpRate=1.000000)');
    settings.saveEventTemplateDraftCustomization({
      serverId,
      templateId: 'xp-boost-event',
      override: { targetMultiplier: 2 }
    });

    const result = preview.getEventTemplateConfigDiffPreview(serverId, 'xp-boost-event');

    assert.equal(result?.previewStatus, 'available');
    assert.equal(result?.changes[0]?.key, 'ExpRate');
    assert.equal(result?.changes[0]?.currentFileValue, 1);
    assert.equal(result?.changes[0]?.currentObservedValue, 1);
    assert.equal(result?.changes[0]?.proposedValue, 2);
    assert.equal(result?.canApply, false);
  });
});

test('config diff preview is unavailable when config file is missing', async () => {
  await withFreshPreview(({ preview, settings, tempDir }) => {
    const serverId = 'palworld-diff-missing-config';
    const savePath = join(tempDir, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: serverId, savePath }));
    writeTelemetry(join(tempDir, 'palworld-telemetry.json'), serverId, { ExpRate: 1 });
    settings.saveEventTemplateDraftCustomization({
      serverId,
      templateId: 'xp-boost-event',
      override: { targetMultiplier: 2 }
    });

    const result = preview.getEventTemplateConfigDiffPreview(serverId, 'xp-boost-event');

    assert.equal(result?.previewStatus, 'unavailable');
    assert.equal(result?.changes.length, 0);
    assert.equal(result?.canApply, false);
  });
});

test('config diff preview is limited when config file is missing matched key', async () => {
  await withFreshPreview(({ preview, settings, tempDir }) => {
    const serverId = 'palworld-diff-missing-key';
    const savePath = join(tempDir, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: serverId, savePath }));
    writeTelemetry(join(tempDir, 'palworld-telemetry.json'), serverId, { ExpRate: 1 });
    writePalworldSettings(savePath, 'OptionSettings=(DropItemRate=1.000000)');
    settings.saveEventTemplateDraftCustomization({
      serverId,
      templateId: 'xp-boost-event',
      override: { targetMultiplier: 2 }
    });

    const result = preview.getEventTemplateConfigDiffPreview(serverId, 'xp-boost-event');

    assert.equal(result?.previewStatus, 'limited');
    assert.equal(result?.missingKeys.includes('ExpRate'), true);
    assert.equal(result?.unmappedSettings.includes('ExpRate'), true);
    assert.equal(result?.canApply, false);
  });
});

test('config diff preview warns for non-numeric multiplier target', async () => {
  await withFreshPreview(({ preview, settings, tempDir }) => {
    const serverId = 'palworld-diff-nonnumeric';
    const savePath = join(tempDir, 'Pal', 'Saved');
    writeConfig(join(tempDir, 'gameops.config.json'), palworldRestServer({ id: serverId, savePath }));
    writeTelemetry(join(tempDir, 'palworld-telemetry.json'), serverId, { ExpRate: 'fast' });
    writePalworldSettings(savePath, 'OptionSettings=(ExpRate="fast")');
    settings.saveEventTemplateDraftCustomization({
      serverId,
      templateId: 'xp-boost-event',
      override: { targetMultiplier: 2 }
    });

    const result = preview.getEventTemplateConfigDiffPreview(serverId, 'xp-boost-event');

    assert.equal(result?.previewStatus, 'limited');
    assert.equal(result?.changes[0]?.proposedValue, null);
    assert.equal(result?.changes[0]?.warningNotes.some((note) => /numeric/.test(note)), true);
    assert.equal(result?.canApply, false);
  });
});
