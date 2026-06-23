import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { EventTemplateDraftCatalog, ObservedSettingsResponse, ServerSettingsCapabilitySummary } from '@gameops/shared';

type SettingsCapabilitiesModule = {
  getServerSettingsCapabilitySummary: (serverId: string) => ServerSettingsCapabilitySummary;
  getObservedServerSettings: (serverId: string) => ObservedSettingsResponse;
  getEventTemplateDraftCatalog: (serverId: string) => EventTemplateDraftCatalog;
  saveEventTemplateDraftCustomization: (input: {
    serverId: string;
    templateId: string;
    override: {
      enabledInDashboard?: boolean;
      displayName?: string | null;
      targetMultiplier?: number | null;
      targetValue?: string | number | boolean | null;
      durationHours?: number | null;
      notes?: string | null;
      scheduleLabel?: string | null;
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

async function withFreshSettingsCapabilities(run: (modules: {
  settings: SettingsCapabilitiesModule;
  tempDir: string;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-settings-capabilities-test-'));
  const previousConfigPath = process.env.GAMEOPS_CONFIG_PATH;
  const previousTelemetryPath = process.env.PALWORLD_TELEMETRY_STORE_PATH;
  const previousDraftStorePath = process.env.EVENT_TEMPLATE_DRAFT_STORE_PATH;

  process.env.GAMEOPS_CONFIG_PATH = join(tempDir, 'gameops.config.json');
  process.env.PALWORLD_TELEMETRY_STORE_PATH = join(tempDir, 'palworld-telemetry.json');
  process.env.EVENT_TEMPLATE_DRAFT_STORE_PATH = join(tempDir, 'event-template-drafts.json');

  try {
    const nonce = `${Date.now()}-${Math.random()}`;
    const servicePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/settings-capabilities.ts')).href;
    const settings: SettingsCapabilitiesModule = await import(`${servicePath}?t=${nonce}`);
    await run({ settings, tempDir });
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

test('reports unknown settings capability when config is unavailable', async () => {
  await withFreshSettingsCapabilities(({ settings }) => {
    const result = settings.getServerSettingsCapabilitySummary('missing-server');

    assert.equal(result.serverName, null);
    assert.equal(result.canReadSettings, 'unknown');
    assert.equal(result.readSource, 'unknown');
    assert.equal(result.canWriteSettings, 'no');
    assert.equal(result.writePathStatus, 'unknown');
    assert.deepEqual(result.candidateWritePaths, ['manual']);
    assert.equal(result.missingRequirements.includes('configured server entry'), true);
  });
});

test('reports Valheim journal mode as unknown settings capability', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'valheim-settings',
      displayName: 'Valheim Settings',
      game: 'valheim',
      connector: {
        mode: 'journal',
        journalServiceName: 'valheim.service'
      }
    });

    const result = settings.getServerSettingsCapabilitySummary('valheim-settings');

    assert.equal(result.game, 'valheim');
    assert.equal(result.connectorMode, 'journal');
    assert.equal(result.canReadSettings, 'unknown');
    assert.equal(result.canWriteSettings, 'no');
    assert.equal(result.writePathStatus, 'not_supported');
    assert.deepEqual(result.candidateWritePaths, ['manual']);
    assert.equal(result.missingRequirements.includes('settings parser'), true);
  });
});

test('reports Palworld REST settings snapshot as readable', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-settings',
      displayName: 'Palworld Settings',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-settings',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: {
          Difficulty: 'Normal',
          ExpRate: 2,
          PalEggDefaultHatchingTime: 1,
          ServerPassword: 'hidden',
          UnmappedFutureSetting: true
        }
      }]
    }, null, 2), 'utf8');

    const result = settings.getServerSettingsCapabilitySummary('palworld-settings');

    assert.equal(result.canReadSettings, 'yes');
    assert.equal(result.readSource, 'Palworld REST');
    assert.equal(result.lastSettingsSnapshotAt, '2026-06-22T12:00:00.000Z');
    assert.equal(result.canWriteSettings, 'no');
    assert.equal(result.writePathStatus, 'possible_needs_validation');
    assert.deepEqual(result.candidateWritePaths, ['manual', 'rest']);
    assert.equal(result.validationSteps.some((step) => /official Palworld settings update endpoint/.test(step)), true);
    assert.equal(result.rollbackRequirements.some((requirement) => /Backup/.test(requirement)), true);
    assert.equal(result.unresolvedQuestions.some((question) => /REST exposes/.test(question)), true);
    assert.equal(result.supportedSettingGroups.includes('difficulty'), true);
    assert.equal(result.supportedSettingGroups.includes('rates'), true);
    assert.equal(result.supportedSettingGroups.includes('egg/incubation'), true);
    assert.equal(result.supportedSettingGroups.includes('whitelist/access'), true);
    assert.equal(result.supportedSettingGroups.includes('unknown/unmapped'), true);
  });
});

