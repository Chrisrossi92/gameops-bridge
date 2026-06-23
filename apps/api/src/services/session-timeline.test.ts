import { mkdtempSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { NormalizedEvent, SessionRecord, SessionTimelineResponse } from '@gameops/shared';

type EventStoreModule = {
  addEvents: (events: NormalizedEvent[]) => void;
};

type RollupStoreModule = {
  recordClosedSessionRollup: (input: { game: 'valheim' | 'palworld'; session: SessionRecord }) => boolean;
};

type TimelineModule = {
  getSessionTimelineForServer: (serverId: string, limit?: number) => SessionTimelineResponse;
};

function createEvent(overrides: Partial<NormalizedEvent>): NormalizedEvent {
  return {
    game: 'valheim',
    serverId: 'srv-timeline',
    occurredAt: '2026-06-10T12:00:00.000Z',
    eventType: 'HEALTH_WARN',
    ...overrides
  };
}

function createClosedSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    serverId: 'srv-timeline',
    playerName: 'Kriatiri',
    startedAt: '2026-06-10T12:00:00.000Z',
    endedAt: '2026-06-10T12:45:00.000Z',
    durationSeconds: 2700,
    closeReason: 'player_leave',
    startConfidence: 'high',
    endConfidence: 'high',
    sourceEventIds: ['join-1', 'leave-1'],
    ...overrides
  };
}

async function withFreshTimeline(run: (modules: {
  store: EventStoreModule;
  rollups: RollupStoreModule;
  timeline: TimelineModule;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-session-timeline-test-'));
  const previousSessionPath = process.env.SESSION_STATE_STORE_PATH;
  const previousKnownPath = process.env.KNOWN_PLAYER_STORE_PATH;
  const previousTelemetryPath = process.env.PALWORLD_TELEMETRY_STORE_PATH;
  const previousPlayersSummaryPath = process.env.PALWORLD_PLAYERS_SUMMARY_PATH;
  const previousPlayerIntelligencePath = process.env.PLAYER_INTELLIGENCE_STORE_PATH;
  const previousPlayerEngagementPath = process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;

  process.env.SESSION_STATE_STORE_PATH = join(tempDir, 'session-state.json');
  process.env.KNOWN_PLAYER_STORE_PATH = join(tempDir, 'known-players.json');
  process.env.PALWORLD_TELEMETRY_STORE_PATH = join(tempDir, 'palworld-telemetry.json');
  process.env.PALWORLD_PLAYERS_SUMMARY_PATH = join(tempDir, 'players-summary.json');
  process.env.PLAYER_INTELLIGENCE_STORE_PATH = join(tempDir, 'player-intelligence-state.json');
  process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = join(tempDir, 'player-engagement-rollups.json');

  try {
    const nonce = `${Date.now()}-${Math.random()}`;
    const storePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/event-store.ts')).href;
    const rollupPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/player-intelligence-rollup-store.ts')).href;
    const timelinePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/session-timeline.ts')).href;
    const store: EventStoreModule = await import(storePath);
    const rollups: RollupStoreModule = await import(rollupPath);
    const timeline: TimelineModule = await import(`${timelinePath}?t=${nonce}`);
    await run({ store, rollups, timeline });
  } finally {
    if (previousSessionPath === undefined) {
      delete process.env.SESSION_STATE_STORE_PATH;
    } else {
      process.env.SESSION_STATE_STORE_PATH = previousSessionPath;
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

test('merges active and stored sessions', async () => {
  await withFreshTimeline(({ store, rollups, timeline }) => {
    const serverId = 'srv-timeline-merge';
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession({ serverId, playerName: 'Kriatiri' })
    });
    store.addEvents([
      createEvent({
        serverId,
        eventType: 'PLAYER_JOIN',
        playerName: 'Mira',
        occurredAt: '2026-06-10T13:00:00.000Z'
      })
    ]);

    const result = timeline.getSessionTimelineForServer(serverId);

    assert.equal(result.sessions.length, 2);
    assert.equal(result.summary.activeCount, 1);
    assert.equal(result.sessions.some((session) => session.source === 'live' && session.displayName === 'Mira'), true);
    assert.equal(result.sessions.some((session) => session.source === 'stored' && session.displayName === 'Kriatiri'), true);
  });
});

test('dedupes stored and recent sessions by session id', async () => {
  await withFreshTimeline(({ store, rollups, timeline }) => {
    const serverId = 'srv-timeline-dedupe';
    const session = createClosedSession({ serverId, playerName: 'Kriatiri' });

    rollups.recordClosedSessionRollup({ game: 'valheim', session });
    store.addEvents([
      createEvent({
        serverId,
        eventType: 'PLAYER_JOIN',
        playerName: 'Kriatiri',
        occurredAt: session.startedAt
      }),
      createEvent({
        serverId,
        eventType: 'PLAYER_LEAVE',
        playerName: 'Kriatiri',
        occurredAt: session.endedAt ?? '2026-06-10T12:45:00.000Z'
      })
    ]);

    const result = timeline.getSessionTimelineForServer(serverId);

    assert.equal(result.sessions.length, 1);
    assert.equal(result.sessions[0]?.source, 'recent');
  });
});

test('sorts newest sessions first', async () => {
  await withFreshTimeline(({ rollups, timeline }) => {
    const serverId = 'srv-timeline-sort';
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession({
        serverId,
        playerName: 'First',
        startedAt: '2026-06-10T10:00:00.000Z',
        endedAt: '2026-06-10T10:30:00.000Z',
        durationSeconds: 1800
      })
    });
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession({
        serverId,
        playerName: 'Second',
        startedAt: '2026-06-10T11:00:00.000Z',
        endedAt: '2026-06-10T11:30:00.000Z',
        durationSeconds: 1800
      })
    });

    const result = timeline.getSessionTimelineForServer(serverId);

    assert.equal(result.sessions[0]?.displayName, 'Second');
    assert.equal(result.sessions[1]?.displayName, 'First');
  });
});

test('returns safe empty state', async () => {
  await withFreshTimeline(({ timeline }) => {
    const result = timeline.getSessionTimelineForServer('srv-timeline-empty');

    assert.deepEqual(result.sessions, []);
    assert.equal(result.summary.activeCount, 0);
    assert.equal(result.summary.lastActivityAt, null);
    assert.match(result.explanation, /No sessions observed yet/);
  });
});
