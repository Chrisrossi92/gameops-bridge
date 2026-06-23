import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { DataFreshnessResponse, NormalizedEvent, SessionRecord } from '@gameops/shared';

type EventStoreModule = {
  addEvents: (events: NormalizedEvent[]) => void;
};

type HeartbeatModule = {
  clearConnectorHeartbeatsForTests: () => void;
  recordConnectorHeartbeat: (input: {
    serverId: string;
    game: 'valheim' | 'palworld';
    connectorMode: 'journal' | 'rest';
    observedAt: string;
    status: 'running' | 'degraded' | 'error';
    message: string;
    lastSuccessfulPollAt?: string;
    consecutiveFailureCount?: number;
    capabilities?: string[];
  }) => void;
};

type RollupStoreModule = {
  recordClosedSessionRollup: (input: { game: 'valheim' | 'palworld'; session: SessionRecord }) => boolean;
};

type FreshnessModule = {
  getDataFreshnessForServer: (serverId: string, now?: Date) => DataFreshnessResponse;
};

function createConfig(path: string, serverId: string, game: 'valheim' | 'palworld' = 'valheim'): void {
  writeFileSync(path, JSON.stringify({
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
    servers: [
      game === 'palworld'
        ? {
            id: serverId,
            displayName: serverId,
            game,
            connector: {
              mode: 'rest',
              restHost: '127.0.0.1',
              restPort: 8212,
              restUsername: 'admin',
              restPassword: 'secret'
            }
          }
        : {
            id: serverId,
            displayName: serverId,
            game,
            connector: {
              mode: 'journal',
              journalServiceName: 'valheim.service'
            }
          }
    ],
    featureFlags: {
      dashboardEnabled: true,
      botEnabled: true,
      connectorEnabled: true,
      identityResolutionEnabled: true,
      sessionReconciliationEnabled: true
    }
  }, null, 2), 'utf8');
}

function createEvent(serverId: string, overrides: Partial<NormalizedEvent>): NormalizedEvent {
  return {
    game: 'valheim',
    serverId,
    occurredAt: '2026-06-11T12:00:00.000Z',
    eventType: 'HEALTH_WARN',
    ...overrides
  };
}

function createClosedSession(serverId: string): SessionRecord {
  return {
    serverId,
    playerName: 'Kriatiri',
    startedAt: '2026-06-11T12:00:00.000Z',
    endedAt: '2026-06-11T12:45:00.000Z',
    durationSeconds: 2700,
    closeReason: 'player_leave',
    startConfidence: 'high',
    endConfidence: 'high',
    sourceEventIds: ['join-1', 'leave-1']
  };
}

