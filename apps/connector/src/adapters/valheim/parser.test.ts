import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyValheimLine, valheimAdapter } from './parser.js';

const serverId = 'valheim-parser-test';

test('classifies world saved as operational shadow signal without live event', () => {
  const line = 'Jul 01 10:00:00 ubuntu run-valheim.sh[123]: 07/01/2026 10:00:00: World saved';
  const classification = classifyValheimLine(line);

  assert.equal(classification.category, 'world_saved');
  assert.equal(classification.confidence, 'high');
  assert.equal(classification.emitShadowEvent, true);
  assert.equal(valheimAdapter.parseLine(line, { serverId }), null);
});

test('classifies connection count journal line', () => {
  const line = '07/01/2026 10:01:00: Connections 0 ZDOS:0  sent:0 recv:0';
  const classification = classifyValheimLine(line);

  assert.equal(classification.category, 'connection_count');
  assert.equal(classification.confidence, 'high');
  assert.equal(classification.emitShadowEvent, true);
  assert.deepEqual(classification.details, {
    connections: 0,
    zdos: 0,
    sent: 0,
    recv: 0
  });
  assert.equal(valheimAdapter.parseLine(line, { serverId }), null);
});

test('classifies RPC_Disconnect as player disconnect hint', () => {
  const line = '07/01/2026 10:02:00: RPC_Disconnect';
  const classification = classifyValheimLine(line);

  assert.equal(classification.category, 'player_disconnected_hint');
  assert.equal(classification.confidence, 'medium');
  assert.equal(classification.emitShadowEvent, true);
  assert.equal(valheimAdapter.parseLine(line, { serverId }), null);
});

test('classifies closing socket as socket closed', () => {
  const line = '07/01/2026 10:03:00: Closing socket steam_76561198000000000';
  const classification = classifyValheimLine(line);

  assert.equal(classification.category, 'socket_closed');
  assert.equal(classification.confidence, 'medium');
  assert.equal(classification.emitShadowEvent, true);
  assert.equal(classification.details?.socketId, 'steam_76561198000000000');
  const event = valheimAdapter.parseLine(line, { serverId });
  assert.equal(event?.eventType, 'HEALTH_WARN');
  assert.equal(event?.raw?.valheimDisconnectSignal, true);
  assert.equal(event?.raw?.valheimDisconnectRule, 'socket_closed');
  assert.equal(event?.raw?.valheimDisconnectSocketId, 'steam_76561198000000000');
});

test('classifies PlayFab entity token refresh as routine token refresh', () => {
  const line = '07/01/2026 10:04:00: Update PlayFab entity token';
  const classification = classifyValheimLine(line);

  assert.equal(classification.category, 'server_token_refresh');
  assert.equal(classification.confidence, 'high');
  assert.equal(classification.emitShadowEvent, true);
  assert.equal(valheimAdapter.parseLine(line, { serverId }), null);
});

test('classifies lobby refreshed as health noise', () => {
  const line = '07/01/2026 10:05:00: Lobby refreshed';
  const classification = classifyValheimLine(line);

  assert.equal(classification.category, 'health_noise');
  assert.equal(classification.confidence, 'high');
  assert.equal(classification.emitShadowEvent, true);
  assert.equal(classification.details?.noiseType, 'lobby_refreshed');
  assert.equal(valheimAdapter.parseLine(line, { serverId }), null);
});

test('classifies unknown lines without emitting shadow events', () => {
  const line = '07/01/2026 10:06:00: harmless informational line';
  const classification = classifyValheimLine(line);

  assert.equal(classification.category, 'unknown_event');
  assert.equal(classification.confidence, 'low');
  assert.equal(classification.emitShadowEvent, false);
  assert.equal(valheimAdapter.parseLine(line, { serverId }), null);
});
