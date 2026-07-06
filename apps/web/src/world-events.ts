import type {
  WorldEvent,
  WorldEventConfidence,
  WorldEventEvidenceReference,
  WorldEventSignificance,
  WorldEventSourceKind,
  WorldEventType
} from '@gameops/shared';
import type {
  WorldChronicleEvent,
  WorldChronicleEventKind,
  WorldMemoryRecord,
  WorldMemoryRegistry
} from './world-memory.ts';

export const WORLD_EVENT_TYPE_LABELS: Record<WorldEventType, string> = {
  boss_defeated: 'Boss defeated',
  settlement_founded: 'Settlement founded',
  trader_discovered: 'Trader discovered',
  portal_network_expanded: 'Portal network expanded',
  guild_created: 'Guild created',
  base_abandoned: 'Base abandoned',
  expedition_launched: 'Expedition launched',
  world_state_changed: 'World changed',
  community_milestone: 'Community milestone',
  custom: 'World event'
};

export const WORLD_EVENT_SOURCE_LABELS: Record<WorldEventSourceKind, string> = {
  session_engine: 'Session Engine',
  world_memory: 'World Memory',
  collector: 'Collector',
  chronicle: 'Chronicle',
  manual_operator_entry: 'Manual Operator Entry',
  discord_integration: 'Discord integration',
  ai_consumer: 'AI consumer',
  system: 'System'
};

export interface WorldEventRegistry {
  worldId: string;
  events: WorldEvent[];
  getEvent: (eventId: string) => WorldEvent | null;
  getEventsByType: (eventType: WorldEventType) => WorldEvent[];
  getEventsBySignificance: (significance: WorldEventSignificance) => WorldEvent[];
  getRelatedEvents: (eventId: string) => WorldEvent[];
  getEventsForMemory: (memoryId: string) => WorldEvent[];
  getEventsForPlayer: (playerId: string) => WorldEvent[];
  getEventsForGuild: (guildId: string) => WorldEvent[];
  getEventsForCharacter: (characterId: string) => WorldEvent[];
}

export interface WorldEventChronicleEntry extends WorldChronicleEvent {
  worldEventId: string;
  discoveredAt: string;
  significance: WorldEventSignificance;
  sourceKind: WorldEventSourceKind;
  evidenceCount: number;
  evidenceLabels: string[];
  relatedMemories: string[];
  relatedPlayers: string[];
  relatedGuilds: string[];
  relatedCharacters: string[];
}

export interface DerivedWorldEventsResult {
  events: WorldEvent[];
  previewFallback: boolean;
}

function compareWorldEvents(left: WorldEvent, right: WorldEvent): number {
  const occurredDelta = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);

  if (occurredDelta !== 0) {
    return occurredDelta;
  }

  return Date.parse(right.discoveredAt) - Date.parse(left.discoveredAt);
}

function toChronicleConfidence(confidence: WorldEventConfidence): WorldChronicleEvent['confidence'] {
  return confidence === 'unknown' ? 'low' : confidence;
}

function getWorldEventChronicleKind(eventType: WorldEventType): WorldChronicleEventKind {
  switch (eventType) {
    case 'guild_created':
      return 'guild_active';
    case 'base_abandoned':
      return 'base_lifecycle';
    case 'boss_defeated':
    case 'settlement_founded':
    case 'trader_discovered':
    case 'portal_network_expanded':
    case 'expedition_launched':
    case 'world_state_changed':
    case 'community_milestone':
    case 'custom':
      return 'world_event';
  }
}

function getWorldEventChronicleTitle(event: WorldEvent): string {
  switch (event.eventType) {
    case 'boss_defeated':
      return `${event.title} was recorded in the world's history.`;
    case 'settlement_founded':
      return `${event.title} was established.`;
    case 'trader_discovered':
      return `${event.title} was discovered.`;
    case 'portal_network_expanded':
      return `${event.title} expanded the realm's travel network.`;
    case 'guild_created':
      return `${event.title} was founded.`;
    case 'base_abandoned':
      return `${event.title} appears abandoned.`;
    case 'expedition_launched':
      return `${event.title} began.`;
    case 'community_milestone':
      return `${event.title} became a community milestone.`;
    case 'world_state_changed':
    case 'custom':
      return event.title;
  }
}

function getChronicleWorldEventSignificance(kind: WorldChronicleEventKind): WorldEventSignificance {
  switch (kind) {
    case 'arrival':
    case 'return':
    case 'join':
    case 'leave':
      return 'minor';
    case 'base_lifecycle':
    case 'guild_quiet':
      return 'major';
    case 'restart':
    case 'imported_character':
    case 'world_event':
    case 'guild_active':
      return 'normal';
  }
}

