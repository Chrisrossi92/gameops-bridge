import {
  playerIntelligenceRecordSchema,
  playerIntelligenceResponseSchema,
  type GameKey,
  type KnownPlayerRecord,
  type PalworldPlayerProfileSessionSummary,
  type PlayerIntelligenceConfidence,
  type PlayerIntelligenceRecord,
  type PlayerIntelligenceResponse,
  type SessionRecord
} from '@gameops/shared';
import { getActiveSessionsForServer, getRecentClosedSessionsForServer } from './event-store.js';
import { getKnownPlayersForServer } from './known-player-store.js';
import { getPalworldPlayerProfileSessionSummariesForServer } from './palworld-player-profile.js';
import {
  hasProcessedClosedSessionRollup,
  getPersistedPlayerRollupsForServer,
  type PersistedPlayerRollup
} from './player-intelligence-rollup-store.js';
import { getConfiguredServerGame } from './server-config.js';

interface PlayerDraft {
  playerId: string;
  serverId: string;
  displayName: string;
  aliases: Set<string>;
  game: GameKey;
  identityConfidence: PlayerIntelligenceConfidence;
  identityExplanation: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  isOnline: boolean;
  activeSessionId: string | null;
  totalTrackedSeconds: number;
  sessionCount: number;
  sourceSummary: Set<string>;
  gameFields: Record<string, unknown>;
}

const EMPTY_EXPLANATION = 'No players observed yet. Start the connector and wait for join/leave activity.';

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function slug(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown-player';
}

function getSessionId(session: SessionRecord): string {
  return `${session.serverId}:${normalize(session.playerName)}:${session.startedAt}`;
}

function getSessionDurationSeconds(session: SessionRecord): number {
  if (typeof session.durationSeconds === 'number' && Number.isFinite(session.durationSeconds)) {
    return Math.max(0, Math.floor(session.durationSeconds));
  }

  const startedAtMs = Date.parse(session.startedAt);
  const endedAtMs = session.endedAt ? Date.parse(session.endedAt) : Date.now();

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs) || endedAtMs <= startedAtMs) {
    return 0;
  }

  return Math.floor((endedAtMs - startedAtMs) / 1000);
}

function minTimestamp(current: string | null, candidate: string | null | undefined): string | null {
  if (!candidate) {
    return current;
  }

  if (!current) {
    return candidate;
  }

  return candidate.localeCompare(current) < 0 ? candidate : current;
}

function maxTimestamp(current: string | null, candidate: string | null | undefined): string | null {
  if (!candidate) {
    return current;
  }

  if (!current) {
    return candidate;
  }

  return candidate.localeCompare(current) > 0 ? candidate : current;
}

function pickConfidence(
  current: PlayerIntelligenceConfidence,
  candidate: PlayerIntelligenceConfidence
): PlayerIntelligenceConfidence {
  const rank: Record<PlayerIntelligenceConfidence, number> = {
    unknown: 0,
    low: 1,
    medium: 2,
    high: 3
  };

  return rank[candidate] > rank[current] ? candidate : current;
}

function createDraft(serverId: string, game: GameKey, displayName: string, playerId?: string): PlayerDraft {
  return {
    playerId: playerId ?? `${serverId}:${slug(displayName)}`,
    serverId,
    displayName,
    aliases: new Set([displayName]),
    game,
    identityConfidence: 'unknown',
    identityExplanation: 'This player was observed, but GameOps does not have a stable identity signal yet.',
    firstSeenAt: null,
    lastSeenAt: null,
    isOnline: false,
    activeSessionId: null,
    totalTrackedSeconds: 0,
    sessionCount: 0,
    sourceSummary: new Set(),
    gameFields: {}
  };
}

function getOrCreateDraft(
  draftsByKey: Map<string, PlayerDraft>,
  serverId: string,
  game: GameKey,
  displayName: string,
  playerId?: string
): PlayerDraft {
  const key = normalize(playerId ?? displayName);
  const displayKey = normalize(displayName);
  const existing = draftsByKey.get(key) ?? draftsByKey.get(displayKey);

  if (existing) {
    existing.aliases.add(displayName);
    return existing;
  }

  const draft = createDraft(serverId, game, displayName, playerId);
  draftsByKey.set(key, draft);
  draftsByKey.set(displayKey, draft);
  return draft;
}

