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

export interface WorldEventSelectionOptions {
  maxEvents?: number;
}

export interface SelectedWorldEvents {
  events: WorldEvent[];
  totalEvents: number;
}

export interface WorldHistoryTimelineGroup {
  label: 'Today' | 'Yesterday' | 'This week' | 'Earlier history';
  entries: WorldEventChronicleEntry[];
}

export interface WorldHistoryState {
  kind: 'empty' | 'preview' | 'quiet' | 'active';
  title: string;
  detail: string;
}

export type WorldHistoryFilter = 'all' | 'meaningful' | 'quiet' | 'high-confidence';

export interface WorldHistoryFilterCount {
  filter: WorldHistoryFilter;
  count: number;
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

function getSignificanceScore(significance: WorldEventSignificance): number {
  switch (significance) {
    case 'historic':
      return 1_000;
    case 'major':
      return 700;
    case 'normal':
      return 400;
    case 'minor':
      return 100;
  }
}

function getConfidenceScore(confidence: WorldEventConfidence): number {
  switch (confidence) {
    case 'high':
      return 180;
    case 'medium':
      return 100;
    case 'low':
      return 20;
    case 'unknown':
      return 0;
  }
}

function getSourceChronicleKind(event: WorldEvent): WorldChronicleEventKind | null {
  return typeof event.metadata.sourceChronicleKind === 'string'
    ? event.metadata.sourceChronicleKind as WorldChronicleEventKind
    : null;
}

function getChronicleKindRelevanceScore(kind: WorldChronicleEventKind | null): number {
  switch (kind) {
    case 'base_lifecycle':
      return 260;
    case 'guild_quiet':
      return 230;
    case 'imported_character':
      return 220;
    case 'world_event':
      return 120;
    case 'guild_active':
      return 80;
    case 'restart':
      return -180;
    case 'arrival':
    case 'return':
    case 'join':
    case 'leave':
      return -120;
    case null:
      return 0;
  }
}

function getEventTypeRelevanceScore(eventType: WorldEventType): number {
  switch (eventType) {
    case 'boss_defeated':
      return 280;
    case 'settlement_founded':
    case 'guild_created':
    case 'base_abandoned':
      return 180;
    case 'trader_discovered':
    case 'portal_network_expanded':
    case 'expedition_launched':
      return 140;
    case 'community_milestone':
      return 120;
    case 'world_state_changed':
    case 'custom':
      return 0;
  }
}

function getDuplicateFeelingKey(event: WorldEvent): string {
  const occurredDate = event.occurredAt.slice(0, 10);
  const subject = event.relatedMemories[0] ?? event.relatedGuilds[0] ?? event.relatedCharacters[0] ?? event.relatedPlayers[0] ?? event.title;
  return [
    event.source.kind,
    event.source.referenceId ? '' : event.source.label,
    event.eventType,
    subject.toLowerCase(),
    event.title.toLowerCase(),
    occurredDate
  ].join('|');
}

export function scoreWorldEventRelevance(event: WorldEvent): number {
  const evidenceScore = Math.min(event.evidence.length, 3) * 50;
  const relatedHistoryScore = event.relatedMemories.length > 0 ? 90 : 0;
  const relatedEntityScore = (
    event.relatedGuilds.length > 0
    || event.relatedCharacters.length > 0
    || event.relatedPlayers.length > 0
  ) ? 40 : 0;

  return getSignificanceScore(event.significance)
    + getConfidenceScore(event.confidence)
    + evidenceScore
    + relatedHistoryScore
    + relatedEntityScore
    + getEventTypeRelevanceScore(event.eventType)
    + getChronicleKindRelevanceScore(getSourceChronicleKind(event));
}

export function getWorldEventRelevanceLabel(event: WorldEvent): string {
  const score = scoreWorldEventRelevance(event);

  if (event.significance === 'historic' || score >= 1_000) {
    return 'Historic history';
  }

  if (event.significance === 'major' || score >= 750) {
    return 'Major history';
  }

  if (score >= 500) {
    return 'Meaningful history';
  }

  return 'Quiet history';
}

export function getWorldHistoryState(events: WorldEvent[], previewFallback = false): WorldHistoryState {
  if (previewFallback) {
    return {
      kind: 'preview',
      title: 'Development preview',
      detail: 'Preview events show how World History will look. They are replaced whenever trusted Chronicle or World Memory records exist.'
    };
  }

  if (events.length === 0) {
    return {
      kind: 'empty',
      title: 'No trusted history yet',
      detail: 'World History appears after trusted Chronicle or World Memory records exist.'
    };
  }

  const onlyQuietHistory = events.every((event) => (
    getWorldEventRelevanceLabel(event) === 'Quiet history'
    || event.confidence === 'low'
    || event.confidence === 'unknown'
  ));

  if (onlyQuietHistory) {
    return {
      kind: 'quiet',
      title: 'Only quiet history is available right now',
      detail: 'Routine returns, restarts, or thin records are kept visible, but major history needs stronger evidence.'
    };
  }

  return {
    kind: 'active',
    title: 'Trusted history is available',
    detail: 'Showing trusted events from Chronicle and World Memory.'
  };
}

export function filterWorldHistoryEvents(events: WorldEvent[], filter: WorldHistoryFilter): WorldEvent[] {
  switch (filter) {
    case 'all':
      return events.slice();
    case 'meaningful':
      return events.filter((event) => {
        const relevanceLabel = getWorldEventRelevanceLabel(event);
        return event.significance === 'major'
          || event.significance === 'historic'
          || relevanceLabel === 'Meaningful history'
          || relevanceLabel === 'Major history'
          || relevanceLabel === 'Historic history';
      });
    case 'quiet':
      return events.filter((event) => getWorldEventRelevanceLabel(event) === 'Quiet history');
    case 'high-confidence':
      return events.filter((event) => event.confidence === 'high');
  }
}

export function getWorldHistoryFilterCounts(events: WorldEvent[]): WorldHistoryFilterCount[] {
  return [
    { filter: 'all', count: filterWorldHistoryEvents(events, 'all').length },
    { filter: 'meaningful', count: filterWorldHistoryEvents(events, 'meaningful').length },
    { filter: 'quiet', count: filterWorldHistoryEvents(events, 'quiet').length },
    { filter: 'high-confidence', count: filterWorldHistoryEvents(events, 'high-confidence').length }
  ];
}

export function selectChronicleWorldEvents(
  events: WorldEvent[],
  options: WorldEventSelectionOptions = {}
): SelectedWorldEvents {
  const maxEvents = options.maxEvents ?? 6;
  const rankedEvents = events
    .map((event, index) => ({ event, index, relevance: scoreWorldEventRelevance(event) }))
    .sort((left, right) => {
      if (right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }

      const occurredDelta = Date.parse(right.event.occurredAt) - Date.parse(left.event.occurredAt);
      if (occurredDelta !== 0) {
        return occurredDelta;
      }

      const discoveredDelta = Date.parse(right.event.discoveredAt) - Date.parse(left.event.discoveredAt);
      if (discoveredDelta !== 0) {
        return discoveredDelta;
      }

      const idDelta = left.event.id.localeCompare(right.event.id);
      return idDelta !== 0 ? idDelta : left.index - right.index;
    });

  if (maxEvents <= 0) {
    return {
      events: [],
      totalEvents: events.length
    };
  }

  const selectedEvents: WorldEvent[] = [];
  const seenDuplicateKeys = new Set<string>();

  for (const ranked of rankedEvents) {
    const duplicateKey = getDuplicateFeelingKey(ranked.event);

    if (seenDuplicateKeys.has(duplicateKey)) {
      continue;
    }

    selectedEvents.push(ranked.event);
    seenDuplicateKeys.add(duplicateKey);

    if (selectedEvents.length >= maxEvents) {
      break;
    }
  }

  if (selectedEvents.length < Math.min(maxEvents, events.length)) {
    for (const ranked of rankedEvents) {
      if (selectedEvents.some((event) => event.id === ranked.event.id)) {
        continue;
      }

      selectedEvents.push(ranked.event);

      if (selectedEvents.length >= maxEvents) {
        break;
      }
    }
  }

  return {
    events: selectedEvents,
    totalEvents: events.length
  };
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

function getUtcDayStart(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function getTimelineGroupLabel(occurredAt: string, now: Date): WorldHistoryTimelineGroup['label'] {
  const occurredDay = getUtcDayStart(new Date(occurredAt));
  const today = getUtcDayStart(now);
  const dayDelta = Math.floor((today - occurredDay) / 86_400_000);

  if (dayDelta <= 0) {
    return 'Today';
  }

  if (dayDelta === 1) {
    return 'Yesterday';
  }

  if (dayDelta <= 6) {
    return 'This week';
  }

  return 'Earlier history';
}

export function groupWorldHistoryTimelineEntries(
  entries: WorldEventChronicleEntry[],
  now = new Date()
): WorldHistoryTimelineGroup[] {
  const groups: WorldHistoryTimelineGroup[] = [];

  for (const entry of entries) {
    const label = getTimelineGroupLabel(entry.occurredAt, now);
    let group = groups.find((candidate) => candidate.label === label);

    if (!group) {
      group = { label, entries: [] };
      groups.push(group);
    }

    group.entries.push(entry);
  }

  return groups;
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
