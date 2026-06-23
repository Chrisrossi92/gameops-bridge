import {
  sessionTimelineItemSchema,
  sessionTimelineResponseSchema,
  type PlayerDetailSession,
  type PlayerIntelligenceRecord,
  type SessionRecord,
  type SessionTimelineItem,
  type SessionTimelineResponse,
  type SessionTimelineSource
} from '@gameops/shared';
import { getActiveSessionsForServer, getRecentClosedSessionsForServer } from './event-store.js';
import { getPlayerIntelligenceForServer } from './player-intelligence.js';
import { getClosedSessionRollupId, getPersistedPlayerRollupsForServer } from './player-intelligence-rollup-store.js';

const DEFAULT_EXPLANATION = 'No sessions observed yet. Start the connector and wait for player join/leave activity.';

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function slug(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown-player';
}

function getFallbackPlayerId(serverId: string, observedName: string): string {
  return `${serverId}:${slug(observedName)}`;
}

function getActiveSessionId(session: SessionRecord): string {
  return `${session.serverId}:${normalize(session.playerName)}:${session.startedAt}:active`;
}

function getSessionId(session: SessionRecord): string {
  return session.endedAt ? getClosedSessionRollupId(session) : getActiveSessionId(session);
}

function getDurationSeconds(session: SessionRecord): number {
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

function getActivityAt(session: Pick<SessionTimelineItem, 'startedAt' | 'endedAt'>): string {
  return session.endedAt ?? session.startedAt;
}

function findPlayerForName(players: PlayerIntelligenceRecord[], observedName: string): PlayerIntelligenceRecord | null {
  const normalizedName = normalize(observedName);
  return players.find((player) => (
    normalize(player.displayName) === normalizedName
    || player.aliases.some((alias) => normalize(alias) === normalizedName)
  )) ?? null;
}

function getExplanation(source: SessionTimelineSource, active: boolean, closeReason: string | null): string {
  if (active) {
    return 'Still online from a live active session.';
  }

  if (source === 'stored') {
    return 'Stored from previous API run.';
  }

  if (closeReason === 'player_leave') {
    return 'Ended by direct leave event.';
  }

  if (closeReason === 'occupancy_reconciliation') {
    return 'Likely ended from player-count drop.';
  }

  if (closeReason === 'disconnect_signal') {
    return 'Likely ended from a connector disconnect signal.';
  }

  if (closeReason === 'replaced_by_new_join') {
    return 'Closed because a newer join was observed for the same player.';
  }

  return 'Ended from observed connector session activity.';
}

function toTimelineItemFromSession(
  session: SessionRecord,
  source: Extract<SessionTimelineSource, 'live' | 'recent'>,
  players: PlayerIntelligenceRecord[]
): SessionTimelineItem {
  const player = findPlayerForName(players, session.playerName);
  const active = source === 'live';

  return sessionTimelineItemSchema.parse({
    sessionId: getSessionId(session),
    playerId: player?.playerId ?? getFallbackPlayerId(session.serverId, session.playerName),
    displayName: player?.displayName ?? session.playerName,
    observedName: session.playerName,
    startedAt: session.startedAt,
    endedAt: session.endedAt ?? null,
    isActive: active,
    durationSeconds: getDurationSeconds(session),
    closeReason: session.closeReason ?? null,
    startConfidence: session.startConfidence ?? null,
    endConfidence: session.endConfidence ?? null,
    explanation: getExplanation(source, active, session.closeReason ?? null),
    source
  });
}

function toTimelineItemFromStoredSession(input: {
  playerId: string;
  displayName: string;
  session: PlayerDetailSession;
}): SessionTimelineItem {
  return sessionTimelineItemSchema.parse({
    sessionId: input.session.sessionId,
    playerId: input.playerId,
    displayName: input.displayName,
    observedName: input.session.observedName,
    startedAt: input.session.startedAt,
    endedAt: input.session.endedAt,
    isActive: false,
    durationSeconds: input.session.durationSeconds,
    closeReason: input.session.closeReason,
    startConfidence: input.session.startConfidence,
    endConfidence: input.session.endConfidence,
    explanation: getExplanation('stored', false, input.session.closeReason),
    source: 'stored'
  });
}

function rankSource(source: SessionTimelineSource): number {
  switch (source) {
    case 'live':
      return 3;
    case 'recent':
      return 2;
    case 'stored':
      return 1;
  }
}

function upsertSession(target: Map<string, SessionTimelineItem>, item: SessionTimelineItem): void {
  const existing = target.get(item.sessionId);

  if (!existing || rankSource(item.source) > rankSource(existing.source)) {
    target.set(item.sessionId, item);
  }
}

function isToday(value: string, now = new Date()): boolean {
  const date = new Date(value);

  return Number.isFinite(date.getTime())
    && date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function buildSummary(sessions: SessionTimelineItem[]) {
  const lastActivityAt = sessions
    .map(getActivityAt)
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
  const todaySessions = sessions.filter((session) => isToday(getActivityAt(session)));

  return {
    activeCount: sessions.filter((session) => session.isActive).length,
    sessionsToday: todaySessions.length,
    trackedSecondsToday: todaySessions.reduce((sum, session) => sum + session.durationSeconds, 0),
    lastActivityAt
  };
}

export function getSessionTimelineForServer(serverId: string, limit = 50): SessionTimelineResponse {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const players = getPlayerIntelligenceForServer(serverId).players;
  const sessionsById = new Map<string, SessionTimelineItem>();

  for (const rollup of getPersistedPlayerRollupsForServer(serverId)) {
    for (const session of rollup.recentSessions) {
      upsertSession(sessionsById, toTimelineItemFromStoredSession({
        playerId: rollup.playerId,
        displayName: rollup.displayName,
        session
      }));
    }
  }

  for (const session of getRecentClosedSessionsForServer(serverId, 500)) {
    upsertSession(sessionsById, toTimelineItemFromSession(session, 'recent', players));
  }

  for (const session of getActiveSessionsForServer(serverId)) {
    upsertSession(sessionsById, toTimelineItemFromSession(session, 'live', players));
  }

  const sessions = Array.from(sessionsById.values())
    .sort((left, right) => getActivityAt(right).localeCompare(getActivityAt(left)))
    .slice(0, safeLimit);

  return sessionTimelineResponseSchema.parse({
    serverId,
    sessions,
    summary: buildSummary(sessions),
    explanation: sessions.length === 0
      ? DEFAULT_EXPLANATION
      : 'Recent server sessions from live connector state, recent API memory, and stored player rollups.'
  });
}
