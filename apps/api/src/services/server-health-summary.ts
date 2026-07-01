import type {
  CollectorHealth,
  DataFreshnessResponse,
  DataFreshnessStatus,
  NormalizedEvent,
  PlayerIntelligenceResponse,
  ServerEngagementHealthStatus,
  ServerHealthStatus,
  ServerHealthSummary,
  ServerOperationalStatus,
  SessionRecord
} from '@gameops/shared';
import { serverHealthSummarySchema } from '@gameops/shared';

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
  const unhealthyCollectors = collectors.filter(collectorHasError);
  const status: ServerHealthStatus = unhealthyCollectors.length > 0 || operationalStatus.connectorStatus === 'error'
    ? 'unhealthy'
    : operationalStatus.connectorStatus === 'degraded' || operationalStatus.connectorStatus === 'stale'
      ? 'warning'
      : 'healthy';

  return {
    status,
    totalCollectors: collectors.length,
    enabledCollectors: collectors.filter((collector) => collector.enabled).length,
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

function getTelemetryStatus(input: {
  freshnessStatus: DataFreshnessStatus;
  collectorHealth: ServerHealthSummary['collectorHealth'];
  logTruthStatus: 'healthy' | 'unhealthy' | null;
  sessionStatus: ServerHealthStatus;
}): ServerHealthStatus {
  return worstStatus([
    input.freshnessStatus === 'error'
      ? 'unhealthy'
      : input.freshnessStatus === 'live'
        ? 'healthy'
        : 'warning',
    input.collectorHealth.status,
    input.logTruthStatus === 'unhealthy' ? 'unhealthy' : 'healthy',
    input.sessionStatus
  ]);
}

function getTelemetryHeadline(status: ServerHealthStatus): string {
  return status === 'healthy' ? 'Telemetry healthy' : status === 'unhealthy' ? 'Telemetry unhealthy' : 'Telemetry warning';
}

function getEngagementStatus(input: {
  telemetryStatus: ServerHealthStatus;
  currentPlayers: number;
  uniquePlayersThisWeek: number;
}): ServerEngagementHealthStatus {
  if (input.telemetryStatus === 'unhealthy' && input.uniquePlayersThisWeek === 0 && input.currentPlayers === 0) {
    return 'unknown';
  }

  return input.currentPlayers > 0 || input.uniquePlayersThisWeek > 0 ? 'active' : 'inactive';
}

function getEngagementHeadline(input: {
  status: ServerEngagementHealthStatus;
  currentPlayers: number;
  uniquePlayersThisWeek: number;
}): string {
  if (input.status === 'unknown') {
    return 'engagement unknown';
  }

  if (input.uniquePlayersThisWeek > 0) {
    return `${input.uniquePlayersThisWeek} player${input.uniquePlayersThisWeek === 1 ? '' : 's'} active this week`;
  }

  if (input.currentPlayers > 0) {
    return `${input.currentPlayers} player${input.currentPlayers === 1 ? '' : 's'} online now`;
  }

  return 'no player activity captured this week';
}

export function buildServerHealthSummary(input: {
  serverId: string;
  now: Date;
  operationalStatus: ServerOperationalStatus;
  freshness: DataFreshnessResponse;
  playerIntelligence: PlayerIntelligenceResponse;
  activeSessions: SessionRecord[];
  recentClosedSessions: SessionRecord[];
  recentEvents: NormalizedEvent[];
}): ServerHealthSummary {
  const collectorHealth = summarizeCollectors(input.operationalStatus);
  const logTruthHealth = input.freshness.logTruth ?? null;
  const currentPlayers = input.activeSessions.length;
  const uniquePlayersThisWeek = input.playerIntelligence.players
    .filter((player) => isWithinWeek(player.lastSeenAt, input.now))
    .length;
  const lastPlayerActivityAt = maxTimestamp([
    input.freshness.lastSessionActivityAt,
    ...input.playerIntelligence.players.map((player) => player.lastSeenAt)
  ]);
  const lastWorldSaveAt = input.recentEvents.find(isWorldSaveEvent)?.occurredAt ?? null;
  const sessionIsStale = input.freshness.status === 'stale'
    || (input.operationalStatus.connectorStatus === 'stale' && input.activeSessions.length > 0);
  const sessionStatus: ServerHealthStatus = sessionIsStale ? 'warning' : 'healthy';
  const reasons: string[] = [];

  if (input.freshness.status === 'error' || input.freshness.status === 'stale' || input.freshness.status === 'historical') {
    reasons.push(input.freshness.explanation);
  } else if (input.freshness.status === 'not_started') {
    reasons.push('Connector has not reported and no server activity has been observed.');
  }

  if (collectorHealth.unhealthyCollectors > 0) {
    reasons.push(`${collectorHealth.unhealthyCollectors} collector issue${collectorHealth.unhealthyCollectors === 1 ? '' : 's'} detected.`);
  }

  if (logTruthHealth?.status === 'unhealthy') {
    reasons.push('Log truth storage is unhealthy.');
  }

  if (sessionIsStale) {
    reasons.push('Active session state may be stale.');
  }

  const telemetryStatus = getTelemetryStatus({
    freshnessStatus: input.freshness.status,
    collectorHealth,
    logTruthStatus: logTruthHealth?.status ?? null,
    sessionStatus
  });
  const engagementStatus = getEngagementStatus({
    telemetryStatus,
    currentPlayers,
    uniquePlayersThisWeek
  });
  const telemetryHeadline = getTelemetryHeadline(telemetryStatus);
  const engagementHeadline = getEngagementHeadline({
    status: engagementStatus,
    currentPlayers,
    uniquePlayersThisWeek
  });
  const explanation = telemetryStatus === 'healthy'
    ? 'Connector telemetry, collectors, Log Truth, and session state are currently healthy.'
    : Array.from(new Set(reasons)).join(' ');

  return serverHealthSummarySchema.parse({
    serverId: input.serverId,
    status: telemetryStatus,
    headline: `${telemetryHeadline}; ${engagementHeadline}`,
    explanation,
    recommendedAction: getRecommendedAction(telemetryStatus, reasons),
    generatedAt: input.now.toISOString(),
    currentPlayers,
    uniquePlayersThisWeek,
    lastPlayerActivityAt,
    lastWorldSaveAt,
    telemetryHealth: {
      status: telemetryStatus,
      headline: telemetryHeadline,
      explanation
    },
    engagementHealth: {
      status: engagementStatus,
      headline: engagementHeadline,
      explanation: engagementStatus === 'unknown'
        ? 'Engagement cannot be trusted until telemetry is healthy.'
        : uniquePlayersThisWeek > 0
          ? 'Recent player activity was captured from sessions and player intelligence.'
          : 'Telemetry is available, but no player activity has been captured this week.',
      currentPlayers,
      uniquePlayersThisWeek,
      lastPlayerActivityAt
    },
    collectorHealth,
    logTruthHealth,
    sessionHealth: {
      status: sessionStatus,
      activeSessions: input.activeSessions.length,
      recentClosedSessions: input.recentClosedSessions.length,
      stale: sessionIsStale,
      explanation: sessionIsStale
        ? 'Connector heartbeat is stale while sessions are still active.'
        : 'Session tracking is current.'
    },
    telemetry: {
      status: input.freshness.status,
      connectorStatus: input.operationalStatus.connectorStatus,
      lastHeartbeatAt: input.operationalStatus.lastHeartbeatAt,
      lastSuccessfulPollAt: input.operationalStatus.lastSuccessfulPollAt
    }
  });
}
