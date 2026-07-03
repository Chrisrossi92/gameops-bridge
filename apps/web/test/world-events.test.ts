import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorldEvent } from '@gameops/shared';
import { createWorldEventRegistry } from '../src/world-events.ts';

function event(overrides: Partial<WorldEvent>): WorldEvent {
  return {
    id: overrides.id ?? 'event',
    worldId: overrides.worldId ?? 'world',
    eventType: overrides.eventType ?? 'world_state_changed',
    title: overrides.title ?? 'World changed',
    summary: overrides.summary ?? 'A world-level event occurred.',
    occurredAt: overrides.occurredAt ?? '2026-07-01T10:00:00.000Z',
    discoveredAt: overrides.discoveredAt ?? '2026-07-01T10:01:00.000Z',
    confidence: overrides.confidence ?? 'medium',
    significance: overrides.significance ?? 'normal',
    source: overrides.source ?? { kind: 'world_memory', label: 'World Memory' },
    evidence: overrides.evidence ?? [],
    relatedEvents: overrides.relatedEvents ?? [],
    relatedMemories: overrides.relatedMemories ?? [],
    relatedPlayers: overrides.relatedPlayers ?? [],
    relatedGuilds: overrides.relatedGuilds ?? [],
    relatedCharacters: overrides.relatedCharacters ?? [],
    metadata: overrides.metadata ?? {}
  };
}

test('world event registry scopes and sorts events by world time', () => {
  const registry = createWorldEventRegistry('world-a', [
    event({ id: 'older', worldId: 'world-a', occurredAt: '2026-07-01T10:00:00.000Z' }),
    event({ id: 'other-world', worldId: 'world-b', occurredAt: '2026-07-01T12:00:00.000Z' }),
    event({ id: 'newer', worldId: 'world-a', occurredAt: '2026-07-01T11:00:00.000Z' })
  ]);

  assert.deepEqual(registry.events.map((item) => item.id), ['newer', 'older']);
  assert.equal(registry.getEvent('other-world'), null);
});

test('world event registry exposes relationships and entity references', () => {
  const registry = createWorldEventRegistry('world', [
    event({
      id: 'settlement',
      eventType: 'settlement_founded',
      relatedMemories: ['memory:settlement'],
      relatedPlayers: ['player:chris'],
      relatedGuilds: ['guild:iron-wolves'],
      relatedCharacters: ['character:chris']
    }),
    event({
      id: 'portal',
      eventType: 'portal_network_expanded',
      relatedEvents: [{
        eventId: 'settlement',
        relationshipType: 'followed_by',
        confidence: 'medium',
        sourceLabel: 'Test'
      }]
    })
  ]);

  assert.deepEqual(registry.getRelatedEvents('settlement').map((item) => item.id), ['portal']);
  assert.deepEqual(registry.getEventsForMemory('memory:settlement').map((item) => item.id), ['settlement']);
  assert.deepEqual(registry.getEventsForPlayer('player:chris').map((item) => item.id), ['settlement']);
  assert.deepEqual(registry.getEventsForGuild('guild:iron-wolves').map((item) => item.id), ['settlement']);
  assert.deepEqual(registry.getEventsForCharacter('character:chris').map((item) => item.id), ['settlement']);
});
