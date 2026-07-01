import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { type NormalizedEvent, sessionRecordSchema, type SessionRecord } from '@gameops/shared';
import { appendLogTruthEvents, getRecentLogTruthEventsForServer } from './log-truth-store.js';
import { recordClosedSessionRollup, recordPlayerSeenFromSessionStart } from './player-intelligence-rollup-store.js';
import { clearCachedResult } from './request-performance.js';
import { resolveRuntimeDataPath } from './runtime-paths.js';

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
  return resolveRuntimeDataPath('SESSION_STATE_STORE_PATH', 'session-state.json');
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

function getEventSourceId(event: NormalizedEvent): string {
  return event.id?.trim()
    || [
      event.serverId,
      event.eventType,
      event.occurredAt,
      event.playerName ?? '',
      event.message ?? ''
    ].join('|');
}

function getJoinConfidence(event: NormalizedEvent): 'low' | 'medium' | 'high' {
  const rawConfidence = event.raw?.valheimIdentityConfidence;

  if (rawConfidence === 'low' || rawConfidence === 'medium' || rawConfidence === 'high') {
    return rawConfidence;
  }

  if (event.game === 'palworld' && event.raw?.palworldEventSource === 'rest_players') {
    return 'high';
  }

  return event.playerName ? 'high' : 'medium';
}

function getStructuredPlayerCount(event: NormalizedEvent): number | null {
  const value = event.raw?.valheimCurrentPlayerCount;

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
}

function normalizeIdentityValue(value: string): string {
  return value.trim().toLowerCase();
}