async function withFreshness(run: (modules: {
  store: EventStoreModule;
  heartbeat: HeartbeatModule;
  rollups: RollupStoreModule;
  freshness: FreshnessModule;
  tempDir: string;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-data-freshness-test-'));
  const previousSessionPath = process.env.SESSION_STATE_STORE_PATH;
  const previousKnownPath = process.env.KNOWN_PLAYER_STORE_PATH;
  const previousTelemetryPath = process.env.PALWORLD_TELEMETRY_STORE_PATH;
  const previousPlayersSummaryPath = process.env.PALWORLD_PLAYERS_SUMMARY_PATH;
  const previousPlayerIntelligencePath = process.env.PLAYER_INTELLIGENCE_STORE_PATH;
  const previousPlayerEngagementPath = process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
  const previousConfigPath = process.env.GAMEOPS_CONFIG_PATH;

  process.env.SESSION_STATE_STORE_PATH = join(tempDir, 'session-state.json');
  process.env.KNOWN_PLAYER_STORE_PATH = join(tempDir, 'known-players.json');
  process.env.PALWORLD_TELEMETRY_STORE_PATH = join(tempDir, 'palworld-telemetry.json');
  process.env.PALWORLD_PLAYERS_SUMMARY_PATH = join(tempDir, 'players-summary.json');
  process.env.PLAYER_INTELLIGENCE_STORE_PATH = join(tempDir, 'player-intelligence-state.json');
  process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = join(tempDir, 'player-engagement-rollups.json');
  process.env.GAMEOPS_CONFIG_PATH = join(tempDir, 'gameops.config.json');

  try {
    const nonce = `${Date.now()}-${Math.random()}`;
    const storePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/event-store.ts')).href;
    const heartbeatPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/connector-heartbeat.ts')).href;
    const rollupPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/player-intelligence-rollup-store.ts')).href;
    const freshnessPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/data-freshness.ts')).href;
    const store: EventStoreModule = await import(storePath);
    const heartbeat: HeartbeatModule = await import(heartbeatPath);
    const rollups: RollupStoreModule = await import(rollupPath);
    const freshness: FreshnessModule = await import(`${freshnessPath}?t=${nonce}`);
    heartbeat.clearConnectorHeartbeatsForTests();
    await run({ store, heartbeat, rollups, freshness, tempDir });
  } finally {
    if (previousSessionPath === undefined) delete process.env.SESSION_STATE_STORE_PATH;
    else process.env.SESSION_STATE_STORE_PATH = previousSessionPath;

    if (previousKnownPath === undefined) delete process.env.KNOWN_PLAYER_STORE_PATH;
    else process.env.KNOWN_PLAYER_STORE_PATH = previousKnownPath;

    if (previousTelemetryPath === undefined) delete process.env.PALWORLD_TELEMETRY_STORE_PATH;
    else process.env.PALWORLD_TELEMETRY_STORE_PATH = previousTelemetryPath;

    if (previousPlayersSummaryPath === undefined) delete process.env.PALWORLD_PLAYERS_SUMMARY_PATH;
    else process.env.PALWORLD_PLAYERS_SUMMARY_PATH = previousPlayersSummaryPath;

    if (previousPlayerIntelligencePath === undefined) delete process.env.PLAYER_INTELLIGENCE_STORE_PATH;
    else process.env.PLAYER_INTELLIGENCE_STORE_PATH = previousPlayerIntelligencePath;

    if (previousPlayerEngagementPath === undefined) delete process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
    else process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = previousPlayerEngagementPath;

    if (previousConfigPath === undefined) delete process.env.GAMEOPS_CONFIG_PATH;
    else process.env.GAMEOPS_CONFIG_PATH = previousConfigPath;

    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('no heartbeat and no data returns not_started', async () => {
  await withFreshness(({ freshness, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'fresh-none');

    const result = freshness.getDataFreshnessForServer('fresh-none', new Date('2026-06-11T12:00:00.000Z'));

    assert.equal(result.status, 'not_started');
    assert.equal(result.recommendedAction, 'Start the connector');
    assert.equal(result.trustWarnings.includes('Connector has not reported yet'), true);
  });
});

test('recent heartbeat returns live', async () => {
  await withFreshness(({ heartbeat, freshness, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'fresh-live');
    heartbeat.recordConnectorHeartbeat({
      serverId: 'fresh-live',
      game: 'valheim',
      connectorMode: 'journal',
      observedAt: '2026-06-11T12:00:00.000Z',
      status: 'running',
      message: 'Journal stream is active.',
      lastSuccessfulPollAt: '2026-06-11T12:00:00.000Z',
      capabilities: ['log_stream']
    });

    const result = freshness.getDataFreshnessForServer('fresh-live', new Date('2026-06-11T12:00:08.000Z'));

    assert.equal(result.status, 'live');
    assert.equal(result.confidence, 'high');
    assert.equal(result.heartbeatAgeSeconds, 8);
  });
});

test('stale heartbeat with stored players returns historical', async () => {
  await withFreshness(({ heartbeat, rollups, freshness, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'fresh-historical');
    heartbeat.recordConnectorHeartbeat({
      serverId: 'fresh-historical',
      game: 'valheim',
      connectorMode: 'journal',
      observedAt: '2026-06-11T12:00:00.000Z',
      status: 'running',
      message: 'Journal stream is active.',
      capabilities: ['log_stream']
    });
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('fresh-historical')
    });

    const result = freshness.getDataFreshnessForServer('fresh-historical', new Date('2026-06-11T12:02:00.000Z'));

    assert.equal(result.status, 'historical');
    assert.equal(result.confidence, 'medium');
    assert.equal(result.trustWarnings.includes('Showing stored player history'), true);
  });
});

test('stale heartbeat with active sessions returns stale warning', async () => {
  await withFreshness(({ store, heartbeat, freshness, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'fresh-stale-active');
    heartbeat.recordConnectorHeartbeat({
      serverId: 'fresh-stale-active',
      game: 'valheim',
      connectorMode: 'journal',
      observedAt: '2026-06-11T12:00:00.000Z',
      status: 'running',
      message: 'Journal stream is active.',
      capabilities: ['log_stream']
    });
    store.addEvents([
      createEvent('fresh-stale-active', {
        eventType: 'PLAYER_JOIN',
        playerName: 'Mira',
        occurredAt: '2026-06-11T12:00:05.000Z'
      })
    ]);

    const result = freshness.getDataFreshnessForServer('fresh-stale-active', new Date('2026-06-11T12:02:00.000Z'));

    assert.equal(result.status, 'stale');
    assert.equal(result.trustWarnings.includes('Session state may be outdated'), true);
  });
});

test('connector error returns error summary', async () => {
  await withFreshness(({ heartbeat, freshness, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'fresh-error', 'palworld');
    heartbeat.recordConnectorHeartbeat({
      serverId: 'fresh-error',
      game: 'palworld',
      connectorMode: 'rest',
      observedAt: '2026-06-11T12:00:00.000Z',
      status: 'error',
      message: 'Palworld REST poll failed.',
      consecutiveFailureCount: 3,
      capabilities: ['players', 'metrics']
    });

    const result = freshness.getDataFreshnessForServer('fresh-error', new Date('2026-06-11T12:00:05.000Z'));

    assert.equal(result.status, 'error');
    assert.equal(result.headline, 'Connector error');
    assert.equal(result.recommendedAction, 'Check Palworld REST credentials');
  });
});
