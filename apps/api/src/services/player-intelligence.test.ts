import { mkdtempSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { NormalizedEvent, PlayerIntelligenceResponse } from '@gameops/shared';

type EventStoreModule = {
  addEvents: (events: NormalizedEvent[]) => void;
  resetSessionStateForTests: () => void;
};

type LogTruthStoreModule = {
  resetLogTruthStoreForTests: () => void;
};

type RollupStoreModule = {
  resetPlayerIntelligenceRollupStoreForTests: () => void;
};

type PlayerIntelligenceModule = {
  getPlayerIntelligenceForServer: (serverId: string) => PlayerIntelligenceResponse;
};

function createEvent(overrides: Partial<NormalizedEvent>): NormalizedEvent {
  return {
    game: 'valheim',
    serverId: 'srv-1',
    occurredAt: '2026-06-10T12:00:00.000Z',
    eventType: 'HEALTH_WARN',
    ...overrides
  };
}

async function withFreshPlayerIntelligence(run: (modules: {
  store: EventStoreModule;
  intelligence: PlayerIntelligenceModule;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-player-intelligence-test-'));
  const previousSessionPath = process.env.SESSION_STATE_STORE_PATH;
  const previousLogTruthPath = process.env.LOG_TRUTH_STORE_PATH;
  const previousKnownPath = process.env.KNOWN_PLAYER_STORE_PATH;
  const previousTelemetryPath = process.env.PALWORLD_TELEMETRY_STORE_PATH;
  const previousPlayersSummaryPath = process.env.PALWORLD_PLAYERS_SUMMARY_PATH;
  const previousPlayerIntelligencePath = process.env.PLAYER_INTELLIGENCE_STORE_PATH;
  const previousPlayerEngagementPath = process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;

  process.env.SESSION_STATE_STORE_PATH = join(tempDir, 'session-state.json');
  process.env.LOG_TRUTH_STORE_PATH = join(tempDir, 'log-truth.json');
  process.env.KNOWN_PLAYER_STORE_PATH = join(tempDir, 'known-players.json');
  process.env.PALWORLD_TELEMETRY_STORE_PATH = join(tempDir, 'palworld-telemetry.json');
  process.env.PALWORLD_PLAYERS_SUMMARY_PATH = join(tempDir, 'players-summary.json');
  process.env.PLAYER_INTELLIGENCE_STORE_PATH = join(tempDir, 'player-intelligence-state.json');
  process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = join(tempDir, 'player-engagement-rollups.json');

  try {
    const eventStorePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/event-store.js')).href;
    const logTruthPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/log-truth-store.js')).href;
    const rollupPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/player-intelligence-rollup-store.js')).href;
    const intelligencePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/player-intelligence.js')).href;
    const store: EventStoreModule = await import(eventStorePath);
    const logTruth: LogTruthStoreModule = await import(logTruthPath);
    const rollups: RollupStoreModule = await import(rollupPath);
    logTruth.resetLogTruthStoreForTests();
    store.resetSessionStateForTests();
    rollups.resetPlayerIntelligenceRollupStoreForTests();
    const intelligence: PlayerIntelligenceModule = await import(intelligencePath);
    await run({ store, intelligence });
  } finally {
    if (previousSessionPath === undefined) {
      delete process.env.SESSION_STATE_STORE_PATH;
    } else {
      process.env.SESSION_STATE_STORE_PATH = previousSessionPath;
    }

    if (previousLogTruthPath === undefined) {
      delete process.env.LOG_TRUTH_STORE_PATH;
    } else {
      process.env.LOG_TRUTH_STORE_PATH = previousLogTruthPath;
    }

    if (previousKnownPath === undefined) {
      delete process.env.KNOWN_PLAYER_STORE_PATH;
    } else {
      process.env.KNOWN_PLAYER_STORE_PATH = previousKnownPath;
    }

    if (previousTelemetryPath === undefined) {
      delete process.env.PALWORLD_TELEMETRY_STORE_PATH;
    } else {
      process.env.PALWORLD_TELEMETRY_STORE_PATH = previousTelemetryPath;
    }

    if (previousPlayersSummaryPath === undefined) {
      delete process.env.PALWORLD_PLAYERS_SUMMARY_PATH;
    } else {
      process.env.PALWORLD_PLAYERS_SUMMARY_PATH = previousPlayersSummaryPath;
    }

    if (previousPlayerIntelligencePath === undefined) {
      delete process.env.PLAYER_INTELLIGENCE_STORE_PATH;
    } else {
      process.env.PLAYER_INTELLIGENCE_STORE_PATH = previousPlayerIntelligencePath;
    }

    if (previousPlayerEngagementPath === undefined) {
      delete process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
    } else {
      process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = previousPlayerEngagementPath;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('returns owner-readable empty player intelligence on first run', async () => {
  await withFreshPlayerIntelligence(({ intelligence }) => {
    const result = intelligence.getPlayerIntelligenceForServer('srv-1');

    assert.equal(result.serverId, 'srv-1');
    assert.equal(result.players.length, 0);
    assert.equal(result.explanation, 'No players observed yet. Start the connector and wait for join/leave activity.');
  });
});

test('rolls closed sessions into player intelligence', async () => {
  await withFreshPlayerIntelligence(({ store, intelligence }) => {
    store.addEvents([
      createEvent({
        eventType: 'PLAYER_JOIN',
        playerName: 'Kriatiri',
        occurredAt: '2026-06-10T12:00:00.000Z'
      }),
      createEvent({
        eventType: 'PLAYER_LEAVE',
        playerName: 'Kriatiri',
        occurredAt: '2026-06-10T12:45:00.000Z'
      })
    ]);

    const result = intelligence.getPlayerIntelligenceForServer('srv-1');
    const player = result.players[0];

    assert.equal(result.players.length, 1);
    assert.equal(player?.displayName, 'Kriatiri');
    assert.equal(player?.isOnline, false);
    assert.equal(player?.totalTrackedSeconds, 2700);
    assert.equal(player?.sessionCount, 1);
    assert.equal(player?.averageSessionSeconds, 2700);
    assert.equal(player?.identityConfidence, 'high');
    assert.equal(player?.lastSeenAt, '2026-06-10T12:45:00.000Z');
  });
});

test('merges stored rollup with live active session state', async () => {
  await withFreshPlayerIntelligence(async ({ store, intelligence }) => {
    store.addEvents([
      createEvent({
        serverId: 'srv-live',
        eventType: 'PLAYER_JOIN',
        playerName: 'Mira',
        occurredAt: '2026-06-10T10:00:00.000Z'
      }),
      createEvent({
        serverId: 'srv-live',
        eventType: 'PLAYER_LEAVE',
        playerName: 'Mira',
        occurredAt: '2026-06-10T10:30:00.000Z'
      }),
      createEvent({
        serverId: 'srv-live',
        eventType: 'PLAYER_JOIN',
        playerName: 'Mira',
        occurredAt: '2026-06-10T11:00:00.000Z'
      })
    ]);

    const result = intelligence.getPlayerIntelligenceForServer('srv-live');
    const player = result.players[0];

    assert.equal(result.players.length, 1);
    assert.equal(player?.displayName, 'Mira');
    assert.equal(player?.isOnline, true);
    assert.equal(player?.totalTrackedSeconds, 1800);
    assert.equal(player?.sessionCount, 1);
    assert.equal(player?.sourceSummary.includes('stored rollup'), true);
    assert.equal(player?.sourceSummary.includes('active session'), true);
  });
});
