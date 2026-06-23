import { mkdtempSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { SessionRecord } from '@gameops/shared';

type RollupStoreModule = {
  getPersistedPlayerRollupsForServer: (serverId: string) => unknown[];
  recordClosedSessionRollup: (input: { game: 'valheim' | 'palworld'; session: SessionRecord }) => boolean;
  recordPlayerSeenFromSessionStart: (input: {
    serverId: string;
    game: 'valheim' | 'palworld';
    playerName: string;
    observedAt: string;
    confidence?: 'low' | 'medium' | 'high';
  }) => void;
};

async function withFreshRollupStore(run: (store: RollupStoreModule) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-rollup-store-test-'));
  const previousPath = process.env.PLAYER_INTELLIGENCE_STORE_PATH;
  const previousEngagementPath = process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;

  process.env.PLAYER_INTELLIGENCE_STORE_PATH = join(tempDir, 'player-intelligence-state.json');
  process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = join(tempDir, 'player-engagement-rollups.json');

  try {
    const modulePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/player-intelligence-rollup-store.ts')).href;
    const store: RollupStoreModule = await import(`${modulePath}?t=${Date.now()}-${Math.random()}`);
    await run(store);
  } finally {
    if (previousPath === undefined) {
      delete process.env.PLAYER_INTELLIGENCE_STORE_PATH;
    } else {
      process.env.PLAYER_INTELLIGENCE_STORE_PATH = previousPath;
    }

    if (previousEngagementPath === undefined) {
      delete process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
    } else {
      process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = previousEngagementPath;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
}

function createClosedSession(): SessionRecord {
  return {
    serverId: 'srv-1',
    playerName: 'Kriatiri',
    startedAt: '2026-06-10T12:00:00.000Z',
    endedAt: '2026-06-10T12:45:00.000Z',
    durationSeconds: 2700,
    startConfidence: 'high',
    endConfidence: 'high',
    sourceEventIds: ['join-1', 'leave-1']
  };
}

test('loads missing player intelligence store safely', async () => {
  await withFreshRollupStore((store) => {
    assert.deepEqual(store.getPersistedPlayerRollupsForServer('srv-1'), []);
  });
});

test('persists rollup after closed session', async () => {
  await withFreshRollupStore((store) => {
    assert.equal(store.recordClosedSessionRollup({ game: 'valheim', session: createClosedSession() }), true);

    const [player] = store.getPersistedPlayerRollupsForServer('srv-1') as Array<{
      displayName: string;
      totalTrackedSeconds: number;
      sessionCount: number;
      averageSessionSeconds: number;
    }>;

    assert.equal(player?.displayName, 'Kriatiri');
    assert.equal(player?.totalTrackedSeconds, 2700);
    assert.equal(player?.sessionCount, 1);
    assert.equal(player?.averageSessionSeconds, 2700);
  });
});

test('does not double-count the same closed session', async () => {
  await withFreshRollupStore((store) => {
    const session = createClosedSession();

    assert.equal(store.recordClosedSessionRollup({ game: 'valheim', session }), true);
    assert.equal(store.recordClosedSessionRollup({ game: 'valheim', session }), false);

    const [player] = store.getPersistedPlayerRollupsForServer('srv-1') as Array<{
      totalTrackedSeconds: number;
      sessionCount: number;
    }>;

    assert.equal(player?.totalTrackedSeconds, 2700);
    assert.equal(player?.sessionCount, 1);
  });
});
