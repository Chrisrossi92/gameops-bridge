import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorldEvent } from '@gameops/shared';
import {
  createWorldEventRegistry,
  worldEventToChronicleEntry,
  worldEventsToChronicleEntries
} from '../src/world-events.ts';

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

test('world event chronicle mapping preserves source, confidence, timing, memories, and evidence', () => {
  const chronicleEntry = worldEventToChronicleEntry(event({
    id: 'iron-wolves-founded',
    eventType: 'guild_created',
    title: 'Iron Wolves guild',
    summary: 'The Iron Wolves guild was founded from trusted world memory evidence.',
    occurredAt: '2026-07-01T18:15:00.000Z',
    discoveredAt: '2026-07-01T18:16:00.000Z',
    confidence: 'high',
    significance: 'major',
    source: { kind: 'world_memory', label: 'World Memory' },
    evidence: [{
      id: 'evidence:guild-memory',
      type: 'memory_record',
      label: 'Guild memory record',
      sourceLabel: 'World Memory',
      observedAt: '2026-07-01T18:16:00.000Z',
      metadata: { guildName: 'Iron Wolves' }
    }],
    relatedMemories: ['memory:guild:iron-wolves'],
    relatedPlayers: ['player:chris'],
    relatedGuilds: ['guild:iron-wolves'],
    relatedCharacters: ['character:chris']
  }));

  assert.equal(chronicleEntry.id, 'world-event:iron-wolves-founded');
  assert.equal(chronicleEntry.worldEventId, 'iron-wolves-founded');
  assert.equal(chronicleEntry.kind, 'guild_active');
  assert.equal(chronicleEntry.title, 'Iron Wolves guild was founded.');
  assert.equal(chronicleEntry.detail, 'The Iron Wolves guild was founded from trusted world memory evidence.');
  assert.equal(chronicleEntry.occurredAt, '2026-07-01T18:15:00.000Z');
  assert.equal(chronicleEntry.discoveredAt, '2026-07-01T18:16:00.000Z');
  assert.equal(chronicleEntry.confidence, 'high');
  assert.equal(chronicleEntry.significance, 'major');
  assert.equal(chronicleEntry.sourceLabel, 'World Memory');
  assert.equal(chronicleEntry.sourceKind, 'world_memory');
  assert.equal(chronicleEntry.memoryRecordId, 'memory:guild:iron-wolves');
  assert.equal(chronicleEntry.evidenceCount, 1);
  assert.deepEqual(chronicleEntry.evidenceLabels, ['Guild memory record']);
  assert.deepEqual(chronicleEntry.relatedMemories, ['memory:guild:iron-wolves']);
  assert.deepEqual(chronicleEntry.relatedPlayers, ['player:chris']);
  assert.deepEqual(chronicleEntry.relatedGuilds, ['guild:iron-wolves']);
  assert.deepEqual(chronicleEntry.relatedCharacters, ['character:chris']);
});

test('world events map to chronicle entries without inventing summaries and stay sorted by occurred time', () => {
  const chronicleEntries = worldEventsToChronicleEntries([
    event({
      id: 'older',
      title: 'A new settlement',
      summary: 'A new settlement was established.',
      eventType: 'settlement_founded',
      occurredAt: '2026-07-01T10:00:00.000Z'
    }),
    event({
      id: 'newer',
      title: 'A major world event',
      summary: 'A major world event was recorded.',
      eventType: 'community_milestone',
      occurredAt: '2026-07-01T11:00:00.000Z'
    })
  ]);

  assert.deepEqual(chronicleEntries.map((entry) => entry.worldEventId), ['newer', 'older']);
  assert.deepEqual(chronicleEntries.map((entry) => entry.kind), ['world_event', 'world_event']);
  assert.equal(chronicleEntries[0].detail, 'A major world event was recorded.');
  assert.equal(chronicleEntries[1].detail, 'A new settlement was established.');
});
