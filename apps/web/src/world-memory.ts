import type {
  NormalizedEvent,
  PalworldGuildActivityEntry,
  PalworldGuildActivityMember,
  PlayerEngagementSummary,
  PlayerIntelligenceRecord
} from '@gameops/shared';

export type WorldMemoryRecordType =
  | 'person'
  | 'character'
  | 'guild'
  | 'base'
  | 'world_event'
  | 'settlement'
  | 'boss'
  | 'village'
  | 'clan';

export type WorldMemoryConfidence = 'unknown' | 'low' | 'medium' | 'high';
export type WorldMemoryStatus = 'online' | 'offline' | 'active' | 'quiet' | 'watch' | 'risk' | 'unknown';

export type WorldMemoryRelationshipType =
  | 'player_character'
  | 'character_realm'
  | 'guild_member'
  | 'guild_base'
  | 'base_world'
  | 'event_subject';

export interface WorldMemoryRelationship {
  id: string;
  type: WorldMemoryRelationshipType;
  fromRecordId: string;
  toRecordId: string;
  confidence: WorldMemoryConfidence;
  sourceLabel: string;
}

export interface WorldMemoryChronicleReference {
  chronicleEventId: string;
  occurredAt: string;
  sourceLabel: string;
}

export interface WorldMemoryRecord {
  id: string;
  serverId: string;
  displayName: string;
  type: WorldMemoryRecordType;
  game: 'valheim' | 'palworld';
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  currentStatus: WorldMemoryStatus;
  confidence: WorldMemoryConfidence;
  chronicleReferences: WorldMemoryChronicleReference[];
  relationships: WorldMemoryRelationship[];
  sourceLabel: string;
  metadata: Record<string, unknown>;
}

export type WorldChronicleEventKind =
  | 'arrival'
  | 'return'
  | 'join'
  | 'leave'
  | 'restart'
  | 'imported_character'
  | 'guild_active'
  | 'guild_quiet'
  | 'base_lifecycle';

export interface WorldChronicleEvent {
  id: string;
  kind: WorldChronicleEventKind;
  occurredAt: string;
  title: string;
  detail?: string;
  actorName?: string;
  memoryRecordId?: string;
  confidence: 'low' | 'medium' | 'high';
  sourceLabel: string;
}

export interface ImportedCharacterSignal {
  detected: boolean;
  label: string;
  confidence: 'medium' | 'high';
  evidence: string;
}

export interface ValheimCharacterEntry {
  id: string;
  name: string;
  isOnline: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  sessionCount: number;
  totalTrackedSeconds: number;
  identityConfidence: PlayerIntelligenceRecord['identityConfidence'];
  identityExplanation: string;
  importedCharacter: ImportedCharacterSignal | null;
}

export interface GuildConfidence {
  trackedCount: number;
  totalCount: number;
  label: string;
  shortLabel: string;
  tone: 'low' | 'partial' | 'medium' | 'high';
}

export interface PalworldGuildIntelligence {
  guild: PalworldGuildActivityEntry;
  confidence: GuildConfidence;
  activeMemberCount: number;
  activityState: string;
  lifecycleState: string;
  lifecycleDetail: string;
  memoryRecordId: string;
}

export interface WorldMemoryDetailModel {
  record: WorldMemoryRecord;
  relationships: WorldMemoryRelationship[];
  chronicleEvents: WorldChronicleEvent[];
}

export interface WorldMemoryRegistry {
  serverId: string;
  records: WorldMemoryRecord[];
  relationships: WorldMemoryRelationship[];
  chronicleEvents: WorldChronicleEvent[];
  getRecord: (recordId: string) => WorldMemoryRecord | null;
  getRecordsByType: (type: WorldMemoryRecordType) => WorldMemoryRecord[];
  getChronicleForRecord: (recordId: string) => WorldChronicleEvent[];
  getDetail: (recordId: string) => WorldMemoryDetailModel | null;
}

