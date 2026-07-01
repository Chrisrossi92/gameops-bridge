import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  CollectorHealth,
  DataFreshnessResponse,
  NormalizedEvent,
  PlayerIntelligenceResponse,
  ServerOperationalStatus,
  SessionRecord
} from '@gameops/shared';
import { buildServerHealthSummary } from './server-health-summary.js';

const now = new Date('2026-06-11T12:00:08.000Z');
const generatedAt = '2026-06-11T12:00:00.000Z';

function operationalStatus(overrides: Partial<ServerOperationalStatus> = {}): ServerOperationalStatus {
  return {
    serverId: 'health-test',
    configured: true,
    connectorStatus: 'running',
    lastHeartbeatAt: generatedAt,
    lastSuccessfulPollAt: generatedAt,
    explanation: 'Connector running.',
    heartbeatAgeSeconds: 8,
    consecutiveFailureCount: 0,
    connectorMode: 'journal',
    capabilities: [],
    collectors: [],
    ...overrides
  };
}

function freshness(overrides: Partial<DataFreshnessResponse> = {}): DataFreshnessResponse {
  return {
    serverId: 'health-test',
    status: 'live',
    headline: 'Live data',
    explanation: 'Live: connector last heard 8 seconds ago.',
    lastHeartbeatAt: generatedAt,
    heartbeatAgeSeconds: 8,
    lastSuccessfulPollAt: generatedAt,
    lastEventAt: null,
    lastSessionActivityAt: null,
    connectorStatus: 'running',
    confidence: 'high',
    trustWarnings: [],
    recommendedAction: 'No action needed',
    logTruth: {
      status: 'healthy',
      path: '/tmp/log-truth.json',
      readable: true,
      writable: true,
      lastSuccessfulAppendAt: generatedAt,
      lastError: null,
      totalEventCount: 1
    },
    ...overrides
  };
}

function playerIntelligence(players: PlayerIntelligenceResponse['players'] = []): PlayerIntelligenceResponse {
  return {
    serverId: 'health-test',
    explanation: 'Player intelligence test data.',
    players
  };
}

function player(name: string, lastSeenAt: string): PlayerIntelligenceResponse['players'][number] {
  return {
    playerId: `health-test:${name}`,
    serverId: 'health-test',
    displayName: name,
    aliases: [],
    game: 'valheim',
    identityConfidence: 'high',
    identityExplanation: 'Test player.',
    firstSeenAt: lastSeenAt,
    lastSeenAt,
    isOnline: false,
    activeSessionId: null,
    totalTrackedSeconds: 600,
    sessionCount: 1,
    averageSessionSeconds: 600,
    sourceSummary: ['test']
  };
}

function activeSession(playerName: string): SessionRecord {
  return {
    serverId: 'health-test',
    playerName,
    startedAt: '2026-06-11T12:00:01.000Z',
    startConfidence: 'high',
    sourceEventIds: ['join-1']
  };
}

function collector(overrides: Partial<CollectorHealth> = {}): CollectorHealth {
  return {
    collectorId: 'valheim',
    name: 'Valheim Collector Shadow',
    game: 'valheim',
    enabled: true,
    lastSuccessfulCollectionAt: generatedAt,
    lastError: null,
    lastCollectionDurationMs: 10,
    totalEventsEmitted: 2,
    ...overrides
  };
}

function worldSave(): NormalizedEvent {
  return {
    id: 'world-save',
    game: 'valheim',
    serverId: 'health-test',
    eventType: 'HEALTH_WARN',
    message: 'World saved',
    occurredAt: '2026-06-11T12:00:02.000Z',
    raw: { valheimEventCategory: 'world_saved' }
  };
}

function build(overrides: Partial<Parameters<typeof buildServerHealthSummary>[0]> = {}) {
  return buildServerHealthSummary({
    serverId: 'health-test',
    now,
    operationalStatus: operationalStatus(),
    freshness: freshness(),
    playerIntelligence: playerIntelligence(),
    activeSessions: [],
    recentClosedSessions: [],
    recentEvents: [],
    ...overrides
  });
}

test('server health separates healthy telemetry with no activity', () => {
  const result = build();

  assert.equal(result.status, 'healthy');
  assert.equal(result.telemetryHealth.status, 'healthy');
  assert.equal(result.engagementHealth.status, 'inactive');
  assert.equal(result.headline, 'Telemetry healthy; no player activity captured this week');
});

test('server health separates healthy telemetry with active players', () => {
  const result = build({
    operationalStatus: operationalStatus({ collectors: [collector()] }),
    playerIntelligence: playerIntelligence([player('Mira', '2026-06-11T12:00:01.000Z')]),
    activeSessions: [activeSession('Mira')],
    recentEvents: [worldSave()]
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.telemetryHealth.status, 'healthy');
  assert.equal(result.engagementHealth.status, 'active');
  assert.equal(result.currentPlayers, 1);
  assert.equal(result.uniquePlayersThisWeek, 1);
  assert.equal(result.lastWorldSaveAt, '2026-06-11T12:00:02.000Z');
  assert.equal(result.headline, 'Telemetry healthy; 1 player active this week');
});

test('server health reports unhealthy telemetry with unknown engagement', () => {
  const result = build({
    operationalStatus: operationalStatus({
      collectors: [collector({
        lastSuccessfulCollectionAt: null,
        lastError: 'journal read failed',
        lastCollectionDurationMs: null,
        totalEventsEmitted: 0
      })]
    })
  });

  assert.equal(result.status, 'unhealthy');
  assert.equal(result.telemetryHealth.status, 'unhealthy');
  assert.equal(result.engagementHealth.status, 'unknown');
  assert.equal(result.headline, 'Telemetry unhealthy; engagement unknown');
  assert.equal(result.recommendedAction, 'Check collector logs and heartbeat payloads');
});

test('server health reports stale connector with recent historical activity', () => {
  const result = build({
    operationalStatus: operationalStatus({
      connectorStatus: 'stale',
      heartbeatAgeSeconds: 720,
      explanation: 'Connector stale. Last heard 12 minutes ago.'
    }),
    freshness: freshness({
      status: 'historical',
      headline: 'Historical data only',
      explanation: 'Historical only: connector last heard 12 minutes ago. Showing the latest stored GameOps data.',
      heartbeatAgeSeconds: 720,
      connectorStatus: 'stale',
      lastSessionActivityAt: '2026-06-11T12:10:05.000Z'
    }),
    playerIntelligence: playerIntelligence([player('Iris', '2026-06-11T12:10:05.000Z')])
  });

  assert.equal(result.status, 'warning');
  assert.equal(result.telemetryHealth.status, 'warning');
  assert.equal(result.engagementHealth.status, 'active');
  assert.equal(result.uniquePlayersThisWeek, 1);
  assert.equal(result.headline, 'Telemetry warning; 1 player active this week');
});

test('server health reports unhealthy log truth storage', () => {
  const result = build({
    freshness: freshness({
      status: 'error',
      headline: 'Connector error',
      explanation: 'Log truth storage is unhealthy.',
      confidence: 'low',
      recommendedAction: 'Check log truth storage',
      logTruth: {
        status: 'unhealthy',
        path: '/tmp/log-truth.json',
        readable: false,
        writable: false,
        lastSuccessfulAppendAt: null,
        lastError: 'permission denied',
        totalEventCount: 0
      }
    })
  });

  assert.equal(result.status, 'unhealthy');
  assert.equal(result.telemetryHealth.status, 'unhealthy');
  assert.equal(result.logTruthHealth?.status, 'unhealthy');
  assert.equal(result.recommendedAction, 'Check log truth storage');
});
