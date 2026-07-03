import type {
  WorldEvent,
  WorldEventConfidence,
  WorldEventSignificance,
  WorldEventSourceKind,
  WorldEventType
} from '@gameops/shared';

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

function compareWorldEvents(left: WorldEvent, right: WorldEvent): number {
  const occurredDelta = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);

  if (occurredDelta !== 0) {
    return occurredDelta;
  }

  return Date.parse(right.discoveredAt) - Date.parse(left.discoveredAt);
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

export const worldEventPreviewEvents: WorldEvent[] = [{
  id: 'preview:valheim:elder-defeated',
  worldId: 'preview-valheim-world',
  eventType: 'boss_defeated',
  title: 'Elder defeated',
  summary: 'A major progression event recorded with source attribution and evidence references.',
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
  title: 'New guild created',
  summary: 'A community-level world event that can later connect to guild, player, and memory records.',
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