export function searchWorldMemoryRecords(
  records: WorldMemoryRecord[],
  query: string,
  game: WorldMemoryRecord['game']
): WorldMemoryRecord[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return records
    .filter((record) => record.game === game)
    .map((record) => {
      const typeLabel = record.type.replace(/_/g, ' ');
      const searchableText = [
        record.displayName,
        typeLabel,
        record.currentStatus,
        record.sourceLabel
      ].join(' ').toLowerCase();
      const name = record.displayName.toLowerCase();
      const type = typeLabel.toLowerCase();

      if (!searchableText.includes(normalizedQuery)) {
        return null;
      }

      const score = name === normalizedQuery
        ? 0
        : name.startsWith(normalizedQuery)
          ? 1
          : type.includes(normalizedQuery)
            ? 2
            : 3;

      return { record, score };
    })
    .filter((result): result is { record: WorldMemoryRecord; score: number } => result !== null)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      const leftLastSeen = Date.parse(left.record.lastSeenAt ?? left.record.firstSeenAt ?? '');
      const rightLastSeen = Date.parse(right.record.lastSeenAt ?? right.record.firstSeenAt ?? '');

      if (!Number.isNaN(leftLastSeen) && !Number.isNaN(rightLastSeen) && leftLastSeen !== rightLastSeen) {
        return rightLastSeen - leftLastSeen;
      }

      return left.record.displayName.localeCompare(right.record.displayName);
    })
    .map((result) => result.record);
}

interface MemoryKnownPlayer {
  displayName: string;
  normalizedPlayerKey: string;
  confidence: 'low' | 'medium' | 'high';
  firstSeenAt: string;
  lastSeenAt: string;
  observationCount: number;
}

interface ValheimMemoryInput {
  serverId: string;
  playerIntelligence: PlayerIntelligenceRecord[];
  playerEngagement: PlayerEngagementSummary;
  knownPlayers: MemoryKnownPlayer[];
  recentEvents: NormalizedEvent[];
}

interface PalworldMemoryInput {
  serverId: string;
  guildActivity: PalworldGuildActivityEntry[];
}

export interface WorldMemoryInput {
  serverId: string;
  valheim?: ValheimMemoryInput;
  palworld?: PalworldMemoryInput;
}

export function createWorldMemoryRegistry(input: WorldMemoryInput): WorldMemoryRegistry {
  const records = new Map<string, WorldMemoryRecord>();
  const relationships = new Map<string, WorldMemoryRelationship>();
  const chronicleEvents = new Map<string, WorldChronicleEvent>();

  const addRecord = (record: WorldMemoryRecord): void => {
    records.set(record.id, record);
  };
  const addRelationship = (relationship: WorldMemoryRelationship): void => {
    relationships.set(relationship.id, relationship);
  };
  const addChronicleEvent = (event: WorldChronicleEvent): void => {
    chronicleEvents.set(event.id, event);
  };

  if (input.valheim) {
    addValheimMemory(input.valheim, addRecord, addRelationship, addChronicleEvent);
  }

  if (input.palworld) {
    addPalworldMemory(input.palworld, addRecord, addRelationship, addChronicleEvent);
  }

  const allRelationships = [...relationships.values()];
  const allChronicleEvents = [...chronicleEvents.values()]
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  const allRecords = [...records.values()].map((record) => ({
    ...record,
    relationships: allRelationships.filter((relationship) => relationship.fromRecordId === record.id || relationship.toRecordId === record.id),
    chronicleReferences: allChronicleEvents
      .filter((event) => event.memoryRecordId === record.id)
      .map((event) => ({
        chronicleEventId: event.id,
        occurredAt: event.occurredAt,
        sourceLabel: event.sourceLabel
      }))
  }));
  const recordMap = new Map(allRecords.map((record) => [record.id, record]));

  return {
    serverId: input.serverId,
    records: allRecords,
    relationships: allRelationships,
    chronicleEvents: allChronicleEvents,
    getRecord: (recordId) => recordMap.get(recordId) ?? null,
    getRecordsByType: (type) => allRecords.filter((record) => record.type === type),
    getChronicleForRecord: (recordId) => allChronicleEvents.filter((event) => event.memoryRecordId === recordId),
    getDetail: (recordId) => {
      const record = recordMap.get(recordId);

      if (!record) {
        return null;
      }

      return {
        record,
        relationships: allRelationships.filter((relationship) => relationship.fromRecordId === recordId || relationship.toRecordId === recordId),
        chronicleEvents: allChronicleEvents.filter((event) => event.memoryRecordId === recordId)
      };
    }
  };
}

