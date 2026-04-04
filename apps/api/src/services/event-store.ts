import { type NormalizedEvent, sessionRecordSchema, type SessionRecord } from '@gameops/shared';

const MAX_STORED_EVENTS = 500;
const MAX_STORED_CLOSED_SESSIONS = 500;

const recentEvents: NormalizedEvent[] = [];
const activeSessionsByServer = new Map<string, Map<string, SessionRecord>>();
const recentClosedSessionsByServer = new Map<string, SessionRecord[]>();

function getActiveSessionMap(serverId: string): Map<string, SessionRecord> {
  const existing = activeSessionsByServer.get(serverId);
  if (existing) {
    return existing;
  }

  const created = new Map<string, SessionRecord>();
  activeSessionsByServer.set(serverId, created);
  return created;
}

function getRecentClosedSessionList(serverId: string): SessionRecord[] {
  const existing = recentClosedSessionsByServer.get(serverId);
  if (existing) {
    return existing;
  }

  const created: SessionRecord[] = [];
  recentClosedSessionsByServer.set(serverId, created);
  return created;
}

function getDurationSeconds(startedAt: string, endedAt: string): number {
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(endedAt).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return 0;
  }

  return Math.floor((endMs - startMs) / 1000);
}

function getStructuredPlayerCount(event: NormalizedEvent): number | null {
  const value = event.raw?.valheimCurrentPlayerCount;

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
}

function closeSession(
  serverId: string,
  playerName: string,
  session: SessionRecord,
  closedAt: string,
  reason: string
): SessionRecord {
  const durationSeconds = getDurationSeconds(session.startedAt, closedAt);
  const closedSession = sessionRecordSchema.parse({
    ...session,
    endedAt: closedAt,
    durationSeconds
  });

  console.log(`[session] closed server=${serverId} player=${playerName} reason=${reason} duration_s=${durationSeconds}`);
  return closedSession;
}

function reconcileAnonymousLeave(
  event: NormalizedEvent,
  activeByPlayer: Map<string, SessionRecord>,
  closedSessions: SessionRecord[]
): NormalizedEvent {
  const targetPlayerCount = getStructuredPlayerCount(event);

  if (targetPlayerCount === null) {
    return event;
  }

  const activeEntries = Array.from(activeByPlayer.entries());
  const activeCount = activeEntries.length;
  const sessionsToClose = activeCount - targetPlayerCount;

  if (sessionsToClose <= 0) {
    return event;
  }

  // Conservative guard: only reconcile small deltas from structured journal leave lines.
  if (sessionsToClose > 2) {
    console.log(
      `[session] reconcile-skipped server=${event.serverId} reason=large_delta active=${activeCount} target=${targetPlayerCount}`
    );
    return event;
  }

  const sortedNewestFirst = activeEntries.sort((a, b) => b[1].startedAt.localeCompare(a[1].startedAt));
  const closedPlayers: string[] = [];

  for (const [playerName, session] of sortedNewestFirst.slice(0, sessionsToClose)) {
    activeByPlayer.delete(playerName);
    closedSessions.push(closeSession(
      event.serverId,
      playerName,
      session,
      event.occurredAt,
      'occupancy_reconcile_structured_leave'
    ));
    closedPlayers.push(playerName);
  }

  if (closedSessions.length > MAX_STORED_CLOSED_SESSIONS) {
    closedSessions.splice(0, closedSessions.length - MAX_STORED_CLOSED_SESSIONS);
  }

  console.log(
    `[session] reconciled-close server=${event.serverId} source=structured_leave rule=${String(event.raw?.valheimDisconnectRule ?? 'unknown')} target=${targetPlayerCount} closed=${closedPlayers.join(',') || 'none'} line=${(event.message ?? '').slice(0, 120)}`
  );

  return {
    ...event,
    raw: {
      ...(event.raw ?? {}),
      sessionCloseReason: 'occupancy_reconcile_structured_leave',
      sessionClosedPlayers: closedPlayers
    }
  };
}

function applySessionTracking(event: NormalizedEvent): NormalizedEvent {
  if (event.eventType !== 'PLAYER_JOIN' && event.eventType !== 'PLAYER_LEAVE') {
    return event;
  }

  const activeByPlayer = getActiveSessionMap(event.serverId);
  const closedSessions = getRecentClosedSessionList(event.serverId);

  if (event.eventType === 'PLAYER_LEAVE' && !event.playerName) {
    return reconcileAnonymousLeave(event, activeByPlayer, closedSessions);
  }

  if (!event.playerName) {
    return event;
  }

  const existingSession = activeByPlayer.get(event.playerName);

  if (event.eventType === 'PLAYER_JOIN') {
    if (existingSession) {
      console.log(`[session] duplicate join ignored server=${event.serverId} player=${event.playerName}`);
      return event;
    }

    const opened = sessionRecordSchema.parse({
      serverId: event.serverId,
      playerName: event.playerName,
      startedAt: event.occurredAt
    });

    activeByPlayer.set(event.playerName, opened);
    return event;
  }

  if (!existingSession) {
    console.log(`[session] orphan leave ignored server=${event.serverId} player=${event.playerName}`);
    return event;
  }

  const durationSeconds = getDurationSeconds(existingSession.startedAt, event.occurredAt);
  const closedSession = closeSession(
    event.serverId,
    event.playerName,
    existingSession,
    event.occurredAt,
    'player_leave_event'
  );

  activeByPlayer.delete(event.playerName);
  closedSessions.push(closedSession);

  if (closedSessions.length > MAX_STORED_CLOSED_SESSIONS) {
    closedSessions.splice(0, closedSessions.length - MAX_STORED_CLOSED_SESSIONS);
  }

  return {
    ...event,
    raw: {
      ...(event.raw ?? {}),
      sessionDurationSeconds: durationSeconds
    }
  };
}

export function addEvents(events: NormalizedEvent[]): void {
  const enrichedEvents = events.map((event) => applySessionTracking(event));
  recentEvents.push(...enrichedEvents);

  if (recentEvents.length > MAX_STORED_EVENTS) {
    recentEvents.splice(0, recentEvents.length - MAX_STORED_EVENTS);
  }
}

export function getRecentEventsForServer(serverId: string, limit = 10): NormalizedEvent[] {
  return recentEvents
    .filter((event) => event.serverId === serverId)
    .slice(-Math.max(1, limit))
    .reverse();
}

export function getActiveSessionsForServer(serverId: string): SessionRecord[] {
  const activeByPlayer = activeSessionsByServer.get(serverId);

  if (!activeByPlayer) {
    return [];
  }

  return Array.from(activeByPlayer.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getRecentClosedSessionsForServer(serverId: string, limit = 10): SessionRecord[] {
  const sessions = recentClosedSessionsByServer.get(serverId) ?? [];
  return sessions
    .slice(-Math.max(1, limit))
    .reverse();
}
