import assert from 'node:assert/strict';
import test from 'node:test';
import type { PalworldRestConfig, PalworldRestPlayer } from '../adapters/palworld/rest.js';
import { createCollectorRunner } from '../connector-runtime.js';
import { PalworldCollector, type PalworldSnapshotFetcher } from './palworld.js';
import { CollectorRegistry } from './registry.js';

function player(input: {
  name: string;
  playerId?: string;
  userId?: string;
  accountName?: string;
}): PalworldRestPlayer {
  return {
    name: input.name,
    ...(input.playerId ? { playerId: input.playerId } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.accountName ? { accountName: input.accountName } : {})
  };
}

function createCollector(fetchPlayers: PalworldSnapshotFetcher): PalworldCollector {
  return new PalworldCollector({
    serverId: 'palworld-snapshot',
    enabled: true,
    mode: 'rest',
    restHost: '127.0.0.1',
    restPort: 8212,
    restUsername: 'admin',
    restPassword: 'password',
    restPath: '/v1/api'
  }, { fetchPlayers });
}

function sequenceFetcher(snapshots: PalworldRestPlayer[][]): PalworldSnapshotFetcher {
  let index = 0;

  return async (_config: PalworldRestConfig) => {
    const snapshot = snapshots[Math.min(index, snapshots.length - 1)] ?? [];
    index += 1;
    return snapshot;
  };
}

test('PalworldCollector first snapshot emits no events by default', async () => {
  const collector = createCollector(sequenceFetcher([
    [player({ name: 'Alice', playerId: 'p1', userId: 'u1' })]
  ]));

  const events = await collector.collect();
  const health = collector.health();

  assert.deepEqual(events, []);
  assert.equal(health.snapshot?.snapshotSize, 1);
  assert.equal(health.snapshot?.joinedCount, 0);
  assert.equal(health.snapshot?.leftCount, 0);
  assert.match(health.snapshot?.lastSuccessfulPollAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(health.snapshot?.lastError, null);
});

test('PalworldCollector emits PLAYER_JOIN for new players after first snapshot', async () => {
  const collector = createCollector(sequenceFetcher([
    [player({ name: 'Alice', playerId: 'p1', userId: 'u1' })],
    [
      player({ name: 'Alice', playerId: 'p1', userId: 'u1' }),
      player({ name: 'Bob', playerId: 'p2', userId: 'u2' })
    ]
  ]));

  assert.deepEqual(await collector.collect(), []);
  const events = await collector.collect();
  const health = collector.health();

  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, 'PLAYER_JOIN');
  assert.equal(events[0]?.playerName, 'Bob');
  assert.equal(events[0]?.platformId, 'u2');
  assert.equal(events[0]?.raw?.palworldPlayerId, 'p2');
  assert.equal(health.snapshot?.snapshotSize, 2);
  assert.equal(health.snapshot?.joinedCount, 1);
  assert.equal(health.snapshot?.leftCount, 0);
});

test('PalworldCollector emits PLAYER_LEAVE for missing players', async () => {
  const collector = createCollector(sequenceFetcher([
    [
      player({ name: 'Alice', playerId: 'p1', userId: 'u1' }),
      player({ name: 'Bob', playerId: 'p2', userId: 'u2' })
    ],
    [player({ name: 'Alice', playerId: 'p1', userId: 'u1' })]
  ]));

  assert.deepEqual(await collector.collect(), []);
  const events = await collector.collect();
  const health = collector.health();

  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, 'PLAYER_LEAVE');
  assert.equal(events[0]?.playerName, 'Bob');
  assert.equal(events[0]?.platformId, 'u2');
  assert.equal(health.snapshot?.snapshotSize, 1);
  assert.equal(health.snapshot?.joinedCount, 0);
  assert.equal(health.snapshot?.leftCount, 1);
});

test('PalworldCollector unchanged snapshot emits no events', async () => {
  const snapshot = [player({ name: 'Alice', playerId: 'p1', userId: 'u1' })];
  const collector = createCollector(sequenceFetcher([snapshot, snapshot]));

  assert.deepEqual(await collector.collect(), []);
  const events = await collector.collect();
  const health = collector.health();

  assert.deepEqual(events, []);
  assert.equal(health.snapshot?.snapshotSize, 1);
  assert.equal(health.snapshot?.joinedCount, 0);
  assert.equal(health.snapshot?.leftCount, 0);
});

test('PalworldCollector fetch failure updates snapshot health', async () => {
  const collector = createCollector(async () => {
    throw new Error('palworld rest unavailable');
  });

  await assert.rejects(() => collector.collect(), /palworld rest unavailable/);
  const health = collector.health();

  assert.equal(health.snapshot?.snapshotSize, 0);
  assert.equal(health.snapshot?.joinedCount, 0);
  assert.equal(health.snapshot?.leftCount, 0);
  assert.equal(health.snapshot?.lastSuccessfulPollAt, null);
  assert.match(health.snapshot?.lastError ?? '', /palworld rest unavailable/);
});

test('PalworldCollector shadow runner does not forward emitted delta events to API', async () => {
  const collector = createCollector(sequenceFetcher([
    [player({ name: 'Alice', playerId: 'p1', userId: 'u1' })],
    [
      player({ name: 'Alice', playerId: 'p1', userId: 'u1' }),
      player({ name: 'Bob', playerId: 'p2', userId: 'u2' })
    ]
  ]));
  const registry = new CollectorRegistry();
  const apiIngestedEvents: unknown[] = [];

  registry.register(collector);

  const runner = createCollectorRunner(registry);

  assert.equal((await runner.runOnce())[0]?.emitted, 0);
  assert.equal((await runner.runOnce())[0]?.emitted, 1);
  assert.deepEqual(apiIngestedEvents, []);
  assert.equal(runner.health()[0]?.snapshot?.joinedCount, 1);
});
