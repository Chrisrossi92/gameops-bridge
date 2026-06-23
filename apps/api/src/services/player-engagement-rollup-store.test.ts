import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { SessionRecord } from '@gameops/shared';

type EngagementRollupStoreModule = {
  recordClosedSessionEngagementRollup: (session: SessionRecord) => boolean;
  getDailyPlayerEngagementRollupsForServer: (serverId: string) => Array<{
    serverId: string;
    date: string;
    playerId: string;
    playerKey: string;
    displayName: string;
    sessionCount: number;
    trackedSeconds: number;
    firstSeenAt: string;
    lastSeenAt: string;
    lowConfidenceSessionCount: number;
    inferredSessionCount: number;
    sourceSummary: string[];
    sourceSessionIds: string[];
    hourlyBuckets: Array<{
      hourUtc: number;
      sessionStartCount: number;
      trackedSeconds: number;
      activePlayerKeys: string[];
      lowConfidenceSessionCount: number;
      inferredSessionCount: number;
    }>;
  }>;
};

function createClosedSession(serverId: string, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    serverId,
    playerName: 'Kriatiri',
    startedAt: '2026-06-11T12:00:00.000Z',
    endedAt: '2026-06-11T12:45:00.000Z',
    durationSeconds: 2700,
    closeReason: 'player_leave',
    startConfidence: 'high',
    endConfidence: 'high',
    sourceEventIds: ['join-1', 'leave-1'],
    ...overrides
  };
}