test('reports Palworld RCON mode as a candidate write path but not supported', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-rcon-settings',
      displayName: 'Palworld RCON Settings',
      game: 'palworld',
      connector: {
        mode: 'rcon',
        rconHost: '127.0.0.1',
        rconPort: 25575,
        rconPassword: 'secret',
        savePath: './Pal/Saved'
      }
    });

    const result = settings.getServerSettingsCapabilitySummary('palworld-rcon-settings');

    assert.equal(result.canReadSettings, 'no');
    assert.equal(result.canWriteSettings, 'no');
    assert.equal(result.writePathStatus, 'possible_needs_validation');
    assert.deepEqual(result.candidateWritePaths, ['manual', 'rcon', 'file_edit']);
    assert.equal(result.unresolvedQuestions.some((question) => /RCON can change persistent settings/.test(question)), true);
  });
});

test('classifies rate settings as gameplay template candidates', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-risk-rate',
      displayName: 'Palworld Risk Rate',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-risk-rate',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { ExpRate: 2 }
      }]
    }, null, 2), 'utf8');

    const setting = settings.getObservedServerSettings('palworld-risk-rate').groups[0]?.settings[0];

    assert.equal(setting?.changeRisk, 'gameplay_balance');
    assert.equal(setting?.recommendedHandling, 'template_candidate');
  });
});

test('classifies password auth settings as dangerous never auto-change', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-risk-access',
      displayName: 'Palworld Risk Access',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-risk-access',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { AdminPassword: 'super-secret' }
      }]
    }, null, 2), 'utf8');

    const setting = settings.getObservedServerSettings('palworld-risk-access').groups[0]?.settings[0];

    assert.equal(setting?.value, '********');
    assert.equal(setting?.changeRisk, 'dangerous_access_related');
    assert.equal(setting?.recommendedHandling, 'never_auto_change');
  });
});

test('classifies difficulty and world settings as manual review restart risk', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-risk-world',
      displayName: 'Palworld Risk World',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-risk-world',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { Difficulty: 'Hard', EnemySpawnRate: 2 }
      }]
    }, null, 2), 'utf8');

    const returned = settings.getObservedServerSettings('palworld-risk-world').groups.flatMap((group) => group.settings);

    assert.equal(returned.find((setting) => setting.key === 'Difficulty')?.changeRisk, 'likely_restart_required');
    assert.equal(returned.find((setting) => setting.key === 'Difficulty')?.recommendedHandling, 'manual_review');
    assert.equal(returned.find((setting) => setting.key === 'EnemySpawnRate')?.changeRisk, 'likely_restart_required');
  });
});

test('reports Palworld REST without snapshot as pending readable source', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-no-snapshot',
      displayName: 'Palworld No Snapshot',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });

    const result = settings.getServerSettingsCapabilitySummary('palworld-no-snapshot');

    assert.equal(result.canReadSettings, 'unknown');
    assert.equal(result.readSource, 'Palworld REST');
    assert.equal(result.lastSettingsSnapshotAt, null);
    assert.equal(result.supportedSettingGroups.length, 0);
    assert.equal(result.missingRequirements.includes('settings snapshot'), true);
  });
});