export function getValheimCharactersFromMemory(registry: WorldMemoryRegistry): ValheimCharacterEntry[] {
  return registry.getRecordsByType('character')
    .filter((record) => record.game === 'valheim')
    .map((record) => ({
      id: String(record.metadata.playerId ?? record.id),
      name: record.displayName,
      isOnline: record.currentStatus === 'online',
      firstSeenAt: record.firstSeenAt,
      lastSeenAt: record.lastSeenAt,
      sessionCount: Number(record.metadata.sessionCount ?? 0),
      totalTrackedSeconds: Number(record.metadata.totalTrackedSeconds ?? 0),
      identityConfidence: coercePlayerConfidence(record.confidence),
      identityExplanation: String(record.metadata.identityExplanation ?? 'Trusted session and identity observations for this realm.'),
      importedCharacter: record.metadata.importedCharacter as ImportedCharacterSignal | null
    }));
}

export function getPalworldGuildIntelligenceFromMemory(registry: WorldMemoryRegistry): PalworldGuildIntelligence[] {
  return registry.getRecordsByType('guild')
    .filter((record) => record.game === 'palworld')
    .map((record) => ({
      guild: record.metadata.guild as PalworldGuildActivityEntry,
      confidence: record.metadata.confidence as GuildConfidence,
      activeMemberCount: Number(record.metadata.activeMemberCount ?? 0),
      activityState: String(record.metadata.activityState ?? 'Activity unknown'),
      lifecycleState: String(record.metadata.lifecycleState ?? 'Evidence needed'),
      lifecycleDetail: String(record.metadata.lifecycleDetail ?? 'More trusted activity is needed before lifecycle state can be shown.'),
      memoryRecordId: record.id
    }));
}

function addValheimMemory(
  input: ValheimMemoryInput,
  addRecord: (record: WorldMemoryRecord) => void,
  addRelationship: (relationship: WorldMemoryRelationship) => void,
  addChronicleEvent: (event: WorldChronicleEvent) => void
): void {
  const worldRecordId = worldId(input.serverId);
  addRecord({
    id: worldRecordId,
    serverId: input.serverId,
    displayName: 'Valheim realm',
    type: 'world_event',
    game: 'valheim',
    firstSeenAt: null,
    lastSeenAt: null,
    currentStatus: 'unknown',
    confidence: 'medium',
    chronicleReferences: [],
    relationships: [],
    sourceLabel: 'Selected world',
    metadata: {}
  });

  const characterRecords = input.playerIntelligence.map((player) => {
    const importedCharacter = getImportedCharacterSignal(player);
    const recordId = characterId(input.serverId, player.playerId);
    const record: WorldMemoryRecord = {
      id: recordId,
      serverId: input.serverId,
      displayName: player.displayName,
      type: 'character',
      game: 'valheim',
      firstSeenAt: player.firstSeenAt,
      lastSeenAt: player.lastSeenAt,
      currentStatus: player.isOnline ? 'online' : 'offline',
      confidence: player.identityConfidence,
      chronicleReferences: [],
      relationships: [],
      sourceLabel: 'Players',
      metadata: {
        playerId: player.playerId,
        sessionCount: player.sessionCount,
        totalTrackedSeconds: player.totalTrackedSeconds,
        identityExplanation: player.identityExplanation,
        importedCharacter
      }
    };

    addRecord(record);
    addRelationship({
      id: `relationship:${recordId}:realm:${input.serverId}`,
      type: 'character_realm',
      fromRecordId: recordId,
      toRecordId: worldRecordId,
      confidence: player.identityConfidence,
      sourceLabel: 'Players'
    });

    return { player, record, importedCharacter };
  });

  for (const player of input.playerEngagement.returningPlayers.slice(0, 6)) {
    if (!player.lastSeenAt) {
      continue;
    }

    addChronicleEvent({
      id: `return:${player.playerId}:${player.lastSeenAt}`,
      kind: 'return',
      occurredAt: player.lastSeenAt,
      title: `${player.displayName} returned to the realm.`,
      detail: player.reason,
      actorName: player.displayName,
      memoryRecordId: characterId(input.serverId, player.playerId),
      confidence: player.confidence === 'unknown' ? 'low' : player.confidence,
      sourceLabel: 'Players'
    });
  }

  for (const player of input.knownPlayers.slice(0, 12)) {
    addChronicleEvent({
      id: `arrival:${player.normalizedPlayerKey}:${player.firstSeenAt}`,
      kind: 'arrival',
      occurredAt: player.firstSeenAt,
      title: `${player.displayName} entered the realm.`,
      detail: player.observationCount > 1
        ? `${player.observationCount} trusted observations have been recorded.`
        : 'First trusted identity observation for this world.',
      actorName: player.displayName,
      memoryRecordId: characterId(input.serverId, player.normalizedPlayerKey),
      confidence: player.confidence,
      sourceLabel: 'Known Players'
    });
  }

  for (const event of input.recentEvents) {
    if (event.eventType === 'PLAYER_JOIN') {
      const playerName = event.playerName ?? 'A new adventurer';
      addChronicleEvent({
        id: `join:${event.id ?? event.occurredAt}:${playerName}`,
        kind: 'join',
        occurredAt: event.occurredAt,
        title: `${playerName} entered the realm.`,
        detail: event.raw?.valheimCurrentPlayerCount !== undefined
          ? `${event.raw.valheimCurrentPlayerCount} player${event.raw.valheimCurrentPlayerCount === 1 ? '' : 's'} online after this arrival.`
          : undefined,
        actorName: playerName,
        memoryRecordId: characterId(input.serverId, playerName),
        confidence: event.platformId ? 'high' : 'medium',
        sourceLabel: 'Trusted event'
      });
    }

    if (event.eventType === 'PLAYER_LEAVE') {
      const playerName = event.playerName ?? 'An adventurer';
      const sessionDuration = typeof event.raw?.sessionDurationSeconds === 'number'
        ? formatDurationFromSeconds(event.raw.sessionDurationSeconds)
        : null;
      addChronicleEvent({
        id: `leave:${event.id ?? event.occurredAt}:${playerName}`,
        kind: 'leave',
        occurredAt: event.occurredAt,
        title: sessionDuration ? `${playerName} explored for ${sessionDuration}.` : `${playerName} left the realm.`,
        actorName: playerName,
        memoryRecordId: characterId(input.serverId, playerName),
        confidence: event.platformId ? 'high' : 'medium',
        sourceLabel: 'Trusted event'
      });
    }

    if (event.eventType === 'SERVER_RESTARTING' || event.eventType === 'SERVER_ONLINE') {
      addChronicleEvent({
        id: `server:${event.eventType}:${event.id ?? event.occurredAt}`,
        kind: 'restart',
        occurredAt: event.occurredAt,
        title: event.eventType === 'SERVER_RESTARTING' ? 'The world began restarting.' : 'The world came online.',
        detail: event.message,
        memoryRecordId: worldRecordId,
        confidence: 'high',
        sourceLabel: 'Server event'
      });
    }
  }

  for (const { player, record, importedCharacter } of characterRecords) {
    if (!importedCharacter || !record.lastSeenAt) {
      continue;
    }

    addChronicleEvent({
      id: `imported:${player.playerId}:${record.lastSeenAt}`,
      kind: 'imported_character',
      occurredAt: record.lastSeenAt,
      title: `${record.displayName} appears to have entered this realm with existing progression.`,
      detail: importedCharacter.evidence,
      actorName: record.displayName,
      memoryRecordId: record.id,
      confidence: importedCharacter.confidence,
      sourceLabel: 'Character metadata'
    });
  }
}

