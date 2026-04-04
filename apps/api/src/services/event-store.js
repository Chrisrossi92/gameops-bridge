import { sessionRecordSchema } from '@gameops/shared';
const MAX_STORED_EVENTS = 500;
const MAX_STORED_CLOSED_SESSIONS = 500;
const recentEvents = [];
const activeSessionsByServer = new Map();
const recentClosedSessionsByServer = new Map();
function getActiveSessionMap(serverId) {
    const existing = activeSessionsByServer.get(serverId);
    if (existing) {
        return existing;
    }
    const created = new Map();
    activeSessionsByServer.set(serverId, created);
    return created;
}
function getRecentClosedSessionList(serverId) {
    const existing = recentClosedSessionsByServer.get(serverId);
    if (existing) {
        return existing;
    }
    const created = [];
    recentClosedSessionsByServer.set(serverId, created);
    return created;
}
function getDurationSeconds(startedAt, endedAt) {
    const startMs = new Date(startedAt).getTime();
    const endMs = new Date(endedAt).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
        return 0;
    }
    return Math.floor((endMs - startMs) / 1000);
}
function getStructuredPlayerCount(event) {
    const value = event.raw?.valheimCurrentPlayerCount;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        return null;
    }
    return value;
}
function closeSession(serverId, playerName, session, closedAt, reason) {
    const durationSeconds = getDurationSeconds(session.startedAt, closedAt);
    const closedSession = sessionRecordSchema.parse({
        ...session,
        endedAt: closedAt,
        durationSeconds
    });
    console.log(`[session] closed server=${serverId} player=${playerName} reason=${reason} duration_s=${durationSeconds}`);
    return closedSession;
}
function reconcileAnonymousLeave(event, activeByPlayer, closedSessions) {
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
        console.log(`[session] reconcile-skipped server=${event.serverId} reason=large_delta active=${activeCount} target=${targetPlayerCount}`);
        return event;
    }
    const sortedNewestFirst = activeEntries.sort((a, b) => b[1].startedAt.localeCompare(a[1].startedAt));
    const closedPlayers = [];
    for (const [playerName, session] of sortedNewestFirst.slice(0, sessionsToClose)) {
        activeByPlayer.delete(playerName);
        closedSessions.push(closeSession(event.serverId, playerName, session, event.occurredAt, 'occupancy_reconcile_structured_leave'));
        closedPlayers.push(playerName);
    }
    if (closedSessions.length > MAX_STORED_CLOSED_SESSIONS) {
        closedSessions.splice(0, closedSessions.length - MAX_STORED_CLOSED_SESSIONS);
    }
    console.log(`[session] reconciled-close server=${event.serverId} source=structured_leave rule=${String(event.raw?.valheimDisconnectRule ?? 'unknown')} target=${targetPlayerCount} closed=${closedPlayers.join(',') || 'none'} line=${(event.message ?? '').slice(0, 120)}`);
    return {
        ...event,
        raw: {
            ...(event.raw ?? {}),
            sessionCloseReason: 'occupancy_reconcile_structured_leave',
            sessionClosedPlayers: closedPlayers
        }
    };
}
function applySessionTracking(event) {
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
            const replacedSession = closeSession(event.serverId, event.playerName, existingSession, event.occurredAt, 'replaced_by_new_join');
            activeByPlayer.delete(event.playerName);
            closedSessions.push(replacedSession);
            if (closedSessions.length > MAX_STORED_CLOSED_SESSIONS) {
                closedSessions.splice(0, closedSessions.length - MAX_STORED_CLOSED_SESSIONS);
            }
            console.log(`[session] replaced-active-session server=${event.serverId} player=${event.playerName} old_startedAt=${existingSession.startedAt} new_join_at=${event.occurredAt}`);
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
    if (!existingSession) {
        console.log(`[session] orphan leave ignored server=${event.serverId} player=${event.playerName}`);
        return event;
    }
    const durationSeconds = getDurationSeconds(existingSession.startedAt, event.occurredAt);
    const closedSession = closeSession(event.serverId, event.playerName, existingSession, event.occurredAt, 'player_leave_event');
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
export function addEvents(events) {
    const enrichedEvents = events.map((event) => applySessionTracking(event));
    recentEvents.push(...enrichedEvents);
    if (recentEvents.length > MAX_STORED_EVENTS) {
        recentEvents.splice(0, recentEvents.length - MAX_STORED_EVENTS);
    }
}
export function getRecentEventsForServer(serverId, limit = 10) {
    return recentEvents
        .filter((event) => event.serverId === serverId)
        .slice(-Math.max(1, limit))
        .reverse();
}
export function getActiveSessionsForServer(serverId) {
    const activeByPlayer = activeSessionsByServer.get(serverId);
    if (!activeByPlayer) {
        return [];
    }
    return Array.from(activeByPlayer.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
export function getRecentClosedSessionsForServer(serverId, limit = 10) {
    const sessions = recentClosedSessionsByServer.get(serverId) ?? [];
    return sessions
        .slice(-Math.max(1, limit))
        .reverse();
}
//# sourceMappingURL=event-store.js.map