import {
  connectorHeartbeatSchema,
  serverOperationalStatusSchema,
  type ConnectorHeartbeat,
  type ServerOperationalStatus
} from '@gameops/shared';

const HEARTBEAT_STALE_AFTER_MS = 30_000;

const heartbeatByServerId = new Map<string, ConnectorHeartbeat>();

function getHeartbeatAgeSeconds(heartbeat: ConnectorHeartbeat, nowMs: number): number | null {
  const observedAtMs = Date.parse(heartbeat.observedAt);

  if (!Number.isFinite(observedAtMs)) {
    return null;
  }

  return Math.max(0, Math.floor((nowMs - observedAtMs) / 1000));
}

function formatAge(seconds: number | null): string {
  if (seconds === null) {
    return 'an unknown time ago';
  }

  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
  }

  const minutes = Math.floor(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
}

export function recordConnectorHeartbeat(input: ConnectorHeartbeat): ConnectorHeartbeat {
  const heartbeat = connectorHeartbeatSchema.parse(input);
  heartbeatByServerId.set(heartbeat.serverId, heartbeat);
  return heartbeat;
}

export function getServerOperationalStatus(serverId: string, configured: boolean, now = new Date()): ServerOperationalStatus {
  const heartbeat = heartbeatByServerId.get(serverId) ?? null;

  if (!configured) {
    return serverOperationalStatusSchema.parse({
      serverId,
      configured: false,
      connectorStatus: 'unknown',
      lastHeartbeatAt: null,
      lastSuccessfulPollAt: null,
      explanation: 'Server is not present in the GameOps configuration.',
      heartbeatAgeSeconds: null,
      consecutiveFailureCount: null,
      connectorMode: null,
      capabilities: []
    });
  }

  if (!heartbeat) {
    return serverOperationalStatusSchema.parse({
      serverId,
      configured: true,
      connectorStatus: 'unknown',
      lastHeartbeatAt: null,
      lastSuccessfulPollAt: null,
      explanation: 'Configured, but connector has not reported yet.',
      heartbeatAgeSeconds: null,
      consecutiveFailureCount: null,
      connectorMode: null,
      capabilities: []
    });
  }

  const nowMs = now.getTime();
  const heartbeatAgeSeconds = getHeartbeatAgeSeconds(heartbeat, nowMs);
  const observedAtMs = Date.parse(heartbeat.observedAt);
  const isStale = Number.isFinite(observedAtMs) && nowMs - observedAtMs > HEARTBEAT_STALE_AFTER_MS;
  const connectorStatus = isStale
    ? 'stale'
    : heartbeat.status;
  const failureCount = heartbeat.consecutiveFailureCount ?? null;

  let explanation: string;

  if (connectorStatus === 'stale') {
    explanation = `Connector stale. Last heard ${formatAge(heartbeatAgeSeconds)}.`;
  } else if (connectorStatus === 'error') {
    explanation = failureCount !== null && failureCount > 0
      ? `Connector reporting errors after ${failureCount} consecutive failed poll${failureCount === 1 ? '' : 's'}.`
      : `Connector reporting an error: ${heartbeat.message}`;
  } else if (connectorStatus === 'degraded') {
    explanation = failureCount !== null && failureCount > 0
      ? `Connector degraded after ${failureCount} consecutive failed poll${failureCount === 1 ? '' : 's'}.`
      : `Connector degraded: ${heartbeat.message}`;
  } else {
    explanation = `Connector running. Last heard ${formatAge(heartbeatAgeSeconds)}.`;
  }

  return serverOperationalStatusSchema.parse({
    serverId,
    configured: true,
    connectorStatus,
    lastHeartbeatAt: heartbeat.observedAt,
    lastSuccessfulPollAt: heartbeat.lastSuccessfulPollAt ?? null,
    explanation,
    heartbeatAgeSeconds,
    consecutiveFailureCount: failureCount,
    connectorMode: heartbeat.connectorMode,
    capabilities: heartbeat.capabilities
  });
}

export function clearConnectorHeartbeatsForTests(): void {
  heartbeatByServerId.clear();
}