function getWorldEventDiscoveredAt(event: WorldChronicleEvent, record: WorldMemoryRecord | null): string {
  return record?.lastSeenAt ?? record?.firstSeenAt ?? event.occurredAt;
}

function getRelatedPlayers(record: WorldMemoryRecord | null): string[] {
  return record?.type === 'person' ? [record.id] : [];
}

function getRelatedGuilds(record: WorldMemoryRecord | null): string[] {
  return record?.type === 'guild' || record?.type === 'clan' ? [record.id] : [];
}

function getRelatedCharacters(record: WorldMemoryRecord | null): string[] {
  return record?.type === 'character' ? [record.id] : [];
}

export function worldMemoryChronicleToWorldEvents(registry: WorldMemoryRegistry): WorldEvent[] {
  const eventsById = new Map<string, WorldEvent>();

  for (const chronicleEvent of registry.chronicleEvents) {
    const memoryRecord = chronicleEvent.memoryRecordId ? registry.getRecord(chronicleEvent.memoryRecordId) : null;
    const eventId = `chronicle:${registry.serverId}:${chronicleEvent.id}`;

    if (eventsById.has(eventId)) {
      continue;
    }

    const evidence: WorldEventEvidenceReference[] = [{
      id: `evidence:${eventId}:chronicle`,
      type: 'chronicle_entry' as const,
      label: `Chronicle entry: ${chronicleEvent.title}`,
      sourceLabel: chronicleEvent.sourceLabel,
      observedAt: chronicleEvent.occurredAt,
      metadata: {
        chronicleEventId: chronicleEvent.id,
        chronicleKind: chronicleEvent.kind
      }
    }];

    if (memoryRecord) {
      evidence.push({
        id: `evidence:${eventId}:memory`,
        type: 'memory_record',
        label: `Memory record: ${memoryRecord.displayName}`,
        sourceLabel: memoryRecord.sourceLabel,
        observedAt: memoryRecord.lastSeenAt ?? memoryRecord.firstSeenAt ?? chronicleEvent.occurredAt,
        metadata: {
          memoryRecordId: memoryRecord.id,
          memoryRecordType: memoryRecord.type
        }
      });
    }

    eventsById.set(eventId, {
      id: eventId,
      worldId: registry.serverId,
      eventType: 'custom',
      title: chronicleEvent.title,
      summary: chronicleEvent.detail ?? 'A trusted Chronicle event was recorded.',
      occurredAt: chronicleEvent.occurredAt,
      discoveredAt: getWorldEventDiscoveredAt(chronicleEvent, memoryRecord),
      confidence: chronicleEvent.confidence,
      significance: getChronicleWorldEventSignificance(chronicleEvent.kind),
      source: {
        kind: 'chronicle',
        label: chronicleEvent.sourceLabel,
        referenceId: chronicleEvent.id
      },
      evidence,
      relatedEvents: [],
      relatedMemories: memoryRecord ? [memoryRecord.id] : [],
      relatedPlayers: getRelatedPlayers(memoryRecord),
      relatedGuilds: getRelatedGuilds(memoryRecord),
      relatedCharacters: getRelatedCharacters(memoryRecord),
      metadata: {
        derivedFrom: 'world_memory_chronicle',
        sourceChronicleEventId: chronicleEvent.id,
        sourceChronicleKind: chronicleEvent.kind
      }
    });
  }

  return [...eventsById.values()].sort(compareWorldEvents);
}

export function getTrustedWorldEventsForRegistry(
  registry: WorldMemoryRegistry,
  previewEvents: WorldEvent[] = worldEventPreviewEvents
): DerivedWorldEventsResult {
  const derivedEvents = worldMemoryChronicleToWorldEvents(registry);

  if (derivedEvents.length > 0) {
    return {
      events: createWorldEventRegistry(registry.serverId, derivedEvents).events,
      previewFallback: false
    };
  }

  return {
    events: createWorldEventRegistry(previewEvents[0]?.worldId ?? registry.serverId, previewEvents).events,
    previewFallback: true
  };
}

