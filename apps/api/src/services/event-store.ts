import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { type NormalizedEvent, sessionRecordSchema, type SessionRecord } from '@gameops/shared';

const MAX_STORED_EVENTS = 500;
const MAX_STORED_CLOSED_SESSIONS = 500;

const recentEvents: NormalizedEvent[] = [];
const activeSessionsByServer = new Map<string, Map<string, SessionRecord>>();
const recentClosedSessionsByServer = new Map<string, SessionRecord[]>();
let sessionStateInitialized = false;

interface PersistedSessionState {
  activeSessionsByServer?: Record<string, unknown>;
  recentClosedSessionsByServer?: Record<string, unknown>;
}

function resolveSessionStatePath(): string {
  const rawPath = process.env.SESSION_STATE_STORE_PATH ?? '../session-state.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function parseSessionArray(rawValue: unknown): SessionRecord[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .map((value) => sessionRecordSchema.safeParse(value))
    .filter((result): result is { success: true; data: SessionRecord } => result.success)
    .map((result) => result.data);
}

function persistSessionState(): void {
  const path = resolveSessionStatePath();
  const payload = {
    activeSessionsByServer: Object.fromEntries(
      Array.from(activeSessionsByServer.entries()).map(([serverId, sessionsByPlayer]) => (
        [serverId, Array.from(sessionsByPlayer.values())]
      ))
    ),
    recentClosedSessionsByServer: Object.fromEntries(
      Array.from(recentClosedSessionsByServer.entries()).map(([serverId, sessions]) => (
        [serverId, sessions.slice(-MAX_STORED_CLOSED_SESSIONS)]
      ))
    )
  };

  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    console.log(`[session] persist-failed path=${path} error=${message}`);
  }
}

