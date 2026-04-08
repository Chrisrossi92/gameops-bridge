import assert from 'node:assert/strict';
import test from 'node:test';
import { palworldAdapter } from './parser.js';

const context = { serverId: 'palworld-test-1' };

test('parses SERVER_ONLINE from startup line', () => {
  const line = '[2026-04-05 10:00:00] Palworld dedicated server started and listening on 0.0.0.0:8211';
  const event = palworldAdapter.parseLine(line, context);

  assert.ok(event);
  assert.equal(event.eventType, 'SERVER_ONLINE');
  assert.equal(event.game, 'palworld');
  assert.equal(event.serverId, context.serverId);
});

test('parses PLAYER_JOIN with player name', () => {
  const line = '[2026-04-05 10:01:00] Player "RossiKid11" has joined the game';
  const event = palworldAdapter.parseLine(line, context);

  assert.ok(event);
  assert.equal(event.eventType, 'PLAYER_JOIN');
  assert.equal(event.playerName, 'RossiKid11');
});

test('parses PLAYER_LEAVE with player name', () => {
  const line = '[2026-04-05 10:10:00] Player "RossiKid11" disconnected';
  const event = palworldAdapter.parseLine(line, context);

  assert.ok(event);
  assert.equal(event.eventType, 'PLAYER_LEAVE');
  assert.equal(event.playerName, 'RossiKid11');
});

test('parses HEALTH_WARN from warning/error style line', () => {
  const line = '[2026-04-05 10:20:00] Warning: connection lost to backend service';
  const event = palworldAdapter.parseLine(line, context);

  assert.ok(event);
  assert.equal(event.eventType, 'HEALTH_WARN');
});

test('ignores non-matching noise lines', () => {
  const noiseLines = [
    '[2026-04-05 10:30:00] Autosave complete in 482 ms',
    '[2026-04-05 10:31:00] Asset preload completed',
    '[2026-04-05 10:32:00] Optional cosmetic data failed lookup but continuing'
  ];

  for (const line of noiseLines) {
    const event = palworldAdapter.parseLine(line, context);
    assert.equal(event, null);
  }
});