function mergePersistedRollup(draft: PlayerDraft, rollup: PersistedPlayerRollup): void {
  draft.displayName = rollup.displayName;
  for (const alias of rollup.aliases) {
    draft.aliases.add(alias);
  }
  draft.firstSeenAt = minTimestamp(draft.firstSeenAt, rollup.firstSeenAt);
  draft.lastSeenAt = maxTimestamp(draft.lastSeenAt, rollup.lastSeenAt);
  draft.totalTrackedSeconds = Math.max(draft.totalTrackedSeconds, rollup.totalTrackedSeconds);
  draft.sessionCount = Math.max(draft.sessionCount, rollup.sessionCount);
  draft.identityConfidence = pickConfidence(draft.identityConfidence, rollup.identityConfidence);
  draft.identityExplanation = rollup.identityExplanation || draft.identityExplanation;
  draft.sourceSummary.add('stored rollup');
  for (const source of rollup.sourceSummary) {
    draft.sourceSummary.add(source);
  }
  draft.gameFields = {
    ...draft.gameFields,
    ...rollup.gameFields
  };
}

function mergeKnownPlayer(draft: PlayerDraft, player: KnownPlayerRecord): void {
  draft.displayName = player.displayName;
  draft.aliases.add(player.displayName);
  draft.identityConfidence = pickConfidence(draft.identityConfidence, player.confidence);
  draft.identityExplanation = player.confidence === 'high'
    ? 'GameOps has repeated observations and stable identity evidence for this player.'
    : player.confidence === 'medium'
      ? 'GameOps has multiple observations, but identity evidence is still incomplete.'
      : 'GameOps has seen this player, but identity evidence is limited.';
  draft.firstSeenAt = minTimestamp(draft.firstSeenAt, player.firstSeenAt);
  draft.lastSeenAt = maxTimestamp(draft.lastSeenAt, player.lastSeenAt);
  draft.sourceSummary.add('known-player memory');

  if (player.knownPlatformIds[0]) {
    draft.gameFields.steamId = player.knownPlatformIds[0];
  }

  if (player.knownCharacterIds[0]) {
    draft.gameFields.zdoid = player.knownCharacterIds[0];
  }
}

function mergeSession(draft: PlayerDraft, session: SessionRecord, isActive: boolean): void {
  draft.aliases.add(session.playerName);
  draft.firstSeenAt = minTimestamp(draft.firstSeenAt, session.startedAt);
  draft.lastSeenAt = maxTimestamp(draft.lastSeenAt, session.endedAt ?? session.startedAt);
  draft.sourceSummary.add(isActive ? 'active session' : 'session history');

  if (!isActive) {
    draft.sessionCount += 1;
    draft.totalTrackedSeconds += getSessionDurationSeconds(session);
  }

  const sessionConfidence = isActive ? session.startConfidence : (session.endConfidence ?? session.startConfidence);
  if (sessionConfidence) {
    draft.identityConfidence = pickConfidence(draft.identityConfidence, sessionConfidence);
  } else if (draft.identityConfidence === 'unknown' && normalize(session.playerName) !== 'unknown') {
    draft.identityConfidence = 'medium';
  }

  if (draft.identityConfidence === 'medium' && draft.identityExplanation.includes('stable identity signal')) {
    draft.identityExplanation = 'This identity comes from named session activity, but no stronger account identifier is linked yet.';
  }

  if (isActive) {
    draft.isOnline = true;
    draft.activeSessionId = getSessionId(session);
  }
}

function mergePalworldProfile(draft: PlayerDraft, profile: PalworldPlayerProfileSessionSummary): void {
  const displayName = profile.playerName ?? profile.accountName ?? profile.playerId;
  draft.displayName = displayName;
  draft.aliases.add(displayName);

  if (profile.accountName) {
    draft.aliases.add(profile.accountName);
  }

  if (profile.profile.userId) {
    draft.aliases.add(profile.profile.userId);
  }

  draft.firstSeenAt = minTimestamp(draft.firstSeenAt, profile.profile.firstSeenAt);
  draft.lastSeenAt = maxTimestamp(draft.lastSeenAt, profile.profile.lastSeenAt);
  draft.isOnline = draft.isOnline || profile.isOnline;
  draft.totalTrackedSeconds = Math.max(draft.totalTrackedSeconds, profile.trackedSeconds30d, profile.recentTrackedSeconds);
  draft.sessionCount = Math.max(draft.sessionCount, profile.profile.totalSessions ?? 0, profile.recentSessions.length);
  draft.sourceSummary.add('Palworld REST telemetry');
  draft.identityConfidence = pickConfidence(draft.identityConfidence, profile.profile.identityState === 'approved' || profile.profile.userId ? 'high' : 'medium');
  draft.identityExplanation = profile.profile.identityState === 'approved'
    ? 'Palworld telemetry has been linked to a reviewed player identity.'
    : profile.profile.userId || profile.playerId
      ? 'Palworld REST telemetry provides a stable player identifier.'
      : 'Palworld telemetry identifies this player by recent profile data, but stronger identity evidence is not available yet.';

  if (profile.activeSessionStartedAt && !draft.activeSessionId) {
    draft.activeSessionId = `${profile.serverId}:${normalize(displayName)}:${profile.activeSessionStartedAt}`;
  }

  draft.gameFields = {
    ...draft.gameFields,
    level: profile.profile.level,
    maxLevelSeen: profile.profile.maxLevelSeen,
    playerUid: profile.profile.userId,
    accountName: profile.accountName
  };
}