function addPalworldMemory(
  input: PalworldMemoryInput,
  addRecord: (record: WorldMemoryRecord) => void,
  addRelationship: (relationship: WorldMemoryRelationship) => void,
  addChronicleEvent: (event: WorldChronicleEvent) => void
): void {
  const worldRecordId = worldId(input.serverId);
  addRecord({
    id: worldRecordId,
    serverId: input.serverId,
    displayName: 'Palworld archipelago',
    type: 'world_event',
    game: 'palworld',
    firstSeenAt: null,
    lastSeenAt: null,
    currentStatus: 'unknown',
    confidence: 'medium',
    chronicleReferences: [],
    relationships: [],
    sourceLabel: 'Selected world',
    metadata: {}
  });

  for (const guild of input.guildActivity) {
    const recordId = guildId(input.serverId, guild.guildName);
    const confidence = getGuildConfidence(guild.members, guild.memberCount);
    const activeMemberCount = guild.members.filter((member) => member.daysSinceSeen !== null && member.daysSinceSeen <= 7).length;
    const lifecycle = getPalworldBaseLifecycleState(guild);
    const record: WorldMemoryRecord = {
      id: recordId,
      serverId: input.serverId,
      displayName: guild.guildName,
      type: 'guild',
      game: 'palworld',
      firstSeenAt: getEarliestMemberActivity(guild.members),
      lastSeenAt: guild.lastMemberSeenAt,
      currentStatus: getPalworldMemoryStatus(guild),
      confidence: guildConfidenceToMemoryConfidence(confidence),
      chronicleReferences: [],
      relationships: [],
      sourceLabel: 'Guild activity',
      metadata: {
        guild,
        confidence,
        activeMemberCount,
        activityState: getPalworldGuildActivityState(guild),
        lifecycleState: lifecycle.state,
        lifecycleDetail: lifecycle.detail
      }
    };

    addRecord(record);
    addRelationship({
      id: `relationship:${recordId}:world:${input.serverId}`,
      type: 'event_subject',
      fromRecordId: recordId,
      toRecordId: worldRecordId,
      confidence: record.confidence,
      sourceLabel: 'Guild activity'
    });

    for (const member of guild.members) {
      if (!member.matched) {
        continue;
      }

      const memberRecordId = personId(input.serverId, member.matchedPlayerName ?? member.memberName);
      addRecord({
        id: memberRecordId,
        serverId: input.serverId,
        displayName: member.matchedPlayerName ?? member.memberName,
        type: 'person',
        game: 'palworld',
        firstSeenAt: null,
        lastSeenAt: member.lastSeenAt,
        currentStatus: member.daysSinceSeen !== null && member.daysSinceSeen <= 7 ? 'active' : 'quiet',
        confidence: 'medium',
        chronicleReferences: [],
        relationships: [],
        sourceLabel: 'Guild member activity',
        metadata: { member }
      });
      addRelationship({
        id: `relationship:${memberRecordId}:guild:${recordId}`,
        type: 'guild_member',
        fromRecordId: recordId,
        toRecordId: memberRecordId,
        confidence: 'medium',
        sourceLabel: 'Guild member activity'
      });
    }

    if (guild.lastMemberSeenAt) {
      addChronicleEvent({
        id: `guild-active:${guild.guildName}:${guild.lastMemberSeenAt}`,
        kind: 'guild_active',
        occurredAt: guild.lastMemberSeenAt,
        title: `${guild.guildName} showed activity.`,
        detail: guild.lastSeenMemberName ? `${guild.lastSeenMemberName} was the most recently seen member.` : undefined,
        actorName: guild.guildName,
        memoryRecordId: recordId,
        confidence: confidence.tone === 'high' ? 'high' : 'medium',
        sourceLabel: 'Guild activity'
      });
    }

    if (guild.lastMemberSeenAt && (guild.riskLevel === 'watch' || guild.riskLevel === 'risk' || guild.riskLevel === 'expired')) {
      addChronicleEvent({
        id: `base-lifecycle:${guild.guildName}:${guild.riskLevel}:${guild.lastMemberSeenAt}`,
        kind: guild.riskLevel === 'watch' ? 'guild_quiet' : 'base_lifecycle',
        occurredAt: guild.lastMemberSeenAt,
        title: `${guild.guildName} is ${lifecycle.state.toLowerCase()}.`,
        detail: lifecycle.detail,
        actorName: guild.guildName,
        memoryRecordId: recordId,
        confidence: 'medium',
        sourceLabel: '30-day base lifecycle'
      });
    }
  }
}

