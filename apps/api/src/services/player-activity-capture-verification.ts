import {
  playerActivityCaptureVerificationSchema,
  type KnownPlayerRecord,
  type NormalizedEvent,
  type PlayerActivityCaptureEventEvidence,
  type PlayerActivityCaptureStatus,
  type PlayerActivityCaptureVerification,
  type ServerOperationalStatus,
  type SessionRecord
} from '@gameops/shared';
import { getActiveSessionsForServer, getRecentClosedSessionsForServer, getRecentEventsForServer } from './event-store.js';
import { getKnownPlayersForServer } from './known-player-store.js';
import { getServerOperationalStatus } from './connector-heartbeat.js';
import { isServerConfigured } from './server-config.js';

function maxTimestamp(values: Array<string | null | undefined>): string | null {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function latestEvent(events: NormalizedEvent[], eventType: 'PLAYER_JOIN' | 'PLAYER_LEAVE'): NormalizedEvent | null {
  return events
    .filter((event) => event.eventType === eventType)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0] ?? null;
}

function rawString(event: NormalizedEvent, keys: string[]): string | null {
  for (const key of keys) {
    const value = event.raw?.[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function hasIdentityFields(event: NormalizedEvent): boolean {
  return Boolean(
    event.playerName?.trim()
    || event.platformId?.trim()
    || rawString(event, [
      'playerId',
      'player_id',
      'lookupKey',
      'lookup_key',
      'accountName',
      'account_name',
      'userId',
      'user_id',
      'playFabId',
      'playfab_id'
    ])
  );
}

function findMatchingClosedSession(event: NormalizedEvent, sessions: SessionRecord[]): SessionRecord | null {
  return sessions.find((session) => (
    session.endedAt === event.occurredAt
    || session.sourceEventIds.some((sourceEventId) => event.id ? sourceEventId === event.id : sourceEventId.includes(event.occurredAt))
  )) ?? null;
}

function toEventEvidence(event: NormalizedEvent | null, closedSessions: SessionRecord[] = []): PlayerActivityCaptureEventEvidence | null {
  if (!event) {
    return null;
  }

  const matchingSession = event.playerName ? null : findMatchingClosedSession(event, closedSessions);
  const playerName = event.playerName
    ?? rawString(event, ['playerName', 'player_name', 'accountName', 'account_name'])
    ?? matchingSession?.playerName
    ?? null;

  return {
    occurredAt: event.occurredAt,
    playerName,
    identityFieldsPresent: hasIdentityFields(event) || Boolean(matchingSession?.playerName),
    eventId: event.id ?? null
  };
}

function latestSessionStart(sessions: SessionRecord[]): string | null {
  return maxTimestamp(sessions.map((session) => session.startedAt));
}

function latestSessionClose(sessions: SessionRecord[]): string | null {
  return maxTimestamp(sessions.map((session) => session.endedAt ?? null));
}

function latestKnownPlayerUpdate(players: KnownPlayerRecord[]): string | null {
  return maxTimestamp(players.map((player) => player.lastSeenAt));
}

function latestCollectorSnapshotPoll(operationalStatus: ServerOperationalStatus): string | null {
  return maxTimestamp(operationalStatus.collectors.map((collector) => collector.snapshot?.lastSuccessfulPollAt ?? null));
}

function collectorSnapshotSize(operationalStatus: ServerOperationalStatus): number | null {
  const snapshots = operationalStatus.collectors
    .map((collector) => collector.snapshot?.snapshotSize)
    .filter((value): value is number => typeof value === 'number');

  if (snapshots.length === 0) {
    return null;
  }

  return snapshots.reduce((sum, value) => sum + value, 0);
}

function collectorHasError(operationalStatus: ServerOperationalStatus): boolean {
  return operationalStatus.collectors.some((collector) => Boolean(
    collector.lastError
    || collector.shadow?.lastError
    || collector.snapshot?.lastError
  ));
}

function getStatus(input: {
  operationalStatus: ServerOperationalStatus;
  latestJoin: PlayerActivityCaptureEventEvidence | null;
  latestLeave: PlayerActivityCaptureEventEvidence | null;
  latestSessionStartAt: string | null;
  latestSessionCloseAt: string | null;
  latestKnownPlayerUpdateAt: string | null;
  latestCollectorSnapshotPollAt: string | null;
  snapshotSize: number | null;
  playerIdentityFieldsPresent: boolean | null;
}): PlayerActivityCaptureStatus {
  const connectorIssue = input.operationalStatus.connectorStatus === 'error'
    || input.operationalStatus.connectorStatus === 'degraded'
    || input.operationalStatus.connectorStatus === 'stale';

  if (connectorIssue || collectorHasError(input.operationalStatus) || input.playerIdentityFieldsPresent === false) {
    return 'issue_detected';
  }

  if (
    input.latestJoin
    || input.latestLeave
    || input.latestSessionStartAt
    || input.latestSessionCloseAt
    || input.latestKnownPlayerUpdateAt
  ) {
    return 'capturing';
  }

  if (input.latestCollectorSnapshotPollAt && input.snapshotSize === 0) {
    return 'ready';
  }

  return 'waiting_for_player_activity';
}

function getRecommendedAction(input: {
  status: PlayerActivityCaptureStatus;
  operationalStatus: ServerOperationalStatus;
  latestCollectorSnapshotPollAt: string | null;
  snapshotSize: number | null;
  playerIdentityFieldsPresent: boolean | null;
}): string {
  if (input.status === 'issue_detected') {
    if (input.playerIdentityFieldsPresent === false) {
      return 'Player activity was seen, but identity fields were missing.';
    }

    return 'Check connector and collector health before asking players to test.';
  }

  if (input.status === 'capturing') {
    return 'Player activity is being captured; verify join and leave both appear after a short session.';
  }

  if (input.latestCollectorSnapshotPollAt && input.snapshotSize === 0) {
    return 'Collector healthy; no players currently online.';
  }

  if (input.operationalStatus.connectorMode === 'rest') {
    return 'Waiting for next Palworld snapshot.';
  }

  return 'Ask a player to join for 2 minutes.';
}

function summarizeEvidence(input: {
  latestJoin: PlayerActivityCaptureEventEvidence | null;
  latestLeave: PlayerActivityCaptureEventEvidence | null;
  latestSessionStartAt: string | null;
  latestSessionCloseAt: string | null;
  latestKnownPlayerUpdateAt: string | null;
  latestCollectorSnapshotPollAt: string | null;
}): string[] {
  return [
    input.latestJoin ? `Latest join: ${input.latestJoin.occurredAt}` : 'No player join event captured yet.',
    input.latestLeave ? `Latest leave: ${input.latestLeave.occurredAt}` : 'No player leave event captured yet.',
    input.latestSessionStartAt ? `Latest session start: ${input.latestSessionStartAt}` : 'No session start captured yet.',
    input.latestSessionCloseAt ? `Latest session close: ${input.latestSessionCloseAt}` : 'No session close captured yet.',
    input.latestKnownPlayerUpdateAt ? `Latest known player update: ${input.latestKnownPlayerUpdateAt}` : 'No known player update captured yet.',
    input.latestCollectorSnapshotPollAt ? `Latest collector snapshot poll: ${input.latestCollectorSnapshotPollAt}` : 'No collector snapshot poll captured yet.'
  ];
}

export function buildPlayerActivityCaptureVerification(input: {
  serverId: string;
  now: Date;
  recentEvents: NormalizedEvent[];
  activeSessions: SessionRecord[];
  recentClosedSessions: SessionRecord[];
  knownPlayers: KnownPlayerRecord[];
  operationalStatus: ServerOperationalStatus;
}): PlayerActivityCaptureVerification {
  const latestJoin = toEventEvidence(latestEvent(input.recentEvents, 'PLAYER_JOIN'), input.recentClosedSessions);
  const latestLeave = toEventEvidence(latestEvent(input.recentEvents, 'PLAYER_LEAVE'), input.recentClosedSessions);
  const latestPlayerEvidence = [latestJoin, latestLeave]
    .filter((value): value is PlayerActivityCaptureEventEvidence => Boolean(value))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0] ?? null;
  const latestSessionStartAt = latestSessionStart([...input.activeSessions, ...input.recentClosedSessions]);
  const latestSessionCloseAt = latestSessionClose(input.recentClosedSessions);
  const latestKnownPlayerUpdateAt = latestKnownPlayerUpdate(input.knownPlayers);
  const latestCollectorSnapshotPollAt = latestCollectorSnapshotPoll(input.operationalStatus);
  const snapshotSize = collectorSnapshotSize(input.operationalStatus);
  const playerIdentityFieldsPresent = latestPlayerEvidence?.identityFieldsPresent ?? null;
  const status = getStatus({
    operationalStatus: input.operationalStatus,
    latestJoin,
    latestLeave,
    latestSessionStartAt,
    latestSessionCloseAt,
    latestKnownPlayerUpdateAt,
    latestCollectorSnapshotPollAt,
    snapshotSize,
    playerIdentityFieldsPresent
  });

  return playerActivityCaptureVerificationSchema.parse({
    serverId: input.serverId,
    generatedAt: input.now.toISOString(),
    status,
    recommendedAction: getRecommendedAction({
      status,
      operationalStatus: input.operationalStatus,
      latestCollectorSnapshotPollAt,
      snapshotSize,
      playerIdentityFieldsPresent
    }),
    latestPlayerJoinEvent: latestJoin,
    latestPlayerLeaveEvent: latestLeave,
    latestSessionStartAt,
    latestSessionCloseAt,
    latestKnownPlayerUpdateAt,
    latestCollectorSnapshotPollAt,
    playerIdentityFieldsPresent,
    evidenceSummary: summarizeEvidence({
      latestJoin,
      latestLeave,
      latestSessionStartAt,
      latestSessionCloseAt,
      latestKnownPlayerUpdateAt,
      latestCollectorSnapshotPollAt
    })
  });
}

export function getPlayerActivityCaptureVerificationForServer(
  serverId: string,
  now = new Date()
): PlayerActivityCaptureVerification {
  return buildPlayerActivityCaptureVerification({
    serverId,
    now,
    recentEvents: getRecentEventsForServer(serverId, 100),
    activeSessions: getActiveSessionsForServer(serverId),
    recentClosedSessions: getRecentClosedSessionsForServer(serverId, 100),
    knownPlayers: getKnownPlayersForServer(serverId, 10_000),
    operationalStatus: getServerOperationalStatus(serverId, isServerConfigured(serverId), now)
  });
}