function toRecord(draft: PlayerDraft): PlayerIntelligenceRecord {
  const averageSessionSeconds = draft.sessionCount > 0
    ? Math.floor(draft.totalTrackedSeconds / draft.sessionCount)
    : 0;

  return playerIntelligenceRecordSchema.parse({
    playerId: draft.playerId,
    serverId: draft.serverId,
    displayName: draft.displayName,
    aliases: Array.from(draft.aliases).filter((alias) => normalize(alias) !== normalize(draft.displayName)).sort(),
    game: draft.game,
    identityConfidence: draft.identityConfidence,
    identityExplanation: draft.identityExplanation,
    firstSeenAt: draft.firstSeenAt,
    lastSeenAt: draft.lastSeenAt,
    isOnline: draft.isOnline,
    activeSessionId: draft.activeSessionId,
    totalTrackedSeconds: draft.totalTrackedSeconds,
    sessionCount: draft.sessionCount,
    averageSessionSeconds,
    sourceSummary: Array.from(draft.sourceSummary).sort(),
    gameFields: draft.gameFields
  });
}

export function getPlayerIntelligenceForServer(serverId: string): PlayerIntelligenceResponse {
  const game = getConfiguredServerGame(serverId) ?? 'valheim';
  const draftsByKey = new Map<string, PlayerDraft>();
  const persistedRollups = getPersistedPlayerRollupsForServer(serverId);
  const knownPlayers = getKnownPlayersForServer(serverId, 10_000);
  const activeSessions = getActiveSessionsForServer(serverId);
  const closedSessions = getRecentClosedSessionsForServer(serverId, 1_000);

  for (const rollup of persistedRollups) {
    mergePersistedRollup(
      getOrCreateDraft(draftsByKey, serverId, rollup.game, rollup.displayName, rollup.playerId),
      rollup
    );
  }

  for (const player of knownPlayers) {
    mergeKnownPlayer(
      getOrCreateDraft(draftsByKey, serverId, game, player.displayName, `${serverId}:${player.normalizedPlayerKey}`),
      player
    );
  }

  for (const session of closedSessions) {
    if (!hasProcessedClosedSessionRollup(session)) {
      mergeSession(getOrCreateDraft(draftsByKey, serverId, game, session.playerName), session, false);
    }
  }

  for (const session of activeSessions) {
    mergeSession(getOrCreateDraft(draftsByKey, serverId, game, session.playerName), session, true);
  }

  if (game === 'palworld') {
    for (const profile of getPalworldPlayerProfileSessionSummariesForServer(serverId, 10_000)) {
      const displayName = profile.playerName ?? profile.accountName ?? profile.playerId;
      mergePalworldProfile(
        getOrCreateDraft(draftsByKey, serverId, game, displayName, `${serverId}:${profile.playerId}`),
        profile
      );
    }
  }

  const uniqueDrafts = Array.from(new Set(draftsByKey.values()));
  const players = uniqueDrafts
    .map(toRecord)
    .sort((left, right) => {
      if (Number(right.isOnline) !== Number(left.isOnline)) {
        return Number(right.isOnline) - Number(left.isOnline);
      }

      if ((right.lastSeenAt ?? '') !== (left.lastSeenAt ?? '')) {
        return (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? '');
      }

      return right.totalTrackedSeconds - left.totalTrackedSeconds;
    });

  return playerIntelligenceResponseSchema.parse({
    serverId,
    explanation: players.length === 0
      ? EMPTY_EXPLANATION
      : 'Player intelligence is built from connector sessions, known-player observations, and available game telemetry.',
    players
  });
}