test('reports unsupported Palworld connector mode as unavailable', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-file-settings',
      displayName: 'Palworld File Settings',
      game: 'palworld',
      connector: {
        mode: 'file',
        logPath: '/var/log/palworld.log'
      }
    });

    const result = settings.getServerSettingsCapabilitySummary('palworld-file-settings');

    assert.equal(result.game, 'palworld');
    assert.equal(result.connectorMode, 'file');
    assert.equal(result.canReadSettings, 'no');
    assert.equal(result.readSource, 'unavailable');
    assert.equal(result.missingRequirements.includes('readable settings source'), true);
  });
});

test('missing REST credentials fail closed as no usable config', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeFileSync(join(tempDir, 'gameops.config.json'), JSON.stringify(baseConfig({
      id: 'palworld-missing-credentials',
      displayName: 'Palworld Missing Credentials',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPath: '/v1/api'
      }
    }), null, 2), 'utf8');

    const result = settings.getServerSettingsCapabilitySummary('palworld-missing-credentials');

    assert.equal(result.canReadSettings, 'unknown');
    assert.equal(result.canWriteSettings, 'no');
    assert.equal(result.missingRequirements.includes('configured server entry'), true);
  });
});

test('returns observed Palworld REST settings grouped by safe categories', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-observed-settings',
      displayName: 'Palworld Observed Settings',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-observed-settings',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: {
          Difficulty: 'Normal',
          ExpRate: 2,
          PalEggDefaultHatchingTime: 1,
          EnemySpawnRate: 1.5,
          ServerPassword: 'hidden',
          FutureSetting: true
        }
      }]
    }, null, 2), 'utf8');

    const result = settings.getObservedServerSettings('palworld-observed-settings');

    assert.equal(result.available, true);
    assert.equal(result.snapshotAt, '2026-06-22T12:00:00.000Z');
    assert.equal(result.groups.some((group) => group.group === 'difficulty'), true);
    assert.equal(result.groups.some((group) => group.group === 'rates'), true);
    assert.equal(result.groups.some((group) => group.group === 'egg/incubation'), true);
    assert.equal(result.groups.some((group) => group.group === 'spawn/world'), true);
    assert.equal(result.groups.some((group) => group.group === 'whitelist/access'), true);
  });
});

test('masks sensitive observed settings before returning them', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-sensitive-settings',
      displayName: 'Palworld Sensitive Settings',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-sensitive-settings',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: {
          AdminPassword: 'super-secret',
          ApiToken: 'token-value',
          SafeContainer: {
            NestedSecret: 'nested-secret',
            VisibleValue: 'ok'
          },
          PublicPort: 8211
        }
      }]
    }, null, 2), 'utf8');

    const result = settings.getObservedServerSettings('palworld-sensitive-settings');
    const returnedSettings = result.groups.flatMap((group) => group.settings);
    const adminPassword = returnedSettings.find((setting) => setting.key === 'AdminPassword');
    const apiToken = returnedSettings.find((setting) => setting.key === 'ApiToken');

    assert.equal(adminPassword?.value, '********');
    assert.equal(adminPassword?.sensitive, true);
    assert.equal(apiToken?.value, '********');
    assert.equal(JSON.stringify(result).includes('nested-secret'), false);
    assert.equal(JSON.stringify(result).includes('super-secret'), false);
    assert.equal(JSON.stringify(result).includes('token-value'), false);
  });
});

test('groups unknown observed settings as unknown unmapped', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-unknown-settings',
      displayName: 'Palworld Unknown Settings',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-unknown-settings',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: {
          CompletelyNewSetting: 123
        }
      }]
    }, null, 2), 'utf8');

    const result = settings.getObservedServerSettings('palworld-unknown-settings');

    assert.equal(result.groups.length, 1);
    assert.equal(result.groups[0]?.group, 'unknown/unmapped');
    assert.equal(result.groups[0]?.settings[0]?.label, 'Completely New Setting');
    assert.equal(result.groups[0]?.settings[0]?.changeRisk, 'unknown');
    assert.equal(result.groups[0]?.settings[0]?.recommendedHandling, 'unknown');
  });
});