export function createWorldEventRegistry(worldId: string, events: WorldEvent[]): WorldEventRegistry {
  const scopedEvents = events
    .filter((event) => event.worldId === worldId)
    .slice()
    .sort(compareWorldEvents);
  const eventsById = new Map(scopedEvents.map((event) => [event.id, event]));

  return {
    worldId,
    events: scopedEvents,
    getEvent: (eventId) => eventsById.get(eventId) ?? null,
    getEventsByType: (eventType) => scopedEvents.filter((event) => event.eventType === eventType),
    getEventsBySignificance: (significance) => scopedEvents.filter((event) => event.significance === significance),
    getRelatedEvents: (eventId) => {
      const event = eventsById.get(eventId);

      if (!event) {
        return [];
      }

      const explicitIds = new Set(event.relatedEvents.map((relationship) => relationship.eventId));
      return scopedEvents.filter((candidate) => (
        explicitIds.has(candidate.id)
        || candidate.relatedEvents.some((relationship) => relationship.eventId === eventId)
      ));
    },
    getEventsForMemory: (memoryId) => scopedEvents.filter((event) => event.relatedMemories.includes(memoryId)),
    getEventsForPlayer: (playerId) => scopedEvents.filter((event) => event.relatedPlayers.includes(playerId)),
    getEventsForGuild: (guildId) => scopedEvents.filter((event) => event.relatedGuilds.includes(guildId)),
    getEventsForCharacter: (characterId) => scopedEvents.filter((event) => event.relatedCharacters.includes(characterId))
  };
}

export function getWorldEventTypeLabel(eventType: WorldEventType): string {
  return WORLD_EVENT_TYPE_LABELS[eventType];
}

export function getWorldEventSourceLabel(kind: WorldEventSourceKind): string {
  return WORLD_EVENT_SOURCE_LABELS[kind];
}

export function getWorldEventConfidenceLabel(confidence: WorldEventConfidence): string {
  return confidence === 'unknown' ? 'unknown confidence' : `${confidence} confidence`;
}

export function worldEventToChronicleEntry(event: WorldEvent): WorldEventChronicleEntry {
  const sourceLabel = event.source.label || getWorldEventSourceLabel(event.source.kind);
  const evidenceLabels = event.evidence.map((evidence) => evidence.label || evidence.sourceLabel || evidence.type);

  return {
    id: `world-event:${event.id}`,
    kind: getWorldEventChronicleKind(event.eventType),
    occurredAt: event.occurredAt,
    title: getWorldEventChronicleTitle(event),
    detail: event.summary,
    actorName: event.relatedGuilds[0] ?? event.relatedPlayers[0] ?? event.relatedCharacters[0],
    memoryRecordId: event.relatedMemories[0],
    confidence: toChronicleConfidence(event.confidence),
    sourceLabel,
    worldEventId: event.id,
    discoveredAt: event.discoveredAt,
    significance: event.significance,
    sourceKind: event.source.kind,
    evidenceCount: event.evidence.length,
    evidenceLabels,
    relatedMemories: event.relatedMemories,
    relatedPlayers: event.relatedPlayers,
    relatedGuilds: event.relatedGuilds,
    relatedCharacters: event.relatedCharacters
  };
}

export function worldEventsToChronicleEntries(events: WorldEvent[]): WorldEventChronicleEntry[] {
  return events
    .map(worldEventToChronicleEntry)
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
}

export const worldEventPreviewEvents: WorldEvent[] = [{
  id: 'preview:valheim:elder-defeated',
  worldId: 'preview-valheim-world',
  eventType: 'boss_defeated',
  title: 'Elder defeated',
  summary: 'A major world event was recorded with source attribution and evidence references.',
  occurredAt: '2026-07-01T20:30:00.000Z',
  discoveredAt: '2026-07-01T20:31:00.000Z',
  confidence: 'medium',
  significance: 'major',
  source: {
    kind: 'manual_operator_entry',
    label: 'Manual Operator Entry'
  },
  evidence: [{
    id: 'preview:evidence:operator-note',
    type: 'operator_note',
    label: 'Operator note',
    sourceLabel: 'Development preview',
    observedAt: '2026-07-01T20:31:00.000Z',
    metadata: {}
  }],
  relatedEvents: [],
  relatedMemories: ['memory:preview:elder'],
  relatedPlayers: [],
  relatedGuilds: [],
  relatedCharacters: [],
  metadata: {
    previewOnly: true
  }
}, {
  id: 'preview:palworld:guild-created',
  worldId: 'preview-palworld-world',
  eventType: 'guild_created',
  title: 'Iron Wolves guild',
  summary: 'The Iron Wolves guild was founded from trusted world memory evidence.',
  occurredAt: '2026-07-01T18:15:00.000Z',
  discoveredAt: '2026-07-01T18:16:00.000Z',
  confidence: 'medium',
  significance: 'normal',
  source: {
    kind: 'world_memory',
    label: 'World Memory'
  },
  evidence: [{
    id: 'preview:evidence:guild-memory',
    type: 'memory_record',
    label: 'Guild memory record',
    sourceLabel: 'Development preview',
    observedAt: '2026-07-01T18:16:00.000Z',
    metadata: {}
  }],
  relatedEvents: [],
  relatedMemories: ['memory:preview:guild'],
  relatedPlayers: [],
  relatedGuilds: ['guild:preview'],
  relatedCharacters: [],
  metadata: {
    previewOnly: true
  }
}];
