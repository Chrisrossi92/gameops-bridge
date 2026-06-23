import { mkdtempSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { NormalizedEvent, PlayerDetailResponse, SessionRecord } from '@gameops/shared';

type EventStoreModule = {
  addEvents: (events: NormalizedEvent[]) => void;
};

type RollupStoreModule = {
  recordClosedSessionRollup: (input: { game: 'valheim' | 'palworld'; session: SessionRecord }) => boolean;
};

type PlayerDetailModule = {
  getPlayerDetail: (serverId: string, playerId: string) => PlayerDetailResponse | null;
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

function createClosedSession(index: number): SessionRecord {
  const minute = String(index).padStart(2, '0');
  return {
    serverId: 'srv-1',
    playerName: 'Kriatiri',
    startedAt: `2026-06-10T12:${minute}:00.000Z`,
    endedAt: `2026-06-10T12:${minute}:30.000Z`,
    durationSeconds: 30,
    closeReason: 'player_leave',
    startConfidence: 'high',
    endConfidence: 'high',
    sourceEventIds: [`join-${index}`, `leave-${index}`]
  };
}

async function withFreshPlayerDetail(run: (modules: {
  store: EventStoreModule;
  rollups: RollupStoreModule;
  detail: PlayerDetailModule;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-player-detail-test-'));
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
    const detailPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/player-detail.ts')).href;
    const storePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/event-store.ts')).href;
    const rollupPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/player-intelligence-rollup-store.ts')).href;
    const detail: PlayerDetailModule = await import(`${detailPath}?t=${nonce}`);
    const store: EventStoreModule = await import(storePath);
    const rollups: RollupStoreModule = await import(rollupPath);
    await run({ store, rollups, detail });
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

test('returns detail from persisted rollup only', async () => {
  await withFreshPlayerDetail(({ rollups, detail }) => {
    rollups.recordClosedSessionRollup({ game: 'valheim', session: createClosedSession(1) });

    const result = detail.getPlayerDetail('srv-1', 'srv-1:kriatiri');

    assert.equal(result?.player.displayName, 'Kriatiri');
    assert.equal(result?.player.trackedPlaytimeSeconds, 30);
    assert.equal(result?.recentSessions.length, 1);
    assert.equal(result?.status, 'Last known from stored rollup.');
  });
});

test('returns detail from active session only', async () => {
  await withFreshPlayerDetail(({ store, detail }) => {
    store.addEvents([
      createEvent({
        eventType: 'PLAYER_JOIN',
        playerName: 'Mira',
        occurredAt: '2026-06-10T12:00:00.000Z'
      })
    ]);

    const result = detail.getPlayerDetail('srv-1', 'Mira');

    assert.equal(result?.player.displayName, 'Mira');
    assert.equal(result?.player.isOnline, true);
    assert.equal(result?.status, 'Currently online from active session.');
    assert.equal(result?.recentSessions[0]?.endedAt, null);
  });
});

test('returns null for missing player detail', async () => {
  await withFreshPlayerDetail(({ detail }) => {
    assert.equal(detail.getPlayerDetail('srv-1', 'missing-player'), null);
  });
});

test('recent sessions are capped and deduped', async () => {
  await withFreshPlayerDetail(({ rollups, detail }) => {
    for (let index = 0; index < 30; index += 1) {
      rollups.recordClosedSessionRollup({ game: 'valheim', session: createClosedSession(index) });
    }
    rollups.recordClosedSessionRollup({ game: 'valheim', session: createClosedSession(29) });

    const result = detail.getPlayerDetail('srv-1', 'srv-1:kriatiri');
    const sessionIds = new Set(result?.recentSessions.map((session) => session.sessionId) ?? []);

    assert.equal(result?.recentSessions.length, 25);
    assert.equal(sessionIds.size, 25);
  });
});