test('observed settings returns clear empty state without snapshot', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-observed-empty',
      displayName: 'Palworld Observed Empty',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });

    const result = settings.getObservedServerSettings('palworld-observed-empty');

    assert.equal(result.available, false);
    assert.equal(result.source, 'Palworld REST');
    assert.equal(result.snapshotAt, null);
    assert.match(result.emptyState ?? '', /No Palworld settings snapshot/);
  });
});

test('observed settings returns unavailable for unsupported game or mode', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'valheim-observed-settings',
      displayName: 'Valheim Observed Settings',
      game: 'valheim',
      connector: {
        mode: 'journal',
        journalServiceName: 'valheim.service'
      }
    });

    const result = settings.getObservedServerSettings('valheim-observed-settings');

    assert.equal(result.available, false);
    assert.equal(result.game, 'valheim');
    assert.equal(result.groups.length, 0);
    assert.match(result.emptyState ?? '', /unavailable/i);
  });
});

test('XP template appears when XP rate fields exist', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-template-xp',
      displayName: 'Palworld Template XP',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-template-xp',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { ExpRate: 2 }
      }]
    }, null, 2), 'utf8');

    const catalog = settings.getEventTemplateDraftCatalog('palworld-template-xp');
    const xpDraft = catalog.drafts.find((draft) => draft.templateId === 'xp-boost-event');

    assert.equal(catalog.status, 'available');
    assert.equal(xpDraft?.name, 'XP Boost Event');
    assert.equal(xpDraft?.matchedSettings[0]?.key, 'ExpRate');
    assert.equal(xpDraft?.canApply, false);
  });
});

test('Egg template appears when incubation or egg fields exist', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-template-egg',
      displayName: 'Palworld Template Egg',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-template-egg',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { PalEggDefaultHatchingTime: 1 }
      }]
    }, null, 2), 'utf8');

    const catalog = settings.getEventTemplateDraftCatalog('palworld-template-egg');
    const eggDraft = catalog.drafts.find((draft) => draft.templateId === 'egg-hatch-incubation-event');

    assert.equal(eggDraft?.name, 'Egg Hatch / Incubation Event');
    assert.equal(eggDraft?.matchedSettings[0]?.key, 'PalEggDefaultHatchingTime');
    assert.equal(eggDraft?.canApply, false);
  });
});

test('unknown unmapped settings do not create event template drafts', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-template-unknown',
      displayName: 'Palworld Template Unknown',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-template-unknown',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { CompletelyNewSetting: true }
      }]
    }, null, 2), 'utf8');

    const catalog = settings.getEventTemplateDraftCatalog('palworld-template-unknown');

    assert.equal(catalog.status, 'empty');
    assert.deepEqual(catalog.drafts, []);
  });
});

test('no settings snapshot returns empty event template draft state', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-template-empty',
      displayName: 'Palworld Template Empty',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });

    const catalog = settings.getEventTemplateDraftCatalog('palworld-template-empty');

    assert.equal(catalog.status, 'empty');
    assert.equal(catalog.drafts.length, 0);
    assert.match(catalog.explanation, /No Palworld settings snapshot/);
  });
});

