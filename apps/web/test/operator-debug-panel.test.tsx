import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  DataFreshnessResponse,
  PlayerActivityCaptureVerification,
  ServerOperationalStatus
} from '@gameops/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OperatorDebugPanel, type OperatorDebugServer } from '../src/operator-debug-panel.tsx';

const generatedAt = '2026-06-30T12:00:00.000Z';

function operationalStatus(overrides: Partial<ServerOperationalStatus> = {}): ServerOperationalStatus {
  return {
    serverId: 'server-1',
    configured: true,
    connectorStatus: 'running',
    lastHeartbeatAt: generatedAt,
    lastSuccessfulPollAt: generatedAt,
    explanation: 'Connector is current.',
    heartbeatAgeSeconds: 5,
    consecutiveFailureCount: 0,
    connectorMode: 'journal',
    capabilities: [],
    collectors: [],
    ...overrides
  };
}

function dataFreshness(overrides: Partial<DataFreshnessResponse> = {}): DataFreshnessResponse {
  return {
    serverId: 'server-1',
    status: 'live',
    headline: 'Telemetry is live.',
    explanation: 'Recent connector heartbeat is available.',
    lastHeartbeatAt: generatedAt,
    heartbeatAgeSeconds: 5,
    lastSuccessfulPollAt: generatedAt,
    lastEventAt: generatedAt,
    lastSessionActivityAt: generatedAt,
    connectorStatus: 'running',
    confidence: 'high',
    trustWarnings: [],
    recommendedAction: 'Continue monitoring.',
    logTruth: {
      status: 'healthy',
      path: '/tmp/log-truth.json',
      readable: true,
      writable: true,
      lastSuccessfulAppendAt: generatedAt,
      lastError: null,
      totalEventCount: 42
    },
    ...overrides
  };
}

function playerActivityCapture(overrides: Partial<PlayerActivityCaptureVerification> = {}): PlayerActivityCaptureVerification {
  return {
    serverId: 'server-1',
    generatedAt,
    status: 'ready',
    recommendedAction: 'Collector healthy; no players currently online.',
    latestPlayerJoinEvent: null,
    latestPlayerLeaveEvent: null,
    latestSessionStartAt: null,
    latestSessionCloseAt: null,
    latestKnownPlayerUpdateAt: null,
    latestCollectorSnapshotPollAt: generatedAt,
    playerIdentityFieldsPresent: null,
    evidenceSummary: ['No player join event captured yet.'],
    ...overrides
  };
}

function renderServer(server: Partial<OperatorDebugServer>): string {
  return renderToStaticMarkup(
    <OperatorDebugPanel
      servers={[{
        serverId: 'server-1',
        displayName: 'Test Server',
        game: 'valheim',
        operationalStatus: operationalStatus(),
        dataFreshness: dataFreshness(),
        playerActivityCapture: playerActivityCapture(),
        ...server
      }]}
    />
  );
}

test('operator debug panel renders healthy Valheim shadow collector', () => {
  const html = renderServer({
    displayName: 'Valheim Local',
    operationalStatus: operationalStatus({
      collectors: [{
        collectorId: 'valheim',
        name: 'Valheim Collector Shadow',
        game: 'valheim',
        enabled: true,
        lastSuccessfulCollectionAt: null,
        lastError: null,
        lastCollectionDurationMs: 12,
        totalEventsEmitted: 0,
        shadow: {
          enabled: true,
          lastRunAt: generatedAt,
          lastDurationMs: 12,
          eventCount: 45,
          eventTypes: ['world_saved', 'connection_count'],
          lastError: null,
          parityStatus: 'matching'
        }
      }]
    })
  });

  assert.match(html, /Valheim Local/);
  assert.match(html, /Player Capture/);
  assert.match(html, /Collector healthy; no players currently online/);
  assert.match(html, /Valheim Collector Shadow/);
  assert.match(html, /Events: 45/);
  assert.match(html, /Parity: matching/);
});

test('operator debug panel renders healthy Palworld snapshot collector', () => {
  const html = renderServer({
    displayName: 'Palworld Fantasy',
    game: 'palworld',
    operationalStatus: operationalStatus({
      connectorMode: 'rest',
      collectors: [{
        collectorId: 'palworld',
        name: 'Palworld Snapshot Collector',
        game: 'palworld',
        enabled: true,
        lastSuccessfulCollectionAt: generatedAt,
        lastError: null,
        lastCollectionDurationMs: 18,
        totalEventsEmitted: 3,
        snapshot: {
          snapshotSize: 2,
          joinedCount: 1,
          leftCount: 0,
          lastSuccessfulPollAt: generatedAt,
          lastError: null
        }
      }]
    })
  });

  assert.match(html, /Palworld Fantasy/);
  assert.match(html, /Palworld Snapshot Collector/);
  assert.match(html, /Snapshot: 2/);
  assert.match(html, /Joined: 1/);
  assert.match(html, /Left: 0/);
});

test('operator debug panel renders unhealthy collector error state', () => {
  const html = renderServer({
    operationalStatus: operationalStatus({
      connectorStatus: 'degraded',
      collectors: [{
        collectorId: 'valheim',
        name: 'Valheim Collector Shadow',
        game: 'valheim',
        enabled: true,
        lastSuccessfulCollectionAt: null,
        lastError: 'journal read failed',
        lastCollectionDurationMs: null,
        totalEventsEmitted: 0
      }]
    })
  });

  assert.match(html, /degraded/);
  assert.match(html, /journal read failed/);
});

test('operator debug panel renders log truth warning state', () => {
  const html = renderServer({
    dataFreshness: dataFreshness({
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

  assert.match(html, /Log Truth/);
  assert.match(html, /Readable: no/);
  assert.match(html, /Writable: no/);
  assert.match(html, /Durable events: 0/);
  assert.match(html, /permission denied/);
});

test('operator debug panel renders player capture issue state', () => {
  const html = renderServer({
    playerActivityCapture: playerActivityCapture({
      status: 'issue_detected',
      recommendedAction: 'Player activity was seen, but identity fields were missing.',
      latestPlayerJoinEvent: {
        occurredAt: generatedAt,
        playerName: null,
        identityFieldsPresent: false,
        eventId: 'event-1'
      },
      playerIdentityFieldsPresent: false
    })
  });

  assert.match(html, /issue detected/);
  assert.match(html, /Identity: missing/);
  assert.match(html, /Player activity was seen, but identity fields were missing/);
});
