import {
  dataFreshnessResponseSchema,
  type DataFreshnessResponse,
  type DataFreshnessStatus,
  type IdentityConfidence,
  type ServerOperationalStatus
} from '@gameops/shared';
import { getServerOperationalStatus } from './connector-heartbeat.js';
import { getActiveSessionsForServer, getRecentEventsForServer } from './event-store.js';
import { getPersistedPlayerRollupsForServer } from './player-intelligence-rollup-store.js';
import { getCachedResult } from './request-performance.js';
import { getConfiguredServerGame, isServerConfigured } from './server-config.js';
import { getSessionTimelineForServer } from './session-timeline.js';

const DATA_FRESHNESS_CACHE_TTL_MS = 10_000;

function formatAge(seconds: number | null): string {
  if (seconds === null) {
    return 'an unknown time ago';
  }

  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

function maxTimestamp(values: Array<string | null | undefined>): string | null {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function getRecommendedAction(input: {
  status: DataFreshnessStatus;
  operationalStatus: ServerOperationalStatus;
}): string {
  if (input.status === 'not_started') {
    return 'Start the connector';
  }

  if (input.status === 'live') {
    return 'No action needed';
  }

  if (input.status === 'error') {
    return input.operationalStatus.connectorMode === 'rest'
      ? 'Check Palworld REST credentials'
      : 'Check connector logs';
  }

  if (input.status === 'historical') {
    return input.operationalStatus.lastHeartbeatAt ? 'Restart or check the connector' : 'Start the connector';
  }

  return 'Check connector status';
}

function buildErrorFreshness(input: {
  serverId: string;
  operationalStatus: ServerOperationalStatus;
  lastEventAt: string | null;
  lastSessionActivityAt: string | null;
  hasStoredRollups: boolean;
}): DataFreshnessResponse {
  const degraded = input.operationalStatus.connectorStatus === 'degraded';
  const warnings = [
    degraded ? 'Connector is reporting degraded polling' : 'Connector is reporting errors',
    ...(input.hasStoredRollups ? ['Showing stored player history'] : [])
  ];

  return dataFreshnessResponseSchema.parse({
    serverId: input.serverId,
    status: 'error',
    headline: degraded ? 'Connector degraded' : 'Connector error',
    explanation: input.operationalStatus.explanation,
    lastHeartbeatAt: input.operationalStatus.lastHeartbeatAt,
    heartbeatAgeSeconds: input.operationalStatus.heartbeatAgeSeconds,
    lastSuccessfulPollAt: input.operationalStatus.lastSuccessfulPollAt,
    lastEventAt: input.lastEventAt,
    lastSessionActivityAt: input.lastSessionActivityAt,
    connectorStatus: input.operationalStatus.connectorStatus,
    confidence: 'low',
    trustWarnings: warnings,
    recommendedAction: getRecommendedAction({
      status: 'error',
      operationalStatus: input.operationalStatus
    })
  });
}

function computeDataFreshnessForServer(serverId: string, now = new Date()): DataFreshnessResponse {
  const operationalStatus = getServerOperationalStatus(serverId, isServerConfigured(serverId), now);
  const recentEvent = getRecentEventsForServer(serverId, 1)[0] ?? null;
  const timeline = getSessionTimelineForServer(serverId, 50);
  const activeSessions = getActiveSessionsForServer(serverId);
  const persistedRollups = getPersistedPlayerRollupsForServer(serverId);
  const lastStoredRollupAt = maxTimestamp(persistedRollups.map((player) => player.lastUpdatedAt ?? player.lastSeenAt));
  const lastEventAt = recentEvent?.occurredAt ?? null;
  const lastSessionActivityAt = maxTimestamp([timeline.summary.lastActivityAt, lastStoredRollupAt]);
  const hasStoredRollups = persistedRollups.length > 0;
  const hasAnyActivity = Boolean(lastEventAt || lastSessionActivityAt || timeline.sessions.length > 0 || hasStoredRollups);
  const hasHeartbeat = Boolean(operationalStatus.lastHeartbeatAt);
  const trustWarnings: string[] = [];
  let status: DataFreshnessStatus;
  let headline: string;
  let explanation: string;
  let confidence: IdentityConfidence;

  if (operationalStatus.connectorStatus === 'error' || operationalStatus.connectorStatus === 'degraded') {
    return buildErrorFreshness({
      serverId,
      operationalStatus,
      lastEventAt,
      lastSessionActivityAt,
      hasStoredRollups
    });
  }

  if (!hasHeartbeat && !hasAnyActivity) {
    status = 'not_started';
    headline = 'No activity observed yet';
    explanation = 'Server is configured, but the connector has not reported and no player/session activity has been observed.';
    confidence = 'low';
    trustWarnings.push('Connector has not reported yet');
  } else if (operationalStatus.connectorStatus === 'running') {
    status = 'live';
    headline = 'Live data';
    explanation = hasAnyActivity
      ? `Live: connector last heard ${formatAge(operationalStatus.heartbeatAgeSeconds)}.`
      : `No activity yet: connector is running and last heard ${formatAge(operationalStatus.heartbeatAgeSeconds)}, but no players have joined since tracking started.`;
    confidence = 'high';

    if (!hasAnyActivity) {
      trustWarnings.push('No player activity observed yet');
    }
  } else if (operationalStatus.connectorStatus === 'stale' && activeSessions.length > 0) {
    status = 'stale';
    headline = 'Connector stale';
    explanation = `Stale: connector last heard ${formatAge(operationalStatus.heartbeatAgeSeconds)}. Online/session status may be outdated.`;
    confidence = 'low';
    trustWarnings.push('Session state may be outdated');

    if (hasStoredRollups) {
      trustWarnings.push('Showing stored player history');
    }
  } else if (operationalStatus.connectorStatus === 'stale' || !hasHeartbeat) {
    status = hasStoredRollups || hasAnyActivity ? 'historical' : 'stale';
    headline = status === 'historical' ? 'Historical data only' : 'Connector stale';
    explanation = hasHeartbeat
      ? `Historical only: connector last heard ${formatAge(operationalStatus.heartbeatAgeSeconds)}. Showing the latest stored GameOps data.`
      : 'Historical only: no connector heartbeat yet. Showing stored player history.';
    confidence = hasStoredRollups ? 'medium' : 'low';

    if (!hasHeartbeat) {
      trustWarnings.push('Connector has not reported yet');
    } else {
      trustWarnings.push('Connector heartbeat is stale');
    }

    if (hasStoredRollups) {
      trustWarnings.push('Showing stored player history');
    }
  } else {
    status = 'not_started';
    headline = 'No activity observed yet';
    explanation = operationalStatus.explanation;
    confidence = 'low';
    trustWarnings.push('Connector has not reported yet');
  }

  if (getConfiguredServerGame(serverId) === 'palworld' && operationalStatus.connectorMode === 'rest' && operationalStatus.connectorStatus === 'stale') {
    trustWarnings.push('Palworld REST data may be outdated');
  }

  return dataFreshnessResponseSchema.parse({
    serverId,
    status,
    headline,
    explanation,
    lastHeartbeatAt: operationalStatus.lastHeartbeatAt,
    heartbeatAgeSeconds: operationalStatus.heartbeatAgeSeconds,
    lastSuccessfulPollAt: operationalStatus.lastSuccessfulPollAt,
    lastEventAt,
    lastSessionActivityAt,
    connectorStatus: operationalStatus.connectorStatus,
    confidence,
    trustWarnings: Array.from(new Set(trustWarnings)),
    recommendedAction: getRecommendedAction({ status, operationalStatus })
  });
}

export function getDataFreshnessForServer(serverId: string, now = new Date()): DataFreshnessResponse {
  return getCachedResult(`data-freshness:${serverId}`, DATA_FRESHNESS_CACHE_TTL_MS, () => computeDataFreshnessForServer(serverId, now));
}