function initializeSessionStateIfNeeded(): void {
  if (sessionStateInitialized) {
    return;
  }

  sessionStateInitialized = true;
  const path = resolveSessionStatePath();

  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as PersistedSessionState;

    const activeRoot = parsed.activeSessionsByServer;
    const closedRoot = parsed.recentClosedSessionsByServer;

    if (activeRoot && typeof activeRoot === 'object') {
      for (const [serverId, rawSessions] of Object.entries(activeRoot)) {
        const sessions = parseSessionArray(rawSessions);

        if (sessions.length === 0) {
          continue;
        }

        const byPlayer = new Map<string, SessionRecord>();
        for (const session of sessions) {
          const existing = byPlayer.get(session.playerName);

          if (!existing || session.startedAt > existing.startedAt) {
            byPlayer.set(session.playerName, session);
          }
        }

        if (byPlayer.size > 0) {
          activeSessionsByServer.set(serverId, byPlayer);
        }
      }
    }

    if (closedRoot && typeof closedRoot === 'object') {
      for (const [serverId, rawSessions] of Object.entries(closedRoot)) {
        const sessions = parseSessionArray(rawSessions).slice(-MAX_STORED_CLOSED_SESSIONS);

        if (sessions.length > 0) {
          recentClosedSessionsByServer.set(serverId, sessions);
        }
      }
    }

    const loadedActive = Array.from(activeSessionsByServer.values())
      .reduce((sum, sessions) => sum + sessions.size, 0);
    const loadedClosed = Array.from(recentClosedSessionsByServer.values())
      .reduce((sum, sessions) => sum + sessions.length, 0);

    console.log(
      `[session] state-loaded path=${path} active=${loadedActive} closed=${loadedClosed} servers=${activeSessionsByServer.size}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    console.log(`[session] state-load-skipped path=${path} reason=${message}`);
  }
}

export function initializeSessionStateStore(): void {
  initializeSessionStateIfNeeded();
}

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

function isDisconnectSignalEvent(event: NormalizedEvent): boolean {
  return event.eventType === 'HEALTH_WARN' && event.raw?.valheimDisconnectSignal === true;
}

function reconcileByOccupancyCap(
  event: NormalizedEvent,
  activeByPlayer: Map<string, SessionRecord>,
  closedSessions: SessionRecord[],
  sourceReason: 'player_leave' | 'disconnect_signal' | 'occupancy_reconciliation'
): { event: NormalizedEvent; reconciledCount: number; closedPlayers: string[] } {
  const targetPlayerCount = getStructuredPlayerCount(event);

  if (targetPlayerCount === null) {
    return { event, reconciledCount: 0, closedPlayers: [] };
  }

  const activeEntries = Array.from(activeByPlayer.entries());
  const activeCount = activeEntries.length;
  const sessionsToClose = activeCount - targetPlayerCount;

  if (sessionsToClose <= 0) {
    return { event, reconciledCount: 0, closedPlayers: [] };
  }

  const sortedOldestFirst = activeEntries.sort((a, b) => a[1].startedAt.localeCompare(b[1].startedAt));
  const closedPlayers: string[] = [];

  for (const [playerName, session] of sortedOldestFirst.slice(0, sessionsToClose)) {
    activeByPlayer.delete(playerName);
    closedSessions.push(closeSession(
      event.serverId,
      playerName,
      session,
      event.occurredAt,
      'occupancy_reconciliation'
    ));
    closedPlayers.push(playerName);
  }

  if (closedSessions.length > MAX_STORED_CLOSED_SESSIONS) {
    closedSessions.splice(0, closedSessions.length - MAX_STORED_CLOSED_SESSIONS);
  }

  console.log(
    `[session] reconciled-close server=${event.serverId} trigger=${sourceReason} rule=${String(event.raw?.valheimDisconnectRule ?? 'unknown')} active_before=${activeCount} target=${targetPlayerCount} reconciled=${closedPlayers.length} closed=${closedPlayers.join(',') || 'none'} line=${(event.message ?? '').slice(0, 120)}`
  );

  const enrichedEvent: NormalizedEvent = {
    ...event,
    raw: {
      ...(event.raw ?? {}),
      sessionCloseReason: 'occupancy_reconciliation',
      sessionReconciledCount: closedPlayers.length,
      sessionClosedPlayers: closedPlayers
    }
  };

  return {
    event: enrichedEvent,
    reconciledCount: closedPlayers.length,
    closedPlayers
  };
}

function applySessionTracking(event: NormalizedEvent): NormalizedEvent {
  const disconnectSignal = isDisconnectSignalEvent(event);

  if (event.eventType !== 'PLAYER_JOIN' && event.eventType !== 'PLAYER_LEAVE' && !disconnectSignal) {
    return event;
  }

  const activeByPlayer = getActiveSessionMap(event.serverId);
  const closedSessions = getRecentClosedSessionList(event.serverId);

  if (event.eventType === 'PLAYER_JOIN') {
    if (!event.playerName) {
      return event;
    }

    const existingSession = activeByPlayer.get(event.playerName);

    if (existingSession) {
      const replacedSession = closeSession(
        event.serverId,
        event.playerName,
        existingSession,
        event.occurredAt,
        'replaced_by_new_join'
      );

      activeByPlayer.delete(event.playerName);
      closedSessions.push(replacedSession);

      if (closedSessions.length > MAX_STORED_CLOSED_SESSIONS) {
        closedSessions.splice(0, closedSessions.length - MAX_STORED_CLOSED_SESSIONS);
      }

      console.log(
        `[session] replaced-active-session server=${event.serverId} player=${event.playerName} old_startedAt=${existingSession.startedAt} new_join_at=${event.occurredAt}`
      );
    }

    const opened = sessionRecordSchema.parse({
      serverId: event.serverId,
      playerName: event.playerName,
      startedAt: event.occurredAt
    });

    activeByPlayer.set(event.playerName, opened);
    return existingSession
      ? {
          ...event,
          raw: {
            ...(event.raw ?? {}),
            sessionCloseReason: 'replaced_by_new_join',
            replacedSessionStartedAt: existingSession.startedAt
          }
        }
      : event;
  }

  let updatedEvent = event;
  let directCloseCount = 0;
  const triggerReason: 'player_leave' | 'disconnect_signal' = event.eventType === 'PLAYER_LEAVE'
    ? 'player_leave'
    : 'disconnect_signal';

  if (event.playerName) {
    const existingSession = activeByPlayer.get(event.playerName);

    if (!existingSession) {
      console.log(`[session] orphan leave ignored server=${event.serverId} player=${event.playerName} trigger=${triggerReason}`);
    } else {
      const durationSeconds = getDurationSeconds(existingSession.startedAt, event.occurredAt);
      const closedSession = closeSession(
        event.serverId,
        event.playerName,
        existingSession,
        event.occurredAt,
        triggerReason
      );

      activeByPlayer.delete(event.playerName);
      closedSessions.push(closedSession);
      directCloseCount = 1;

      if (closedSessions.length > MAX_STORED_CLOSED_SESSIONS) {
        closedSessions.splice(0, closedSessions.length - MAX_STORED_CLOSED_SESSIONS);
      }

      updatedEvent = {
        ...updatedEvent,
        raw: {
          ...(updatedEvent.raw ?? {}),
          sessionCloseReason: triggerReason,
          sessionDurationSeconds: durationSeconds
        }
      };
    }
  }

  const { event: reconciledEvent, reconciledCount } = reconcileByOccupancyCap(
    updatedEvent,
    activeByPlayer,
    closedSessions,
    triggerReason
  );

  if (directCloseCount > 0 || reconciledCount > 0) {
    console.log(
      `[session] close-summary server=${event.serverId} trigger=${triggerReason} direct=${directCloseCount} reconciled=${reconciledCount}`
    );
  }

  return reconciledEvent;
}

export function addEvents(events: NormalizedEvent[]): void {
  initializeSessionStateIfNeeded();
  const enrichedEvents = events.map((event) => applySessionTracking(event));
  recentEvents.push(...enrichedEvents);

  if (recentEvents.length > MAX_STORED_EVENTS) {
    recentEvents.splice(0, recentEvents.length - MAX_STORED_EVENTS);
  }

  if (events.some((event) =>
    event.eventType === 'PLAYER_JOIN'
    || event.eventType === 'PLAYER_LEAVE'
    || isDisconnectSignalEvent(event)
  )) {
    persistSessionState();
  }
}

export function getRecentEventsForServer(serverId: string, limit = 10): NormalizedEvent[] {
  return recentEvents
    .filter((event) => event.serverId === serverId)
    .slice(-Math.max(1, limit))
    .reverse();
}

export function getActiveSessionsForServer(serverId: string): SessionRecord[] {
  initializeSessionStateIfNeeded();
  const activeByPlayer = activeSessionsByServer.get(serverId);

  if (!activeByPlayer) {
    return [];
  }

  return Array.from(activeByPlayer.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getRecentClosedSessionsForServer(serverId: string, limit = 10): SessionRecord[] {
  initializeSessionStateIfNeeded();
  const sessions = recentClosedSessionsByServer.get(serverId) ?? [];
  return sessions
    .slice(-Math.max(1, limit))
    .reverse();
}
