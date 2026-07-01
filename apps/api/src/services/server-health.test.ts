import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { CollectorHealth, NormalizedEvent, ServerHealthSummary } from '@gameops/shared';

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
    collectors?: CollectorHealth[];
  }) => void;
};

type ServerHealthModule = {
  getServerHealthSummary: (serverId: string, now?: Date) => ServerHealthSummary;
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

async function withServerHealth(run: (modules: {
  store: EventStoreModule;
  heartbeat: HeartbeatModule;
  serverHealth: ServerHealthModule;
  tempDir: string;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-server-health-test-'));
  const previousSessionPath = process.env.SESSION_STATE_STORE_PATH;
  const previousKnownPath = process.env.KNOWN_PLAYER_STORE_PATH;
  const previousTelemetryPath = process.env.PALWORLD_TELEMETRY_STORE_PATH;
  const previousPlayersSummaryPath = process.env.PALWORLD_PLAYERS_SUMMARY_PATH;
  const previousPlayerIntelligencePath = process.env.PLAYER_INTELLIGENCE_STORE_PATH;
  const previousPlayerEngagementPath = process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
  const previousLogTruthPath = process.env.LOG_TRUTH_STORE_PATH;
  const previousConfigPath = process.env.GAMEOPS_CONFIG_PATH;

  process.env.SESSION_STATE_STORE_PATH = join(tempDir, 'session-state.json');
  process.env.KNOWN_PLAYER_STORE_PATH = join(tempDir, 'known-players.json');
  process.env.PALWORLD_TELEMETRY_STORE_PATH = join(tempDir, 'palworld-telemetry.json');
  process.env.PALWORLD_PLAYERS_SUMMARY_PATH = join(tempDir, 'players-summary.json');
  process.env.PLAYER_INTELLIGENCE_STORE_PATH = join(tempDir, 'player-intelligence-state.json');
  process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = join(tempDir, 'player-engagement-rollups.json');
  process.env.LOG_TRUTH_STORE_PATH = join(tempDir, 'log-truth.json');
  process.env.GAMEOPS_CONFIG_PATH = join(tempDir, 'gameops.config.json');

  try {
    const nonce = `${Date.now()}-${Math.random()}`;
    const storePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/event-store.ts')).href;
    const heartbeatPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/connector-heartbeat.ts')).href;
    const serverHealthPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/server-health.ts')).href;
    const store: EventStoreModule = await import(storePath);
    const heartbeat: HeartbeatModule = await import(heartbeatPath);
    const serverHealth: ServerHealthModule = await import(`${serverHealthPath}?t=${nonce}`);
    heartbeat.clearConnectorHeartbeatsForTests();
    await run({ store, heartbeat, serverHealth, tempDir });
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

    if (previousLogTruthPath === undefined) delete process.env.LOG_TRUTH_STORE_PATH;
    else process.env.LOG_TRUTH_STORE_PATH = previousLogTruthPath;

    if (previousConfigPath === undefined) delete process.env.GAMEOPS_CONFIG_PATH;
    else process.env.GAMEOPS_CONFIG_PATH = previousConfigPath;

    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('server health summarizes a healthy server', async () => {
  await withServerHealth(({ store, heartbeat, serverHealth, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'health-ok');
    heartbeat.recordConnectorHeartbeat({
      serverId: 'health-ok',
      game: 'valheim',
      connectorMode: 'journal',
      observedAt: '2026-06-11T12:00:00.000Z',
      status: 'running',
      message: 'Journal stream is active.',
      lastSuccessfulPollAt: '2026-06-11T12:00:00.000Z',
      collectors: [{
        collectorId: 'valheim',
        name: 'Valheim Collector Shadow',
        game: 'valheim',
        enabled: true,
        lastSuccessfulCollectionAt: '2026-06-11T12:00:00.000Z',
        lastError: null,
        lastCollectionDurationMs: 10,
        totalEventsEmitted: 2
      }]
    });
    store.addEvents([
      createEvent('health-ok', {
        id: 'health-ok-join',
        eventType: 'PLAYER_JOIN',
        playerName: 'Mira',
        occurredAt: '2026-06-11T12:00:01.000Z'
      }),
      createEvent('health-ok', {
        id: 'health-ok-world-save',
        eventType: 'HEALTH_WARN',
        message: 'World saved',
        occurredAt: '2026-06-11T12:00:02.000Z',
        raw: { valheimEventCategory: 'world_saved' }
      })
    ]);

    const result = serverHealth.getServerHealthSummary('health-ok', new Date('2026-06-11T12:00:08.000Z'));

    assert.equal(result.status, 'healthy');
    assert.equal(result.currentPlayers, 1);
    assert.equal(result.uniquePlayersThisWeek, 1);
    assert.equal(result.lastWorldSaveAt, '2026-06-11T12:00:02.000Z');
    assert.equal(result.collectorHealth.status, 'healthy');
    assert.equal(result.logTruthHealth?.status, 'healthy');
    assert.match(result.headline, /Healthy/);
  });
});

test('server health warns for an inactive server', async () => {
  await withServerHealth(({ serverHealth, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'health-inactive');

    const result = serverHealth.getServerHealthSummary('health-inactive', new Date('2026-06-11T12:00:08.000Z'));

    assert.equal(result.status, 'warning');
    assert.equal(result.currentPlayers, 0);
    assert.equal(result.uniquePlayersThisWeek, 0);
    assert.equal(result.telemetry.status, 'not_started');
    assert.equal(result.recommendedAction, 'Check connector status');
  });
});

test('server health reports unhealthy collector', async () => {
  await withServerHealth(({ heartbeat, serverHealth, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'health-bad-collector');
    heartbeat.recordConnectorHeartbeat({
      serverId: 'health-bad-collector',
      game: 'valheim',
      connectorMode: 'journal',
      observedAt: '2026-06-11T12:00:00.000Z',
      status: 'running',
      message: 'Journal stream is active.',
      collectors: [{
        collectorId: 'valheim',
        name: 'Valheim Collector Shadow',
        game: 'valheim',
        enabled: true,
        lastSuccessfulCollectionAt: null,
        lastError: 'journal read failed',
        lastCollectionDurationMs: null,
        totalEventsEmitted: 0
      }]
    });

    const result = serverHealth.getServerHealthSummary('health-bad-collector', new Date('2026-06-11T12:00:08.000Z'));

    assert.equal(result.status, 'unhealthy');
    assert.equal(result.collectorHealth.unhealthyCollectors, 1);
    assert.match(result.explanation, /collector issue/);
    assert.equal(result.recommendedAction, 'Check collector logs and heartbeat payloads');
  });
});

test('server health warns for stale telemetry with active sessions', async () => {
  await withServerHealth(({ store, heartbeat, serverHealth, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'health-stale');
    heartbeat.recordConnectorHeartbeat({
      serverId: 'health-stale',
      game: 'valheim',
      connectorMode: 'journal',
      observedAt: '2026-06-11T12:00:00.000Z',
      status: 'running',
      message: 'Journal stream is active.'
    });
    store.addEvents([
      createEvent('health-stale', {
        id: 'health-stale-join',
        eventType: 'PLAYER_JOIN',
        playerName: 'Iris',
        occurredAt: '2026-06-11T12:00:05.000Z'
      })
    ]);

    const result = serverHealth.getServerHealthSummary('health-stale', new Date('2026-06-11T12:02:00.000Z'));

    assert.equal(result.status, 'warning');
    assert.equal(result.telemetry.connectorStatus, 'stale');
    assert.equal(result.sessionHealth.stale, true);
    assert.equal(result.sessionHealth.status, 'warning');
    assert.match(result.explanation, /stale/i);
  });
});

test('server health reports unhealthy log truth storage', async () => {
  await withServerHealth(({ store, serverHealth, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'health-log-truth');
    const badPath = join(tempDir, 'log-truth-dir');
    mkdirSync(badPath);
    process.env.LOG_TRUTH_STORE_PATH = badPath;
    store.addEvents([
      createEvent('health-log-truth', {
        id: 'health-log-truth-event',
        eventType: 'SERVER_ONLINE',
        occurredAt: '2026-06-11T12:00:01.000Z'
      })
    ]);

    const result = serverHealth.getServerHealthSummary('health-log-truth', new Date('2026-06-11T12:00:08.000Z'));

    assert.equal(result.status, 'unhealthy');
    assert.equal(result.logTruthHealth?.status, 'unhealthy');
    assert.equal(result.recommendedAction, 'Check log truth storage');
  });
});