test('all event template drafts are disabled previews', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-template-disabled',
      displayName: 'Palworld Template Disabled',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-template-disabled',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: {
          ExpRate: 2,
          DropItemRate: 2,
          CollectionDropRate: 2,
          CaptureRate: 1.5
        }
      }]
    }, null, 2), 'utf8');

    const catalog = settings.getEventTemplateDraftCatalog('palworld-template-disabled');

    assert.equal(catalog.drafts.some((draft) => draft.templateId === 'weekend-catch-up-event'), true);
    assert.equal(catalog.drafts.length > 0, true);
    assert.equal(catalog.drafts.every((draft) => draft.status === 'draft_only'), true);
    assert.equal(catalog.drafts.every((draft) => draft.canApply === false), true);
    assert.equal(catalog.drafts.every((draft) => /read-only drafts|Apply support/.test(draft.reasonApplyDisabled)), true);
  });
});

test('generated event template drafts appear without saved overrides', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-template-generated',
      displayName: 'Palworld Template Generated',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-template-generated',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { ExpRate: 2 }
      }]
    }, null, 2), 'utf8');

    const draft = settings.getEventTemplateDraftCatalog('palworld-template-generated').drafts[0];

    assert.equal(draft?.templateId, 'xp-boost-event');
    assert.equal(draft?.enabledInDashboard, true);
    assert.equal(draft?.displayName, null);
    assert.equal(draft?.updatedAt, null);
  });
});

test('saved event template draft overrides merge into generated drafts', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-template-override',
      displayName: 'Palworld Template Override',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-template-override',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { ExpRate: 2 }
      }]
    }, null, 2), 'utf8');

    const saved = settings.saveEventTemplateDraftCustomization({
      serverId: 'palworld-template-override',
      templateId: 'xp-boost-event',
      override: {
        enabledInDashboard: false,
        displayName: 'Double XP Night',
        targetMultiplier: 2,
        durationHours: 6,
        notes: 'Friday test',
        scheduleLabel: 'Friday evening'
      }
    });
    const draft = saved?.drafts.find((candidate) => candidate.templateId === 'xp-boost-event');

    assert.equal(draft?.enabledInDashboard, false);
    assert.equal(draft?.displayName, 'Double XP Night');
    assert.equal(draft?.targetMultiplier, 2);
    assert.equal(draft?.durationHours, 6);
    assert.equal(draft?.notes, 'Friday test');
    assert.equal(draft?.scheduleLabel, 'Friday evening');
    assert.equal(typeof draft?.updatedAt, 'string');
  });
});

test('unknown event template draft cannot be saved', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-template-unknown-save',
      displayName: 'Palworld Template Unknown Save',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-template-unknown-save',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { ExpRate: 2 }
      }]
    }, null, 2), 'utf8');

    const saved = settings.saveEventTemplateDraftCustomization({
      serverId: 'palworld-template-unknown-save',
      templateId: 'not-a-template',
      override: { displayName: 'Nope' }
    });

    assert.equal(saved, null);
  });
});

test('event template draft canApply remains false after customization', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-template-safe-disabled',
      displayName: 'Palworld Template Safe Disabled',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-template-safe-disabled',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { ExpRate: 2 }
      }]
    }, null, 2), 'utf8');

    const catalog = settings.saveEventTemplateDraftCustomization({
      serverId: 'palworld-template-safe-disabled',
      templateId: 'xp-boost-event',
      override: { targetMultiplier: 3 }
    });
    const draft = catalog?.drafts.find((candidate) => candidate.templateId === 'xp-boost-event');

    assert.equal(draft?.status, 'draft_only');
    assert.equal(draft?.canApply, false);
    assert.match(draft?.reasonApplyDisabled ?? '', /No write path/);
  });
});

test('event template draft returns numeric multiplier change preview', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-template-preview-multiplier',
      displayName: 'Palworld Template Preview Multiplier',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-template-preview-multiplier',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { ExpRate: 1 }
      }]
    }, null, 2), 'utf8');

    const catalog = settings.saveEventTemplateDraftCustomization({
      serverId: 'palworld-template-preview-multiplier',
      templateId: 'xp-boost-event',
      override: { targetMultiplier: 2 }
    });
    const preview = catalog?.drafts.find((candidate) => candidate.templateId === 'xp-boost-event')?.changePreviews[0];

    assert.equal(preview?.settingKey, 'ExpRate');
    assert.equal(preview?.currentValue, 1);
    assert.equal(preview?.proposedValue, 2);
    assert.equal(preview?.canPreview, true);
    assert.match(preview?.differenceLabel ?? '', /from 1x to 2x/);
  });
});

