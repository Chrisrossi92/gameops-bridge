import { mkdtempSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { CommunityActivityResponse, NormalizedEvent, SessionRecord } from '@gameops/shared';

type EventStoreModule = {
  addEvents: (events: NormalizedEvent[]) => void;
  resetSessionStateForTests: () => void;
};

type LogTruthStoreModule = {
  resetLogTruthStoreForTests: () => void;
};

type RollupStoreModule = {
  recordClosedSessionRollup: (input: { game: 'valheim' | 'palworld'; session: SessionRecord }) => boolean;
  resetPlayerIntelligenceRollupStoreForTests: () => void;
};

type CommunityModule = {
  getCommunityActivityForServer: (serverId: string, now?: Date) => CommunityActivityResponse;
};

function createClosedSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    serverId: 'srv-community',
    playerName: 'Mira',
    startedAt: '2026-06-24T20:00:00.000Z',
    endedAt: '2026-06-24T21:00:00.000Z',
    durationSeconds: 3600,
    closeReason: 'player_leave',
    startConfidence: 'high',
    endConfidence: 'high',
    sourceEventIds: [],
    ...overrides
  };
}

function createEvent(overrides: Partial<NormalizedEvent>): NormalizedEvent {
  return {
    game: 'valheim',
    serverId: 'srv-community',
    occurredAt: '2026-07-01T12:00:00.000Z',
    eventType: 'PLAYER_JOIN',
    playerName: 'Mira',
    ...overrides
  };
}

async function withFreshCommunity(run: (modules: {
  store: EventStoreModule;
  rollups: RollupStoreModule;
  community: CommunityModule;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-community-activity-test-'));
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
    const storePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/event-store.js')).href;
    const logTruthPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/log-truth-store.js')).href;
    const rollupPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/player-intelligence-rollup-store.js')).href;
    const communityPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/community-activity.js')).href;
    const store: EventStoreModule = await import(storePath);
    const logTruth: LogTruthStoreModule = await import(logTruthPath);
    const rollups: RollupStoreModule = await import(rollupPath);
    const community: CommunityModule = await import(communityPath);
    logTruth.resetLogTruthStoreForTests();
    store.resetSessionStateForTests();
    rollups.resetPlayerIntelligenceRollupStoreForTests();
    await run({ store, rollups, community });
  } finally {
    if (previousSessionPath === undefined) delete process.env.SESSION_STATE_STORE_PATH;
    else process.env.SESSION_STATE_STORE_PATH = previousSessionPath;

    if (previousLogTruthPath === undefined) delete process.env.LOG_TRUTH_STORE_PATH;
    else process.env.LOG_TRUTH_STORE_PATH = previousLogTruthPath;

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

    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('summarizes returning, recent, quiet, peak hours, and seven-day windows', async () => {
  await withFreshCommunity(({ store, rollups, community }) => {
    const now = new Date('2026-07-01T12:00:00.000Z');

    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession({
        playerName: 'Mira',
        startedAt: '2026-06-20T20:00:00.000Z',
        endedAt: '2026-06-20T21:00:00.000Z',
        durationSeconds: 3600
      })
    });
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession({
        playerName: 'Mira',
        startedAt: '2026-06-28T20:00:00.000Z',
        endedAt: '2026-06-28T21:30:00.000Z',
        durationSeconds: 5400
      })
    });
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession({
        playerName: 'Sol',
        startedAt: '2026-06-18T02:00:00.000Z',
        endedAt: '2026-06-18T02:30:00.000Z',
        durationSeconds: 1800
      })
    });
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession({
        playerName: 'Quiet',
        startedAt: '2026-06-01T03:00:00.000Z',
        endedAt: '2026-06-01T03:20:00.000Z',
        durationSeconds: 1200
      })
    });
    store.addEvents([
      createEvent({
        playerName: 'Live',
        occurredAt: '2026-07-01T10:00:00.000Z'
      })
    ]);

    const result = community.getCommunityActivityForServer('srv-community', now);

    assert.equal(result.returningPlayers[0]?.displayName, 'Mira');
    assert.equal(result.returningPlayers[0]?.gapDays, 7);
    assert.equal(result.recentlyActive[0]?.displayName, 'Live');
    assert.equal(result.recentlyActive[0]?.label, 'Today');
    assert.equal(result.quietPlayers.some((player) => player.displayName === 'Quiet'), true);
    assert.equal(result.peakPlayHours[0]?.hourUtc, 20);
    assert.equal(result.sevenDaySnapshot.sessionCount, 2);
    assert.equal(result.sevenDaySnapshot.uniquePlayers, 2);
    assert.equal(result.sevenDaySnapshot.totalPlaytimeSeconds, 12600);
    assert.equal(result.sevenDaySnapshot.averageSessionSeconds, 6300);
    assert.equal(result.sevenDayComparison.sessions.current, 2);
    assert.equal(result.sevenDayComparison.sessions.previous, 2);
  });
});

test('returns honest empty states when community history is limited', async () => {
  await withFreshCommunity(({ community }) => {
    const result = community.getCommunityActivityForServer('srv-empty', new Date('2026-07-01T12:00:00.000Z'));

    assert.equal(result.returningPlayers.length, 0);
    assert.equal(result.recentlyActive.length, 0);
    assert.equal(result.quietPlayers.length, 0);
    assert.equal(result.peakPlayHours.length, 0);
    assert.equal(result.sevenDaySnapshot.sessionCount, 0);
    assert.equal(result.dataWarnings.includes('No session history is available yet.'), true);
  });
});
