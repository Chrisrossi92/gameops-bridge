import {
  activityLogItemSchema,
  type ActivityLogItem,
  type ActivitySeverity,
  type IdentityConfidence,
  type NormalizedEvent,
  type SessionRecord
} from '@gameops/shared';
import { getRecentClosedSessionsForServer, getRecentEventsForServer } from './event-store.js';

function hashId(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function getSourceEventId(event: NormalizedEvent): string {
  return event.id?.trim()
    || [
      event.serverId,
      event.eventType,
      event.occurredAt,
      event.playerName ?? '',
      event.message ?? ''
    ].join('|');
}

function getGameLabel(event: NormalizedEvent): string {
  return event.game === 'palworld' ? 'Palworld' : 'Valheim';
}

function normalizePlayerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getSessionId(session: SessionRecord | null): string | undefined {
  if (!session) {
    return undefined;
  }

  return [
    session.serverId,
    normalizePlayerKey(session.playerName),
    session.startedAt
  ].join(':');
}

function formatDuration(totalSeconds: number | undefined): string | null {
  if (typeof totalSeconds !== 'number' || !Number.isFinite(totalSeconds)) {
    return null;
  }

  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${safeSeconds}s`;
}

function getRawConfidence(event: NormalizedEvent): IdentityConfidence | null {
  const value = event.raw?.valheimIdentityConfidence;
  return value === 'low' || value === 'medium' || value === 'high' ? value : null;
}

function getJoinConfidence(event: NormalizedEvent): IdentityConfidence {
  return getRawConfidence(event)
    ?? (event.game === 'palworld' && event.raw?.palworldEventSource === 'rest_players' ? 'high' : 'high');
}

function findClosedSessionForEvent(event: NormalizedEvent, closedSessions: SessionRecord[]): SessionRecord | null {
  const playerName = normalizePlayerKey(event.playerName ?? '');

  return closedSessions.find((session) => (
    session.endedAt === event.occurredAt
    && (!playerName || normalizePlayerKey(session.playerName) === playerName)
  )) ?? null;
}

function getEventSeverity(event: NormalizedEvent): ActivitySeverity {
  const rawSeverity = event.raw?.severity;

  if (rawSeverity === 'info' || rawSeverity === 'warning' || rawSeverity === 'critical') {
    return rawSeverity;
  }

  if (event.eventType === 'SERVER_OFFLINE' || event.eventType === 'INCIDENT_OPENED') {
    return 'critical';
  }

  if (event.eventType === 'HEALTH_WARN') {
    return 'warning';
  }

  return 'info';
}

function summarizeHealthWarning(event: NormalizedEvent): {
  description: string;
  confidence: IdentityConfidence;
  explanation: string;
} {
  const failureCount = event.raw?.palworldFailureCount;

  if (event.game === 'palworld' && typeof failureCount === 'number') {
    return {
      description: `The Palworld connector could not poll the server API after ${failureCount} consecutive failures.`,
      confidence: failureCount >= 3 ? 'high' : 'medium',
      explanation: 'This came from the Palworld REST connector health check. It matters if it keeps happening because player and server telemetry may be stale.'
    };
  }

  if (event.raw?.valheimDisconnectSignal === true) {
    return {
      description: 'Valheim reported a network disconnect signal. This may explain a player leaving or a stale session ending.',
      confidence: 'medium',
      explanation: 'This came from Valheim journal output and was used only as supporting evidence, not as a named leave event.'
    };
  }

  const compactMessage = event.message?.trim().replace(/\s+/g, ' ');
  return {
    description: compactMessage
      ? `The connector reported a server warning: ${compactMessage.slice(0, 140)}`
      : 'The connector reported a server health warning.',
    confidence: 'medium',
    explanation: 'This came from connector health parsing. It is shown here for context, but raw technical warnings are not posted to Discord by default.'
  };
}

function buildActivityItem(event: NormalizedEvent, closedSessions: SessionRecord[]): ActivityLogItem {
  const sourceEventId = getSourceEventId(event);
  const common = {
    id: `activity:${hashId(sourceEventId)}`,
    serverId: event.serverId,
    timestamp: event.occurredAt,
    sourceEventIds: [sourceEventId]
  };

  if (event.eventType === 'PLAYER_JOIN') {
    const playerName = event.playerName ?? (typeof event.raw?.valheimResolvedPlayerName === 'string' ? event.raw.valheimResolvedPlayerName : undefined);
    const session = playerName ? {
      serverId: event.serverId,
      playerName,
      startedAt: event.occurredAt,
      sourceEventIds: [sourceEventId]
    } : null;

    return activityLogItemSchema.parse({
      ...common,
      title: 'Player joined',
      description: playerName
        ? `${playerName} joined ${getGameLabel(event)}.`
        : `A player joined ${getGameLabel(event)}, but GameOps could not identify them yet.`,
      severity: 'info',
      confidence: playerName ? getJoinConfidence(event) : 'medium',
      explanation: playerName
        ? 'This came from a join event observed by the game connector.'
        : 'The server reported a player-count increase, but no stable player name was attached to the event.',
      ...(playerName ? { playerName } : {}),
      ...(session ? { sessionId: getSessionId(session) } : {})
    });
  }

  if (event.eventType === 'PLAYER_LEAVE') {
    const closeReason = event.raw?.sessionCloseReason;
    const closedSession = findClosedSessionForEvent(event, closedSessions);
    const durationText = formatDuration(
      typeof event.raw?.sessionDurationSeconds === 'number'
        ? event.raw.sessionDurationSeconds
        : closedSession?.durationSeconds
    );

    if (closeReason === 'occupancy_reconciliation') {
      const count = typeof event.raw?.sessionReconciledCount === 'number' ? event.raw.sessionReconciledCount : 1;
      const countLabel = count === 1 ? 'A Valheim session was' : `${count} Valheim sessions were`;

      return activityLogItemSchema.parse({
        ...common,
        title: count === 1 ? 'Player likely left' : 'Players likely left',
        description: `${countLabel} closed because the server player count dropped.`,
        severity: 'info',
        confidence: 'low',
        explanation: 'No named leave event was found; this was inferred from player-count reconciliation.',
        ...(closedSession ? { playerName: closedSession.playerName, sessionId: getSessionId(closedSession) } : {})
      });
    }

    const playerName = event.playerName ?? closedSession?.playerName;

    return activityLogItemSchema.parse({
      ...common,
      title: 'Player left',
      description: playerName
        ? `${playerName} left ${getGameLabel(event)}${durationText ? ` after ${durationText}` : ''}.`
        : `A player left ${getGameLabel(event)}${durationText ? ` after ${durationText}` : ''}.`,
      severity: 'info',
      confidence: closeReason === 'player_leave' || event.playerName ? 'high' : 'medium',
      explanation: closeReason === 'player_leave'
        ? 'Session ended from a direct leave event.'
        : 'GameOps saw a leave event, but the session linkage is partial.',
      ...(playerName ? { playerName } : {}),
      ...(closedSession ? { sessionId: getSessionId(closedSession) } : {})
    });
  }

  if (event.eventType === 'HEALTH_WARN') {
    const health = summarizeHealthWarning(event);

    return activityLogItemSchema.parse({
      ...common,
      title: 'Server health warning',
      description: health.description,
      severity: getEventSeverity(event),
      confidence: health.confidence,
      explanation: health.explanation,
      ...(event.playerName ? { playerName: event.playerName } : {})
    });
  }

  if (event.eventType === 'SERVER_ONLINE') {
    return activityLogItemSchema.parse({
      ...common,
      title: 'Server checked in',
      description: `${getGameLabel(event)} reported that it is reachable.`,
      severity: 'info',
      confidence: 'high',
      explanation: 'This is a routine availability signal and is kept in the dashboard instead of Discord by default.'
    });
  }

  if (event.eventType === 'SERVER_OFFLINE') {
    return activityLogItemSchema.parse({
      ...common,
      title: 'Server offline',
      description: `${getGameLabel(event)} appears to be offline.`,
      severity: 'critical',
      confidence: 'high',
      explanation: 'This should be owner-actionable if confirmed by the connector or control plane.'
    });
  }

  return activityLogItemSchema.parse({
    ...common,
    title: event.eventType.replaceAll('_', ' ').toLowerCase(),
    description: event.message?.trim() || `${getGameLabel(event)} reported an event.`,
    severity: getEventSeverity(event),
    confidence: 'medium',
    explanation: 'This event was normalized by the connector, but GameOps does not have a richer interpretation for it yet.',
    ...(event.playerName ? { playerName: event.playerName } : {})
  });
}

export function getActivityLogForServer(serverId: string, limit = 20): ActivityLogItem[] {
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  const events = getRecentEventsForServer(serverId, Math.max(boundedLimit * 3, boundedLimit));
  const closedSessions = getRecentClosedSessionsForServer(serverId, 100);

  return events
    .map((event) => buildActivityItem(event, closedSessions))
    .slice(0, boundedLimit);
}
