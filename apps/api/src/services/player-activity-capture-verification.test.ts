import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  KnownPlayerRecord,
  NormalizedEvent,
  ServerOperationalStatus,
  SessionRecord
} from '@gameops/shared';
import { buildPlayerActivityCaptureVerification } from './player-activity-capture-verification.js';

const now = new Date('2026-07-01T12:00:00.000Z');

function operationalStatus(overrides: Partial<ServerOperationalStatus> = {}): ServerOperationalStatus {
  return {
    serverId: 'pal-1',
    configured: true,
    connectorStatus: 'running',
    lastHeartbeatAt: '2026-07-01T12:00:00.000Z',
    lastSuccessfulPollAt: '2026-07-01T12:00:00.000Z',
    explanation: 'Connector running.',
    heartbeatAgeSeconds: 1,
    consecutiveFailureCount: 0,
    connectorMode: 'rest',
    capabilities: [],
    collectors: [],
    ...overrides
  };
}

function event(overrides: Partial<NormalizedEvent>): NormalizedEvent {
  return {
    id: 'event-1',
    game: 'palworld',
    serverId: 'pal-1',
    eventType: 'PLAYER_JOIN',
    playerName: 'Mira',
    platformId: 'steam_123',
    occurredAt: '2026-07-01T11:58:00.000Z',
    ...overrides
  };
}

function session(overrides: Partial<SessionRecord>): SessionRecord {
  return {
    serverId: 'pal-1',
    playerName: 'Mira',
    startedAt: '2026-07-01T11:58:00.000Z',
    endedAt: '2026-07-01T12:00:00.000Z',
    durationSeconds: 120,
    sourceEventIds: ['join', 'leave'],
    ...overrides
  };
}

function knownPlayer(overrides: Partial<KnownPlayerRecord>): KnownPlayerRecord {
  return {
    serverId: 'pal-1',
    displayName: 'Mira',
    normalizedPlayerKey: 'mira',
    knownPlatformIds: ['steam_123'],
    knownPlayFabIds: [],
    knownCharacterIds: [],
    identitySources: ['test'],
    observationCount: 1,
    confidence: 'high',
    firstSeenAt: '2026-07-01T11:58:00.000Z',
    lastSeenAt: '2026-07-01T12:00:00.000Z',
    ...overrides
  };
}

function build(input: {
  recentEvents?: NormalizedEvent[];
  activeSessions?: SessionRecord[];
  recentClosedSessions?: SessionRecord[];
  knownPlayers?: KnownPlayerRecord[];
  operationalStatus?: ServerOperationalStatus;
}) {
  return buildPlayerActivityCaptureVerification({
    serverId: 'pal-1',
    now,
    recentEvents: input.recentEvents ?? [],
    activeSessions: input.activeSessions ?? [],
    recentClosedSessions: input.recentClosedSessions ?? [],
    knownPlayers: input.knownPlayers ?? [],
    operationalStatus: input.operationalStatus ?? operationalStatus()
  });
}

test('capture verification waits when no player events or snapshot polls exist yet', () => {
  const result = build({});

  assert.equal(result.status, 'waiting_for_player_activity');
  assert.equal(result.latestPlayerJoinEvent, null);
  assert.equal(result.latestCollectorSnapshotPollAt, null);
  assert.equal(result.recommendedAction, 'Waiting for next Palworld snapshot.');
});

test('capture verification is ready when collector polls with no online players', () => {
  const result = build({
    operationalStatus: operationalStatus({
      collectors: [{
        collectorId: 'palworld:pal-1:rest',
        name: 'Palworld Snapshot Collector',
        game: 'palworld',
        enabled: true,
        lastSuccessfulCollectionAt: '2026-07-01T11:59:00.000Z',
        lastError: null,
        lastCollectionDurationMs: 20,
        totalEventsEmitted: 0,
        snapshot: {
          snapshotSize: 0,
          joinedCount: 0,
          leftCount: 0,
          lastSuccessfulPollAt: '2026-07-01T11:59:00.000Z',
          lastError: null
        }
      }]
    })
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.latestCollectorSnapshotPollAt, '2026-07-01T11:59:00.000Z');
  assert.equal(result.recommendedAction, 'Collector healthy; no players currently online.');
});

test('capture verification reports capturing when a join is captured with identity fields', () => {
  const result = build({
    recentEvents: [event({ eventType: 'PLAYER_JOIN' })]
  });

  assert.equal(result.status, 'capturing');
  assert.equal(result.latestPlayerJoinEvent?.playerName, 'Mira');
  assert.equal(result.latestPlayerJoinEvent?.identityFieldsPresent, true);
  assert.equal(result.playerIdentityFieldsPresent, true);
});

test('capture verification reports capture evidence for leave and closed session', () => {
  const result = build({
    recentEvents: [
      event({ id: 'join', eventType: 'PLAYER_JOIN', occurredAt: '2026-07-01T11:58:00.000Z' }),
      event({ id: 'leave', eventType: 'PLAYER_LEAVE', occurredAt: '2026-07-01T12:00:00.000Z' })
    ],
    recentClosedSessions: [session({})],
    knownPlayers: [knownPlayer({})]
  });

  assert.equal(result.status, 'capturing');
  assert.equal(result.latestPlayerLeaveEvent?.eventId, 'leave');
  assert.equal(result.latestSessionStartAt, '2026-07-01T11:58:00.000Z');
  assert.equal(result.latestSessionCloseAt, '2026-07-01T12:00:00.000Z');
  assert.equal(result.latestKnownPlayerUpdateAt, '2026-07-01T12:00:00.000Z');
});

test('capture verification flags player activity without identity fields', () => {
  const result = build({
    recentEvents: [
      event({
        playerName: undefined,
        platformId: undefined,
        raw: {},
        eventType: 'PLAYER_JOIN'
      })
    ]
  });

  assert.equal(result.status, 'issue_detected');
  assert.equal(result.playerIdentityFieldsPresent, false);
  assert.equal(result.recommendedAction, 'Player activity was seen, but identity fields were missing.');
});

test('capture verification accepts live Valheim leave when session close has correlated player', () => {
  const result = build({
    recentEvents: [
      event({
        id: 'live-join-cdawg',
        eventType: 'PLAYER_JOIN',
        playerName: 'CdAwG',
        platformId: undefined,
        occurredAt: '2026-07-01T20:33:10.384Z'
      }),
      event({
        id: 'live-leave-cdawg',
        eventType: 'PLAYER_LEAVE',
        playerName: undefined,
        platformId: undefined,
        occurredAt: '2026-07-01T20:38:03.960Z',
        raw: {
          valheimDisconnectRule: 'structured_connection_lost',
          valheimCurrentPlayerCount: 0,
          valheimEventSource: 'journal'
        }
      })
    ],
    recentClosedSessions: [
      session({
        playerName: 'CdAwG',
        startedAt: '2026-07-01T20:33:10.384Z',
        endedAt: '2026-07-01T20:38:03.960Z',
        durationSeconds: 293,
        sourceEventIds: ['live-join-cdawg', 'live-leave-cdawg']
      })
    ]
  });

  assert.equal(result.status, 'capturing');
  assert.equal(result.latestPlayerLeaveEvent?.playerName, 'CdAwG');
  assert.equal(result.latestPlayerLeaveEvent?.identityFieldsPresent, true);
  assert.equal(result.playerIdentityFieldsPresent, true);
});
