import {
  serverHealthSummarySchema,
  type CollectorHealth,
  type NormalizedEvent,
  type ServerHealthStatus,
  type ServerHealthSummary,
  type ServerOperationalStatus
} from '@gameops/shared';
import { getServerOperationalStatus } from './connector-heartbeat.js';
import { getDataFreshnessForServer } from './data-freshness.js';
import { getActiveSessionsForServer, getRecentClosedSessionsForServer, getRecentEventsForServer } from './event-store.js';
import { getPlayerIntelligenceForServer } from './player-intelligence.js';
import { getCachedResult } from './request-performance.js';
import { isServerConfigured } from './server-config.js';

const SERVER_HEALTH_CACHE_TTL_MS = 10_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function maxTimestamp(values: Array<string | null | undefined>): string | null {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function isWithinWeek(value: string | null, now: Date): boolean {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && now.getTime() - timestamp <= WEEK_MS;
}

function statusRank(status: ServerHealthStatus): number {
  return status === 'unhealthy' ? 2 : status === 'warning' ? 1 : 0;
}

function worstStatus(values: ServerHealthStatus[]): ServerHealthStatus {
  return values.sort((left, right) => statusRank(right) - statusRank(left))[0] ?? 'healthy';
}

function collectorHasError(collector: CollectorHealth): boolean {
  return Boolean(collector.lastError ?? collector.shadow?.lastError ?? collector.snapshot?.lastError);
}

function collectorLastSuccess(collector: CollectorHealth): string | null {
  return collector.lastSuccessfulCollectionAt
    ?? collector.shadow?.lastRunAt
    ?? collector.snapshot?.lastSuccessfulPollAt
    ?? null;
}

function summarizeCollectors(operationalStatus: ServerOperationalStatus): ServerHealthSummary['collectorHealth'] {
  const collectors = operationalStatus.collectors;
  const enabledCollectors = collectors.filter((collector) => collector.enabled);
  const unhealthyCollectors = collectors.filter(collectorHasError);
  const status: ServerHealthStatus = unhealthyCollectors.length > 0 || operationalStatus.connectorStatus === 'error'
    ? 'unhealthy'
    : operationalStatus.connectorStatus === 'degraded' || operationalStatus.connectorStatus === 'stale'
      ? 'warning'
      : 'healthy';

  return {
    status,
    totalCollectors: collectors.length,
    enabledCollectors: enabledCollectors.length,
    unhealthyCollectors: unhealthyCollectors.length,
    lastSuccessfulCollectionAt: maxTimestamp(collectors.map(collectorLastSuccess)),
    summaries: collectors.map((collector) => {
      const statusLabel = collectorHasError(collector) ? 'error' : collector.enabled ? 'enabled' : 'disabled';
      const details = [
        collector.shadow ? `shadow ${collector.shadow.parityStatus}` : null,
        collector.snapshot ? `snapshot ${collector.snapshot.snapshotSize}` : null,
        collectorHasError(collector) ? `error ${collector.lastError ?? collector.shadow?.lastError ?? collector.snapshot?.lastError}` : null
      ].filter((value): value is string => Boolean(value));

      return `${collector.name}: ${statusLabel}${details.length > 0 ? ` (${details.join(', ')})` : ''}`;
    })
  };
}

function isWorldSaveEvent(event: NormalizedEvent): boolean {
  const category = typeof event.raw?.valheimEventCategory === 'string' ? event.raw.valheimEventCategory : null;

  return category === 'world_saved' || /world saved/i.test(event.message ?? '');
}

function getHeadline(input: {
  status: ServerHealthStatus;
  currentPlayers: number;
  uniquePlayersThisWeek: number;
  telemetryStatus: string;
}): string {
  if (input.status === 'healthy') {
    return `Healthy: ${input.currentPlayers} online, ${input.uniquePlayersThisWeek} active this week`;
  }

  if (input.status === 'unhealthy') {
    return 'Unhealthy: telemetry or persistence requires attention';
  }

  return input.telemetryStatus === 'not_started'
    ? 'Warning: no server activity observed yet'
    : 'Warning: server telemetry needs review';
}

function getRecommendedAction(status: ServerHealthStatus, reasons: string[]): string | undefined {
  if (status === 'healthy') {
    return undefined;
  }

  if (reasons.some((reason) => /log truth/i.test(reason))) {
    return 'Check log truth storage';
  }

  if (reasons.some((reason) => /collector/i.test(reason))) {
    return 'Check collector logs and heartbeat payloads';
  }

  if (reasons.some((reason) => /stale|not reported|telemetry/i.test(reason))) {
    return 'Check connector status';
  }

  return 'Review server telemetry';
}

function computeServerHealthSummary(serverId: string, now = new Date()): ServerHealthSummary {
  const operationalStatus = getServerOperationalStatus(serverId, isServerConfigured(serverId), now);
  const freshness = getDataFreshnessForServer(serverId, now);
  const playerIntelligence = getPlayerIntelligenceForServer(serverId);
  const activeSessions = getActiveSessionsForServer(serverId);
  const recentClosedSessions = getRecentClosedSessionsForServer(serverId, 25);
  const recentEvents = getRecentEventsForServer(serverId, 250);
  const collectorHealth = summarizeCollectors(operationalStatus);
  const logTruthHealth = freshness.logTruth ?? null;
  const currentPlayers = activeSessions.length;
  const uniquePlayersThisWeek = playerIntelligence.players
    .filter((player) => isWithinWeek(player.lastSeenAt, now))
    .length;
  const lastPlayerActivityAt = maxTimestamp([
    freshness.lastSessionActivityAt,
    ...playerIntelligence.players.map((player) => player.lastSeenAt)
  ]);
  const lastWorldSaveAt = recentEvents.find(isWorldSaveEvent)?.occurredAt ?? null;
  const sessionIsStale = freshness.status === 'stale' || (operationalStatus.connectorStatus === 'stale' && activeSessions.length > 0);
  const sessionStatus: ServerHealthStatus = sessionIsStale ? 'warning' : 'healthy';
  const reasons: string[] = [];

  if (freshness.status === 'error') {
    reasons.push(freshness.explanation);
  } else if (freshness.status === 'stale' || freshness.status === 'historical') {
    reasons.push(freshness.explanation);
  } else if (freshness.status === 'not_started') {
    reasons.push('Connector has not reported and no server activity has been observed.');
  }

  if (collectorHealth.status !== 'healthy') {
    reasons.push(`${collectorHealth.unhealthyCollectors} collector issue${collectorHealth.unhealthyCollectors === 1 ? '' : 's'} detected.`);
  }

  if (logTruthHealth?.status === 'unhealthy') {
    reasons.push('Log truth storage is unhealthy.');
  }

  if (sessionIsStale) {
    reasons.push('Active session state may be stale.');
  }

  const status = worstStatus([
    freshness.status === 'error' ? 'unhealthy' : freshness.status === 'live' ? 'healthy' : 'warning',
    collectorHealth.status,
    logTruthHealth?.status === 'unhealthy' ? 'unhealthy' : 'healthy',
    sessionStatus
  ]);
  const explanation = status === 'healthy'
    ? 'Connector telemetry, collectors, Log Truth, and session state are currently healthy.'
    : Array.from(new Set(reasons)).join(' ');

  return serverHealthSummarySchema.parse({
    serverId,
    status,
    headline: getHeadline({
      status,
      currentPlayers,
      uniquePlayersThisWeek,
      telemetryStatus: freshness.status
    }),
    explanation,
    recommendedAction: getRecommendedAction(status, reasons),
    generatedAt: now.toISOString(),
    currentPlayers,
    uniquePlayersThisWeek,
    lastPlayerActivityAt,
    lastWorldSaveAt,
    collectorHealth,
    logTruthHealth,
    sessionHealth: {
      status: sessionStatus,
      activeSessions: activeSessions.length,
      recentClosedSessions: recentClosedSessions.length,
      stale: sessionIsStale,
      explanation: sessionIsStale
        ? 'Connector heartbeat is stale while sessions are still active.'
        : 'Session tracking is current.'
    },
    telemetry: {
      status: freshness.status,
      connectorStatus: operationalStatus.connectorStatus,
      lastHeartbeatAt: operationalStatus.lastHeartbeatAt,
      lastSuccessfulPollAt: operationalStatus.lastSuccessfulPollAt
    }
  });
}

export function getServerHealthSummary(serverId: string, now = new Date()): ServerHealthSummary {
  return getCachedResult(`server-health:${serverId}`, SERVER_HEALTH_CACHE_TTL_MS, () => computeServerHealthSummary(serverId, now));
}