function getRawString(event: NormalizedEvent, keys: string[]): string | null {
  for (const key of keys) {
    const value = event.raw?.[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getDisconnectIdentityHint(event: NormalizedEvent): string | null {
  return event.platformId?.trim()
    ?? getRawString(event, [
      'valheimDisconnectSocketId',
      'valheimSocketId',
      'valheimIdentityPlatformId',
      'platformId',
      'steamId',
      'socketId'
    ]);
}

function getEventIdentityValues(event: NormalizedEvent): string[] {
  return [
    event.platformId,
    getRawString(event, ['valheimIdentityPlatformId', 'platformId', 'steamId']),
    getRawString(event, ['valheimIdentityPlayFabId', 'playFabId']),
    getRawString(event, ['valheimIdentityCharacterId', 'characterId'])
  ].filter((value): value is string => Boolean(value?.trim()));
}

function findSourceEvent(sourceEventIds: string[]): NormalizedEvent | null {
  const sourceIds = new Set(sourceEventIds.map((id) => id.trim()).filter(Boolean));

  if (sourceIds.size === 0) {
    return null;
  }

  return recentEvents.find((event) => (
    (event.id && sourceIds.has(event.id))
    || sourceIds.has(getEventSourceId(event))
  )) ?? null;
}

function findMatchingActiveSessionByIdentity(
  activeByPlayer: Map<string, SessionRecord>,
  disconnectIdentityHint: string
): { playerName: string; session: SessionRecord; sourceEvent: NormalizedEvent | null } | null {
  const normalizedHint = normalizeIdentityValue(disconnectIdentityHint);

  for (const [playerName, session] of activeByPlayer.entries()) {
    const sourceEvent = findSourceEvent(session.sourceEventIds ?? []);
    const identityValues = sourceEvent ? getEventIdentityValues(sourceEvent) : [];
    const matched = identityValues.some((value) => normalizeIdentityValue(value) === normalizedHint);

    if (matched) {
      return { playerName, session, sourceEvent };
    }
  }

  return null;
}

function correlateMissingLeaveIdentity(
  event: NormalizedEvent,
  activeByPlayer: Map<string, SessionRecord>
): NormalizedEvent {
  if (event.playerName || (event.eventType !== 'PLAYER_LEAVE' && !isDisconnectSignalEvent(event))) {
    return event;
  }

  const disconnectIdentityHint = getDisconnectIdentityHint(event);
  const matched = disconnectIdentityHint
    ? findMatchingActiveSessionByIdentity(activeByPlayer, disconnectIdentityHint)
    : null;
  const singleActive = activeByPlayer.size === 1
    ? Array.from(activeByPlayer.entries())[0] ?? null
    : null;
  const playerName = matched?.playerName ?? singleActive?.[0] ?? null;
  const sourceEvent = matched?.sourceEvent ?? (singleActive ? findSourceEvent(singleActive[1].sourceEventIds ?? []) : null);

  if (!playerName) {
    return event;
  }

  const platformId = sourceEvent?.platformId
    ?? getRawString(sourceEvent ?? event, ['valheimIdentityPlatformId', 'platformId', 'steamId'])
    ?? disconnectIdentityHint
    ?? undefined;

  return {
    ...event,
    playerName,
    ...(platformId ? { platformId } : {}),
    raw: {
      ...(event.raw ?? {}),
      valheimResolvedPlayerName: playerName,
      valheimIdentityConfidence: matched ? 'medium' : 'low',
      valheimIdentitySource: matched ? 'active_session_identity_match' : 'single_active_session_correlation',
      ...(platformId ? { valheimIdentityPlatformId: platformId } : {})
    }
  };
}

function closeSession(
  game: NormalizedEvent['game'],
  serverId: string,
  playerName: string,
  session: SessionRecord,
  closedAt: string,
  reason: string,
  endConfidence: 'low' | 'medium' | 'high',
  sourceEventId: string
): SessionRecord {
  const durationSeconds = getDurationSeconds(session.startedAt, closedAt);
  const closedSession = sessionRecordSchema.parse({
    ...session,
    endedAt: closedAt,
    durationSeconds,
    closeReason: reason,
    endConfidence,
    sourceEventIds: Array.from(new Set([...(session.sourceEventIds ?? []), sourceEventId]))
  });

  console.log(`[session] closed server=${serverId} player=${playerName} reason=${reason} duration_s=${durationSeconds}`);
  recordClosedSessionRollup({
    game,
    session: closedSession,
    confidence: endConfidence
  });
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
      event.game,
      event.serverId,
      playerName,
      session,
      event.occurredAt,
      'occupancy_reconciliation',
      'low',
      getEventSourceId(event)
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
    ...(!event.playerName && activeCount === 1 && closedPlayers.length === 1 ? { playerName: closedPlayers[0] } : {}),
    raw: {
      ...(event.raw ?? {}),
      sessionCloseReason: 'occupancy_reconciliation',
      sessionReconciledCount: closedPlayers.length,
      sessionClosedPlayers: closedPlayers,
      ...(!event.playerName && activeCount === 1 && closedPlayers.length === 1
        ? {
            valheimResolvedPlayerName: closedPlayers[0],
            valheimIdentityConfidence: 'low',
            valheimIdentitySource: 'single_active_session_occupancy_correlation'
          }
        : {})
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
  const sourceEventId = getEventSourceId(event);

  if (event.eventType === 'PLAYER_JOIN') {
    if (!event.playerName) {
      return event;
    }

    const existingSession = activeByPlayer.get(event.playerName);

    if (existingSession) {
      const replacedSession = closeSession(
        event.game,
        event.serverId,
        event.playerName,
        existingSession,
        event.occurredAt,
        'replaced_by_new_join',
        'medium',
        sourceEventId
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
      startedAt: event.occurredAt,
      startConfidence: getJoinConfidence(event),
      sourceEventIds: [sourceEventId]
    });

    activeByPlayer.set(event.playerName, opened);
    recordPlayerSeenFromSessionStart({
      serverId: event.serverId,
      game: event.game,
      playerName: event.playerName,
      observedAt: event.occurredAt,
      confidence: opened.startConfidence
    });
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

  let updatedEvent = correlateMissingLeaveIdentity(event, activeByPlayer);
  let directCloseCount = 0;
  const triggerReason: 'player_leave' | 'disconnect_signal' = updatedEvent.eventType === 'PLAYER_LEAVE'
    ? 'player_leave'
    : 'disconnect_signal';

  if (updatedEvent.playerName) {
    const existingSession = activeByPlayer.get(updatedEvent.playerName);

    if (!existingSession) {
      console.log(`[session] orphan leave ignored server=${updatedEvent.serverId} player=${updatedEvent.playerName} trigger=${triggerReason}`);
    } else {
      const durationSeconds = getDurationSeconds(existingSession.startedAt, updatedEvent.occurredAt);
      const closedSession = closeSession(
        updatedEvent.game,
        updatedEvent.serverId,
        updatedEvent.playerName,
        existingSession,
        updatedEvent.occurredAt,
        triggerReason,
        triggerReason === 'player_leave' ? 'high' : 'low',
        sourceEventId
      );

      activeByPlayer.delete(updatedEvent.playerName);
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
  const acceptedEvents = appendLogTruthEvents(events).map((entry) => entry.event);

  if (acceptedEvents.length === 0) {
    return;
  }

  const enrichedEvents = acceptedEvents.map((event) => applySessionTracking(event));
  recentEvents.push(...enrichedEvents);

  if (recentEvents.length > MAX_STORED_EVENTS) {
    recentEvents.splice(0, recentEvents.length - MAX_STORED_EVENTS);
  }

  if (acceptedEvents.some((event) =>
    event.eventType === 'PLAYER_JOIN'
    || event.eventType === 'PLAYER_LEAVE'
    || isDisconnectSignalEvent(event)
  )) {
    persistSessionState();
  }
}

export function getRecentEventsForServer(serverId: string, limit = 10): NormalizedEvent[] {
  const boundedLimit = Math.max(1, limit);
  const memoryEvents = recentEvents
    .filter((event) => event.serverId === serverId)
    .slice(-boundedLimit)
    .reverse();

  return memoryEvents.length > 0
    ? memoryEvents
    : getRecentLogTruthEventsForServer(serverId, boundedLimit);
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

export function resetSessionStateForTests(): void {
  recentEvents.splice(0, recentEvents.length);
  activeSessionsByServer.clear();
  recentClosedSessionsByServer.clear();
  sessionStateInitialized = false;
  clearCachedResult('player-intelligence:');
  clearCachedResult('session-timeline:');
  clearCachedResult('player-engagement:');
  clearCachedResult('data-freshness:');
  persistSessionState();
}
