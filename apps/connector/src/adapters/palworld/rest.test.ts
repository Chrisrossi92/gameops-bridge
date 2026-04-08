import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHealthWarnEvent,
  buildPlayerSnapshot,
  buildServerOnlineEvent,
  diffPlayerSnapshots,
  parsePlayersResponse
} from './rest.js';

test('parses Palworld REST /players payload', () => {
  const players = parsePlayersResponse({
    players: [
      {
        name: 'RossiKid11',
        accountName: 'rossi',
        playerId: 'PLAYER-1',
        userId: 'steam_123'
      }
    ]
  });

  assert.equal(players.length, 1);
  assert.equal(players[0]?.name, 'RossiKid11');
  assert.equal(players[0]?.userId, 'steam_123');
});

test('diffs player snapshots into join and leave events', () => {
  const previous = buildPlayerSnapshot([
    {
      name: 'ExistingPlayer',
      playerId: 'PLAYER-1',
      userId: 'steam_1'
    },
    {
      name: 'LeavingPlayer',
      playerId: 'PLAYER-2',
      userId: 'steam_2'
    }
  ]);
  const current = buildPlayerSnapshot([
    {
      name: 'ExistingPlayer',
      playerId: 'PLAYER-1',
      userId: 'steam_1'
    },
    {
      name: 'JoiningPlayer',
      playerId: 'PLAYER-3',
      userId: 'steam_3'
    }
  ]);

  const events = diffPlayerSnapshots(previous, current, 'palworld-test-1', '2026-04-06T12:00:00.000Z');

  assert.equal(events.length, 2);
  assert.equal(events[0]?.eventType, 'PLAYER_JOIN');
  assert.equal(events[0]?.playerName, 'JoiningPlayer');
  assert.equal(events[0]?.raw?.palworldCurrentPlayerCount, 2);
  assert.equal(events[1]?.eventType, 'PLAYER_LEAVE');
  assert.equal(events[1]?.playerName, 'LeavingPlayer');
  assert.equal(events[1]?.raw?.palworldCurrentPlayerCount, 2);
});

test('creates palworld server online and health warn events', () => {
  const online = buildServerOnlineEvent('palworld-test-1', '2026-04-06T12:00:00.000Z', 1);
  const warn = buildHealthWarnEvent('palworld-test-1', '2026-04-06T12:05:00.000Z', 3, 'REST API poll failed');

  assert.equal(online.eventType, 'SERVER_ONLINE');
  assert.equal(online.raw?.palworldCurrentPlayerCount, 1);
  assert.equal(warn.eventType, 'HEALTH_WARN');
  assert.equal(warn.raw?.palworldFailureCount, 3);
});