export function getGuildConfidence(members: PalworldGuildActivityMember[], memberCountFallback: number): GuildConfidence {
  const trackedCount = members.filter((member) => member.matched).length;
  const totalCount = members.length > 0 ? members.length : memberCountFallback;
  const ratio = totalCount > 0 ? trackedCount / totalCount : 0;

  if (trackedCount === 0) {
    return {
      trackedCount,
      totalCount,
      label: 'Low confidence',
      shortLabel: 'Low',
      tone: 'low'
    };
  }

  if (ratio < 0.5) {
    return {
      trackedCount,
      totalCount,
      label: 'Partial confidence',
      shortLabel: 'Partial',
      tone: 'partial'
    };
  }

  if (ratio < 1) {
    return {
      trackedCount,
      totalCount,
      label: 'Medium confidence',
      shortLabel: 'Medium',
      tone: 'medium'
    };
  }

  return {
    trackedCount,
    totalCount,
    label: 'High confidence',
    shortLabel: 'High',
    tone: 'high'
  };
}

export function getPalworldGuildActivityState(guild: PalworldGuildActivityEntry): string {
  switch (guild.riskLevel) {
    case 'active':
      return 'Alive';
    case 'watch':
      return 'Quiet';
    case 'risk':
      return 'Monitoring';
    case 'expired':
      return 'Near inactivity threshold';
    case 'unknown':
      return 'Activity unknown';
  }
}