async function withFreshRollupStore(run: (store: EngagementRollupStoreModule, tempDir: string) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-engagement-rollup-store-test-'));
  const previousPath = process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
  process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = join(tempDir, 'player-engagement-rollups.json');

  try {
    const nonce = `${Date.now()}-${Math.random()}`;
    const storePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/player-engagement-rollup-store.ts')).href;
    const store: EngagementRollupStoreModule = await import(`${storePath}?t=${nonce}`);
    await run(store, tempDir);
  } finally {
    if (previousPath === undefined) delete process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
    else process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = previousPath;

    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('creates a daily engagement rollup from a closed session', async () => {
  await withFreshRollupStore((store) => {
    const recorded = store.recordClosedSessionEngagementRollup(createClosedSession('rollup-create'));
    const rollups = store.getDailyPlayerEngagementRollupsForServer('rollup-create');

    assert.equal(recorded, true);
    assert.equal(rollups.length, 1);
    assert.equal(rollups[0]?.date, '2026-06-11');
    assert.equal(rollups[0]?.displayName, 'Kriatiri');
    assert.equal(rollups[0]?.sessionCount, 1);
    assert.equal(rollups[0]?.trackedSeconds, 2700);
    assert.equal(rollups[0]?.hourlyBuckets[0]?.hourUtc, 12);
  });
});

test('loads old daily engagement rollups without hourly buckets', async () => {
  await withFreshRollupStore((store, tempDir) => {
    writeFileSync(join(tempDir, 'player-engagement-rollups.json'), JSON.stringify({
      dailyRollups: [{
        serverId: 'rollup-old-json',
        date: '2026-06-11',
        playerId: 'rollup-old-json:kriatiri',
        playerKey: 'kriatiri',
        displayName: 'Kriatiri',
        sessionCount: 1,
        trackedSeconds: 2700,
        firstSeenAt: '2026-06-11T12:00:00.000Z',
        lastSeenAt: '2026-06-11T12:45:00.000Z',
        lowConfidenceSessionCount: 0,
        inferredSessionCount: 0,
        sourceSummary: ['daily engagement rollup'],
        sourceSessionIds: ['old-session']
      }],
      processedSessionIds: ['old-session']
    }, null, 2), 'utf8');

    const rollups = store.getDailyPlayerEngagementRollupsForServer('rollup-old-json');

    assert.equal(rollups.length, 1);
    assert.deepEqual(rollups[0]?.hourlyBuckets, []);
  });
});

test('merges same-day same-player sessions', async () => {
  await withFreshRollupStore((store) => {
    store.recordClosedSessionEngagementRollup(createClosedSession('rollup-merge', {
      playerName: 'Mira',
      startedAt: '2026-06-11T10:00:00.000Z',
      endedAt: '2026-06-11T10:30:00.000Z',
      durationSeconds: 1800
    }));
    store.recordClosedSessionEngagementRollup(createClosedSession('rollup-merge', {
      playerName: 'Mira',
      startedAt: '2026-06-11T12:00:00.000Z',
      endedAt: '2026-06-11T13:00:00.000Z',
      durationSeconds: 3600
    }));

    const rollups = store.getDailyPlayerEngagementRollupsForServer('rollup-merge');

    assert.equal(rollups.length, 1);
    assert.equal(rollups[0]?.sessionCount, 2);
    assert.equal(rollups[0]?.trackedSeconds, 5400);
    assert.equal(rollups[0]?.firstSeenAt, '2026-06-11T10:00:00.000Z');
    assert.equal(rollups[0]?.lastSeenAt, '2026-06-11T13:00:00.000Z');
  });
});

test('avoids duplicate session processing', async () => {
  await withFreshRollupStore((store) => {
    const session = createClosedSession('rollup-dedupe', {
      playerName: 'Delta',
      durationSeconds: 1200
    });

    assert.equal(store.recordClosedSessionEngagementRollup(session), true);
    assert.equal(store.recordClosedSessionEngagementRollup(session), false);

    const rollups = store.getDailyPlayerEngagementRollupsForServer('rollup-dedupe');

    assert.equal(rollups.length, 1);
    assert.equal(rollups[0]?.sessionCount, 1);
    assert.equal(rollups[0]?.trackedSeconds, 1200);
  });
});

test('tracks low-confidence and inferred sessions', async () => {
  await withFreshRollupStore((store) => {
    store.recordClosedSessionEngagementRollup(createClosedSession('rollup-confidence', {
      playerName: 'Scout',
      closeReason: 'occupancy_reconciliation',
      endConfidence: 'low'
    }));

    const rollup = store.getDailyPlayerEngagementRollupsForServer('rollup-confidence')[0];

    assert.equal(rollup?.lowConfidenceSessionCount, 1);
    assert.equal(rollup?.inferredSessionCount, 1);
    assert.equal(rollup?.sourceSummary.includes('low-confidence session'), true);
    assert.equal(rollup?.sourceSummary.includes('occupancy_reconciliation'), true);
  });
});

test('creates an hourly bucket for a closed session', async () => {
  await withFreshRollupStore((store) => {
    store.recordClosedSessionEngagementRollup(createClosedSession('rollup-hourly', {
      playerName: 'Mira',
      startedAt: '2026-06-11T20:00:00.000Z',
      endedAt: '2026-06-11T20:45:00.000Z',
      durationSeconds: 2700
    }));

    const bucket = store.getDailyPlayerEngagementRollupsForServer('rollup-hourly')[0]?.hourlyBuckets[0];

    assert.equal(bucket?.hourUtc, 20);
    assert.equal(bucket?.sessionStartCount, 1);
    assert.equal(bucket?.trackedSeconds, 2700);
    assert.deepEqual(bucket?.activePlayerKeys, ['mira']);
  });
});

test('distributes multi-hour sessions across hourly buckets', async () => {
  await withFreshRollupStore((store) => {
    store.recordClosedSessionEngagementRollup(createClosedSession('rollup-hourly-multi', {
      playerName: 'Mira',
      startedAt: '2026-06-11T12:30:00.000Z',
      endedAt: '2026-06-11T14:15:00.000Z',
      durationSeconds: 6300
    }));

    const buckets = store.getDailyPlayerEngagementRollupsForServer('rollup-hourly-multi')[0]?.hourlyBuckets ?? [];

    assert.equal(buckets.length, 3);
    assert.deepEqual(
      buckets.map((bucket) => ({
        hourUtc: bucket.hourUtc,
        sessionStartCount: bucket.sessionStartCount,
        trackedSeconds: bucket.trackedSeconds
      })),
      [
        { hourUtc: 12, sessionStartCount: 1, trackedSeconds: 1800 },
        { hourUtc: 13, sessionStartCount: 0, trackedSeconds: 3600 },
        { hourUtc: 14, sessionStartCount: 0, trackedSeconds: 900 }
      ]
    );
  });
});
