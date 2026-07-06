import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorldEvent } from '@gameops/shared';
import type { WorldChronicleEvent, WorldMemoryRecord, WorldMemoryRegistry } from '../src/world-memory.ts';
import {
  createWorldEventRegistry,
  getTrustedWorldEventsForRegistry,
  scoreWorldEventRelevance,
  selectChronicleWorldEvents,
  worldEventToChronicleEntry,
  worldEventsToChronicleEntries,
  worldMemoryChronicleToWorldEvents
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

function memoryRecord(overrides: Partial<WorldMemoryRecord> = {}): WorldMemoryRecord {
  return {
    id: overrides.id ?? 'memory:guild:iron-wolves',
    serverId: overrides.serverId ?? 'world',
    displayName: overrides.displayName ?? 'Iron Wolves',
    type: overrides.type ?? 'guild',
    game: overrides.game ?? 'palworld',
    firstSeenAt: overrides.firstSeenAt ?? '2026-07-01T10:00:00.000Z',
    lastSeenAt: overrides.lastSeenAt ?? '2026-07-01T11:00:00.000Z',
    currentStatus: overrides.currentStatus ?? 'active',
    confidence: overrides.confidence ?? 'medium',
    chronicleReferences: overrides.chronicleReferences ?? [],
    relationships: overrides.relationships ?? [],
    sourceLabel: overrides.sourceLabel ?? 'World Memory',
    metadata: overrides.metadata ?? {}
  };
}

function chronicleEvent(overrides: Partial<WorldChronicleEvent> = {}): WorldChronicleEvent {
  return {
    id: overrides.id ?? 'guild-active:iron-wolves',
    kind: overrides.kind ?? 'guild_active',
    occurredAt: overrides.occurredAt ?? '2026-07-01T11:00:00.000Z',
    title: overrides.title ?? 'Iron Wolves showed activity.',
    detail: overrides.detail ?? 'Rossi was the most recently seen member.',
    actorName: overrides.actorName ?? 'Iron Wolves',
    memoryRecordId: overrides.memoryRecordId ?? 'memory:guild:iron-wolves',
    confidence: overrides.confidence ?? 'medium',
    sourceLabel: overrides.sourceLabel ?? 'Guild activity'
  };
}

function memoryRegistry(
  overrides: {
    serverId?: string;
    records?: WorldMemoryRecord[];
    chronicleEvents?: WorldChronicleEvent[];
  } = {}
): WorldMemoryRegistry {
  const records = overrides.records ?? [memoryRecord()];
  const chronicleEvents = overrides.chronicleEvents ?? [chronicleEvent()];

  return {
    serverId: overrides.serverId ?? 'world',
    records,
    relationships: [],
    chronicleEvents,
    getRecord: (recordId) => records.find((record) => record.id === recordId) ?? null,
    getRecordsByType: (type) => records.filter((record) => record.type === type),
    getChronicleForRecord: (recordId) => chronicleEvents.filter((event) => event.memoryRecordId === recordId),
    getDetail: (recordId) => {
      const record = records.find((item) => item.id === recordId);
      return record ? { record, relationships: [], chronicleEvents: chronicleEvents.filter((event) => event.memoryRecordId === recordId) } : null;
    }
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

test('chronicle events derive trusted world events with source, confidence, timing, and evidence preserved', () => {
  const [derived] = worldMemoryChronicleToWorldEvents(memoryRegistry());

  assert.ok(derived);
  assert.equal(derived.id, 'chronicle:world:guild-active:iron-wolves');
  assert.equal(derived.worldId, 'world');
  assert.equal(derived.eventType, 'custom');
  assert.equal(derived.title, 'Iron Wolves showed activity.');
  assert.equal(derived.summary, 'Rossi was the most recently seen member.');
  assert.equal(derived.occurredAt, '2026-07-01T11:00:00.000Z');
  assert.equal(derived.discoveredAt, '2026-07-01T11:00:00.000Z');
  assert.equal(derived.confidence, 'medium');
  assert.equal(derived.significance, 'normal');
  assert.deepEqual(derived.source, {
    kind: 'chronicle',
    label: 'Guild activity',
    referenceId: 'guild-active:iron-wolves'
  });
  assert.deepEqual(derived.evidence.map((item) => [item.type, item.label, item.sourceLabel]), [
    ['chronicle_entry', 'Chronicle entry: Iron Wolves showed activity.', 'Guild activity'],
    ['memory_record', 'Memory record: Iron Wolves', 'World Memory']
  ]);
});

test('derived world events preserve related memory and entity references', () => {
  const guild = memoryRecord({ id: 'memory:guild:iron-wolves', type: 'guild' });
  const character = memoryRecord({
    id: 'memory:character:rossi',
    type: 'character',
    displayName: 'Rossi',
    sourceLabel: 'Players'
  });
  const derivedEvents = worldMemoryChronicleToWorldEvents(memoryRegistry({
    records: [guild, character],
    chronicleEvents: [
      chronicleEvent({ id: 'guild-active', memoryRecordId: guild.id }),
      chronicleEvent({
        id: 'imported-character',
        kind: 'imported_character',
        memoryRecordId: character.id,
        title: 'Rossi appears to have entered this realm with existing progression.',
        sourceLabel: 'Character metadata'
      })
    ]
  }));

  const guildEvent = derivedEvents.find((item) => item.id === 'chronicle:world:guild-active');
  const characterEvent = derivedEvents.find((item) => item.id === 'chronicle:world:imported-character');

  assert.deepEqual(guildEvent?.relatedMemories, ['memory:guild:iron-wolves']);
  assert.deepEqual(guildEvent?.relatedGuilds, ['memory:guild:iron-wolves']);
  assert.deepEqual(characterEvent?.relatedMemories, ['memory:character:rossi']);
  assert.deepEqual(characterEvent?.relatedCharacters, ['memory:character:rossi']);
});

test('derived world events use stable ids and do not duplicate repeated chronicle input', () => {
  const repeated = chronicleEvent({ id: 'restart:world-online', kind: 'restart', memoryRecordId: undefined });
  const derivedEvents = worldMemoryChronicleToWorldEvents(memoryRegistry({
    records: [],
    chronicleEvents: [repeated, repeated]
  }));

  assert.deepEqual(derivedEvents.map((item) => item.id), ['chronicle:world:restart:world-online']);
  assert.equal(derivedEvents[0]?.evidence[0]?.metadata.chronicleEventId, 'restart:world-online');
});

test('trusted world event selection uses preview fallback only when no real records exist', () => {
  const trusted = getTrustedWorldEventsForRegistry(memoryRegistry());
  const fallback = getTrustedWorldEventsForRegistry(
    memoryRegistry({ records: [], chronicleEvents: [] }),
    [event({ id: 'preview:event', worldId: 'preview-world', metadata: { previewOnly: true } })]
  );

  assert.equal(trusted.previewFallback, false);
  assert.equal(trusted.events[0]?.metadata.derivedFrom, 'world_memory_chronicle');
  assert.equal(fallback.previewFallback, true);
  assert.deepEqual(fallback.events.map((item) => item.id), ['preview:event']);
  assert.equal(fallback.events[0]?.metadata.previewOnly, true);
});

test('world event relevance ranks major and historic events above routine events', () => {
  const selected = selectChronicleWorldEvents([
    event({ id: 'routine', significance: 'minor', confidence: 'high', occurredAt: '2026-07-05T10:00:00.000Z' }),
    event({ id: 'major', significance: 'major', confidence: 'medium', occurredAt: '2026-07-01T10:00:00.000Z' }),
    event({ id: 'historic', significance: 'historic', confidence: 'low', occurredAt: '2026-06-01T10:00:00.000Z' })
  ]);

  assert.deepEqual(selected.events.map((item) => item.id), ['historic', 'major', 'routine']);
});

test('world event relevance rewards confidence, evidence, and related memories', () => {
  const thin = event({ id: 'thin', confidence: 'low', evidence: [], relatedMemories: [] });
  const grounded = event({
    id: 'grounded',
    confidence: 'high',
    evidence: [{
      id: 'evidence:grounded',
      type: 'memory_record',
      label: 'Memory record',
      sourceLabel: 'World Memory',
      metadata: {}
    }],
    relatedMemories: ['memory:grounded']
  });

  assert.ok(scoreWorldEventRelevance(grounded) > scoreWorldEventRelevance(thin));
  assert.deepEqual(selectChronicleWorldEvents([thin, grounded]).events.map((item) => item.id), ['grounded', 'thin']);
});

test('restart and join noise does not dominate when stronger events exist', () => {
  const selected = selectChronicleWorldEvents([
    event({
      id: 'restart',
      significance: 'normal',
      confidence: 'high',
      metadata: { sourceChronicleKind: 'restart' },
      occurredAt: '2026-07-05T10:00:00.000Z'
    }),
    event({
      id: 'join',
      significance: 'minor',
      confidence: 'high',
      metadata: { sourceChronicleKind: 'join' },
      occurredAt: '2026-07-05T11:00:00.000Z'
    }),
    event({
      id: 'base-risk',
      significance: 'major',
      confidence: 'medium',
      relatedMemories: ['memory:base'],
      evidence: [{
        id: 'evidence:base',
        type: 'chronicle_entry',
        label: 'Chronicle entry',
        sourceLabel: '30-day base lifecycle',
        metadata: {}
      }],
      metadata: { sourceChronicleKind: 'base_lifecycle' },
      occurredAt: '2026-07-01T10:00:00.000Z'
    })
  ], { maxEvents: 2 });

  assert.deepEqual(selected.events.map((item) => item.id), ['base-risk', 'restart']);
});

test('world event selection cap works and reports total events', () => {
  const selected = selectChronicleWorldEvents([
    event({ id: 'one', significance: 'major' }),
    event({ id: 'two', significance: 'normal' }),
    event({ id: 'three', significance: 'minor' })
  ], { maxEvents: 2 });

  assert.equal(selected.totalEvents, 3);
  assert.deepEqual(selected.events.map((item) => item.id), ['one', 'two']);
});

test('world event relevance uses stable tie breakers', () => {
  const selected = selectChronicleWorldEvents([
    event({ id: 'b', occurredAt: '2026-07-01T10:00:00.000Z', discoveredAt: '2026-07-01T10:01:00.000Z' }),
    event({ id: 'a', occurredAt: '2026-07-01T10:00:00.000Z', discoveredAt: '2026-07-01T10:01:00.000Z' }),
    event({ id: 'newer', occurredAt: '2026-07-01T11:00:00.000Z', discoveredAt: '2026-07-01T11:01:00.000Z' })
  ]);

  assert.deepEqual(selected.events.map((item) => item.id), ['newer', 'a', 'b']);
});

test('world event selection does not mutate events', () => {
  const original = [
    event({ id: 'routine', significance: 'minor' }),
    event({ id: 'major', significance: 'major' })
  ];
  const snapshot = structuredClone(original);

  selectChronicleWorldEvents(original, { maxEvents: 1 });

  assert.deepEqual(original, snapshot);
});

test('duplicate-feeling events are quieted before filling the selection', () => {
  const selected = selectChronicleWorldEvents([
    event({
      id: 'duplicate-newer',
      title: 'Iron Wolves showed activity.',
      source: { kind: 'chronicle', label: 'Guild activity' },
      relatedMemories: ['memory:guild:iron-wolves'],
      occurredAt: '2026-07-01T12:00:00.000Z'
    }),
    event({
      id: 'duplicate-older',
      title: 'Iron Wolves showed activity.',
      source: { kind: 'chronicle', label: 'Guild activity' },
      relatedMemories: ['memory:guild:iron-wolves'],
      occurredAt: '2026-07-01T11:00:00.000Z'
    }),
    event({
      id: 'different',
      title: 'A new settlement was established.',
      source: { kind: 'chronicle', label: 'World Memory' },
      relatedMemories: ['memory:settlement'],
      occurredAt: '2026-07-01T10:00:00.000Z'
    })
  ], { maxEvents: 2 });

  assert.deepEqual(selected.events.map((item) => item.id), ['duplicate-newer', 'different']);
});