export function getPalworldBaseLifecycleState(guild: PalworldGuildActivityEntry): { state: string; detail: string } {
  if (guild.daysInactive === null || guild.daysUntilPalboxRisk === null) {
    return {
      state: 'Evidence needed',
      detail: 'Base lifecycle cannot be estimated until this guild has matched member activity.'
    };
  }

  if (guild.riskLevel === 'expired') {
    return {
      state: 'Near inactivity threshold',
      detail: `No matched member activity for ${guild.daysInactive} days. The server uses a 30-day base deletion setting.`
    };
  }

  if (guild.riskLevel === 'risk') {
    return {
      state: 'Monitoring',
      detail: `${guild.daysUntilPalboxRisk} days remain before the 30-day inactivity window is reached.`
    };
  }

  if (guild.riskLevel === 'watch') {
    return {
      state: 'Quiet',
      detail: `${guild.daysInactive} days since matched member activity. Keep watching this guild.`
    };
  }

  return {
    state: 'Healthy',
    detail: `Matched member activity was seen ${guild.daysInactive} days ago.`
  };
}

function readGameField(fields: Record<string, unknown> | undefined, keys: string[]): unknown {
  if (!fields) {
    return undefined;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      return fields[key];
    }
  }

  return undefined;
}

function isTruthyField(value: unknown): boolean {
  if (value === true) {
    return true;
  }

  if (typeof value === 'string') {
    return ['true', 'yes', 'imported', 'external', 'existing_progression'].includes(value.trim().toLowerCase());
  }

  return false;
}

function getImportedCharacterSignal(player: PlayerIntelligenceRecord): ImportedCharacterSignal | null {
  const gameFields = player.gameFields;
  const explicitImportFlag = readGameField(gameFields, [
    'importedCharacter',
    'imported_character',
    'appearsImported',
    'appears_imported',
    'existingProgression',
    'existing_progression'
  ]);
  const progressionSource = readGameField(gameFields, ['progressionSource', 'progression_source', 'characterSource', 'character_source']);
  const evidence = readGameField(gameFields, ['importEvidence', 'import_evidence', 'progressionEvidence', 'progression_evidence']);

  /*
   * Imported Character Detection V1 is deliberately conservative.
   * World Memory only records this owner-awareness signal when trusted upstream
   * data already exposes an explicit import/progression flag or source.
   */
  if (isTruthyField(explicitImportFlag) || isTruthyField(progressionSource)) {
    return {
      detected: true,
      label: 'Imported character detected',
      confidence: explicitImportFlag === true ? 'high' : 'medium',
      evidence: typeof evidence === 'string' && evidence.trim() !== ''
        ? evidence
        : 'Trusted character metadata marks this player as entering with existing progression.'
    };
  }

  return null;
}

function characterId(serverId: string, value: string): string {
  return `memory:${serverId}:character:${normalizeMemoryKey(value)}`;
}

function guildId(serverId: string, value: string): string {
  return `memory:${serverId}:guild:${normalizeMemoryKey(value)}`;
}

function personId(serverId: string, value: string): string {
  return `memory:${serverId}:person:${normalizeMemoryKey(value)}`;
}

function worldId(serverId: string): string {
  return `memory:${serverId}:world`;
}

function normalizeMemoryKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function coercePlayerConfidence(confidence: WorldMemoryConfidence): PlayerIntelligenceRecord['identityConfidence'] {
  if (confidence === 'unknown') {
    return 'unknown';
  }

  return confidence;
}

function guildConfidenceToMemoryConfidence(confidence: GuildConfidence): WorldMemoryConfidence {
  if (confidence.tone === 'high') {
    return 'high';
  }

  if (confidence.tone === 'medium') {
    return 'medium';
  }

  return 'low';
}

function getPalworldMemoryStatus(guild: PalworldGuildActivityEntry): WorldMemoryStatus {
  switch (guild.riskLevel) {
    case 'active':
      return 'active';
    case 'watch':
      return 'watch';
    case 'risk':
    case 'expired':
      return 'risk';
    case 'unknown':
      return 'unknown';
  }
}

function getEarliestMemberActivity(members: PalworldGuildActivityMember[]): string | null {
  const sorted = members
    .map((member) => member.lastSeenAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.localeCompare(right));

  return sorted[0] ?? null;
}

function formatDurationFromSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}
