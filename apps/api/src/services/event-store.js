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
function applySessionTracking(event) {
    if (!event.playerName || (event.eventType !== 'PLAYER_JOIN' && event.eventType !== 'PLAYER_LEAVE')) {
        return event;
    }
    const activeByPlayer = getActiveSessionMap(event.serverId);
    const closedSessions = getRecentClosedSessionList(event.serverId);
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
    const closedSession = sessionRecordSchema.parse({
        ...existingSession,
        endedAt: event.occurredAt,
        durationSeconds
    });
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