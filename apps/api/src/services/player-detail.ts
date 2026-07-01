import {
  playerDetailEvidenceSchema,
  playerDetailEventReferenceSchema,
  playerDetailResponseSchema,
  playerDetailSessionSchema,
  type NormalizedEvent,
  type PlayerDetailEvidence,
  type PlayerDetailEventReference,
  type PlayerDetailResponse,
  type PlayerDetailSession,
  type PlayerIntelligenceConfidence,
  type PlayerIntelligenceRecord,
  type SessionRecord
} from '@gameops/shared';
import { getActiveSessionsForServer, getRecentClosedSessionsForServer } from './event-store.js';
import { getRecentLogTruthEventsForServer } from './log-truth-store.js';
import { getPlayerIntelligenceForServer } from './player-intelligence.js';
import { getClosedSessionRollupId, getPersistedPlayerRollupsForServer } from './player-intelligence-rollup-store.js';

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isPlayerMatch(player: PlayerIntelligenceRecord, lookup: string): boolean {
  const normalizedLookup = normalize(lookup);
  return normalize(player.playerId) === normalizedLookup
    || normalize(player.displayName) === normalizedLookup
    || player.aliases.some((alias) => normalize(alias) === normalizedLookup);
}

function getSessionId(session: SessionRecord): string {
  return session.endedAt
    ? getClosedSessionRollupId(session)
    : `${session.serverId}:${normalize(session.playerName)}:${session.startedAt}:active`;
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

function toDetailSession(session: SessionRecord, active: boolean): PlayerDetailSession {
  return playerDetailSessionSchema.parse({
    sessionId: getSessionId(session),
    startedAt: session.startedAt,
    endedAt: session.endedAt ?? null,
    durationSeconds: getSessionDurationSeconds(session),
    closeReason: session.closeReason ?? null,
    startConfidence: session.startConfidence ?? null,
    endConfidence: session.endConfidence ?? null,
    observedName: session.playerName,
    explanation: active
      ? 'Currently online from active session.'
      : session.closeReason === 'occupancy_reconciliation'
        ? 'Session was closed from player-count reconciliation, so the exact leave time is inferred.'
        : 'Session ended from observed connector activity.'
  });
}

function sessionMatchesPlayer(session: SessionRecord, player: PlayerIntelligenceRecord): boolean {
  const observedName = normalize(session.playerName);
  return observedName === normalize(player.displayName)
    || player.aliases.some((alias) => normalize(alias) === observedName)
    || normalize(getSessionId(session)) === normalize(player.activeSessionId ?? '');
}

function eventMatchesPlayer(event: NormalizedEvent, player: PlayerIntelligenceRecord): boolean {
  const observedName = event.playerName ? normalize(event.playerName) : '';
  const playerNames = [player.displayName, ...player.aliases].map((name) => normalize(name));

  if (observedName && playerNames.includes(observedName)) {
    return true;
  }

  const closedPlayers = event.raw?.sessionClosedPlayers;

  if (Array.isArray(closedPlayers)) {
    return closedPlayers.some((value) => typeof value === 'string' && playerNames.includes(normalize(value)));
  }

  return false;
}

function getEventSource(event: NormalizedEvent): string {
  const rawSource = event.raw?.source
    ?? event.raw?.eventSource
    ?? event.raw?.valheimEventSource
    ?? event.raw?.palworldEventSource;

  return typeof rawSource === 'string' && rawSource.trim() ? rawSource.trim() : 'durable log truth';
}

function toDetailEventReference(event: NormalizedEvent): PlayerDetailEventReference {
  return playerDetailEventReferenceSchema.parse({
    id: event.id ?? null,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    playerName: event.playerName ?? null,
    message: event.message ?? null,
    source: getEventSource(event),
    raw: event.raw ?? null
  });
}

function buildEvidence(player: PlayerIntelligenceRecord, recentSessions: PlayerDetailSession[]): PlayerDetailEvidence[] {
  const evidence: PlayerDetailEvidence[] = [];

  for (const source of player.sourceSummary) {
    evidence.push(playerDetailEvidenceSchema.parse({
      type: 'source',
      label: source,
      description: source === 'stored rollup'
        ? 'This player has historical data saved in the local rollup store.'
        : `Observed from ${source}.`,
      confidence: player.identityConfidence,
      observedAt: player.lastSeenAt
    }));
  }

  if (player.aliases.length > 0) {
    evidence.push(playerDetailEvidenceSchema.parse({
      type: 'alias',
      label: 'Aliases',
      description: `Also seen as ${player.aliases.join(', ')}.`,
      confidence: player.identityConfidence,
      observedAt: player.lastSeenAt
    }));
  }

  if (recentSessions.length > 0) {
    evidence.push(playerDetailEvidenceSchema.parse({
      type: 'session',
      label: 'Session history',
      description: `${recentSessions.length} recent session${recentSessions.length === 1 ? '' : 's'} are available for review.`,
      confidence: recentSessions.some((session) => session.endConfidence === 'low' || session.startConfidence === 'low')
        ? 'medium'
        : player.identityConfidence,
      observedAt: recentSessions[0]?.endedAt ?? recentSessions[0]?.startedAt ?? null
    }));
  }

  const gameFieldKeys = Object.keys(player.gameFields ?? {});
  if (gameFieldKeys.length > 0) {
    evidence.push(playerDetailEvidenceSchema.parse({
      type: 'game_identity',
      label: 'Game identity hints',
      description: `Game telemetry includes ${gameFieldKeys.slice(0, 4).join(', ')}.`,
      confidence: player.identityConfidence === 'unknown' ? 'low' : player.identityConfidence,
      observedAt: player.lastSeenAt
    }));
  }

  if (evidence.length === 0) {
    evidence.push(playerDetailEvidenceSchema.parse({
      type: 'unknown',
      label: 'No evidence yet',
      description: 'GameOps has not collected enough evidence for this player yet.',
      confidence: 'unknown',
      observedAt: null
    }));
  }

  return evidence;
}

function getStatus(player: PlayerIntelligenceRecord): string {
  if (player.isOnline) {
    return 'Currently online from active session.';
  }

  if (player.sourceSummary.includes('stored rollup')) {
    return 'Last known from stored rollup.';
  }

  if (player.sourceSummary.includes('session history')) {
    return 'Last known from recent session history.';
  }

  return 'Current live status is unknown.';
}

function getExplanation(player: PlayerIntelligenceRecord): string {
  if (player.identityExplanation.toLowerCase().includes('valheim')) {
    return player.identityExplanation;
  }

  if (player.sourceSummary.includes('known-player memory')) {
    return 'Identity includes known-player memory from previous observations.';
  }

  if (player.sourceSummary.includes('stored rollup')) {
    return 'Historical session data is loaded from the local rollup store. It is tracked data, not guaranteed all-time playtime.';
  }

  return player.identityExplanation;
}

export function getPlayerDetail(serverId: string, playerId: string): PlayerDetailResponse | null {
  const intelligence = getPlayerIntelligenceForServer(serverId);
  const player = intelligence.players.find((candidate) => isPlayerMatch(candidate, playerId)) ?? null;

  if (!player) {
    return null;
  }

  const persistedRollup = getPersistedPlayerRollupsForServer(serverId)
    .find((rollup) => isPlayerMatch({
      ...player,
      playerId: rollup.playerId,
      displayName: rollup.displayName,
      aliases: rollup.aliases
    }, playerId)) ?? null;
  const sessionsById = new Map<string, PlayerDetailSession>();

  for (const session of persistedRollup?.recentSessions ?? []) {
    sessionsById.set(session.sessionId, session);
  }

  for (const session of getRecentClosedSessionsForServer(serverId, 100).filter((candidate) => sessionMatchesPlayer(candidate, player))) {
    const detailSession = toDetailSession(session, false);
    sessionsById.set(detailSession.sessionId, detailSession);
  }

  for (const session of getActiveSessionsForServer(serverId).filter((candidate) => sessionMatchesPlayer(candidate, player))) {
    const detailSession = toDetailSession(session, true);
    sessionsById.set(detailSession.sessionId, detailSession);
  }

  const recentSessions = Array.from(sessionsById.values())
    .sort((left, right) => (right.endedAt ?? right.startedAt).localeCompare(left.endedAt ?? left.startedAt))
    .slice(0, 25);
  const recentEvents = getRecentLogTruthEventsForServer(serverId, 200)
    .filter((event) => eventMatchesPlayer(event, player))
    .slice(0, 25)
    .map(toDetailEventReference);

  return playerDetailResponseSchema.parse({
    serverId,
    player: {
      playerId: player.playerId,
      serverId: player.serverId,
      displayName: player.displayName,
      aliases: player.aliases,
      game: player.game,
      isOnline: player.isOnline,
      activeSessionId: player.activeSessionId,
      firstSeenAt: player.firstSeenAt,
      lastSeenAt: player.lastSeenAt,
      trackedPlaytimeSeconds: player.totalTrackedSeconds,
      sessionCount: player.sessionCount,
      averageSessionSeconds: player.averageSessionSeconds,
      identityConfidence: player.identityConfidence as PlayerIntelligenceConfidence,
      identityExplanation: player.identityExplanation,
      sourceSummary: player.sourceSummary,
      gameFields: player.gameFields
    },
    recentSessions,
    recentEvents,
    evidence: buildEvidence(player, recentSessions),
    status: getStatus(player),
    explanation: getExplanation(player)
  });
}