test('event template draft returns target value change preview', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-template-preview-value',
      displayName: 'Palworld Template Preview Value',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-template-preview-value',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { ExpRate: 1 }
      }]
    }, null, 2), 'utf8');

    const catalog = settings.saveEventTemplateDraftCustomization({
      serverId: 'palworld-template-preview-value',
      templateId: 'xp-boost-event',
      override: { targetValue: 3 }
    });
    const preview = catalog?.drafts.find((candidate) => candidate.templateId === 'xp-boost-event')?.changePreviews[0];

    assert.equal(preview?.proposedValue, 3);
    assert.equal(preview?.proposedLabel, '3');
    assert.equal(preview?.canPreview, true);
    assert.match(preview?.differenceLabel ?? '', /from 1 to 3/);
  });
});

test('event template draft warns when observed value is missing', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-template-preview-missing',
      displayName: 'Palworld Template Preview Missing',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-template-preview-missing',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { ExpRate: null }
      }]
    }, null, 2), 'utf8');

    const catalog = settings.saveEventTemplateDraftCustomization({
      serverId: 'palworld-template-preview-missing',
      templateId: 'xp-boost-event',
      override: { targetValue: 2 }
    });
    const preview = catalog?.drafts.find((candidate) => candidate.templateId === 'xp-boost-event')?.changePreviews[0];

    assert.equal(preview?.canPreview, false);
    assert.equal(preview?.proposedValue, 2);
    assert.equal(preview?.previewWarnings.includes('Current observed value is missing.'), true);
  });
});

test('event template draft warns when observed value is non-numeric for multiplier preview', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-template-preview-nonnumeric',
      displayName: 'Palworld Template Preview Nonnumeric',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-template-preview-nonnumeric',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { ExpRate: 'fast' }
      }]
    }, null, 2), 'utf8');

    const catalog = settings.saveEventTemplateDraftCustomization({
      serverId: 'palworld-template-preview-nonnumeric',
      templateId: 'xp-boost-event',
      override: { targetMultiplier: 2 }
    });
    const preview = catalog?.drafts.find((candidate) => candidate.templateId === 'xp-boost-event')?.changePreviews[0];

    assert.equal(preview?.canPreview, false);
    assert.equal(preview?.proposedValue, null);
    assert.equal(preview?.previewWarnings.includes('Current observed value is not numeric, so multiplier preview is limited.'), true);
  });
});

test('event template draft store handles missing and corrupt JSON safely', async () => {
  await withFreshSettingsCapabilities(({ settings, tempDir }) => {
    writeConfig(join(tempDir, 'gameops.config.json'), {
      id: 'palworld-template-corrupt-store',
      displayName: 'Palworld Template Corrupt Store',
      game: 'palworld',
      connector: {
        mode: 'rest',
        restHost: '127.0.0.1',
        restPort: 8212,
        restUsername: 'admin',
        restPassword: 'secret',
        restPath: '/v1/api'
      }
    });
    writeFileSync(join(tempDir, 'palworld-telemetry.json'), JSON.stringify({
      latestSettingsSnapshots: [{
        server_id: 'palworld-template-corrupt-store',
        observed_at: '2026-06-22T12:00:00.000Z',
        raw_json: { ExpRate: 2 }
      }]
    }, null, 2), 'utf8');

    assert.equal(settings.getEventTemplateDraftCatalog('palworld-template-corrupt-store').drafts[0]?.displayName, null);
    writeFileSync(join(tempDir, 'event-template-drafts.json'), '{bad json', 'utf8');
    assert.equal(settings.getEventTemplateDraftCatalog('palworld-template-corrupt-store').drafts[0]?.templateId, 'xp-boost-event');
  });
});
