import assert from 'node:assert/strict';
import test from 'node:test';
import type { ServerHealthSummary } from '@gameops/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OperatorServerHealthCard } from '../src/operator-server-health-card.tsx';

const generatedAt = '2026-06-30T12:00:00.000Z';

function health(overrides: Partial<ServerHealthSummary> = {}): ServerHealthSummary {
  return {
    serverId: 'server-1',
    status: 'healthy',
    headline: 'Healthy: 1 online, 2 active this week',
    explanation: 'Connector telemetry, collectors, Log Truth, and session state are currently healthy.',
    generatedAt,
    currentPlayers: 1,
    uniquePlayersThisWeek: 2,
    lastPlayerActivityAt: generatedAt,
    lastWorldSaveAt: generatedAt,
    telemetryHealth: {
      status: 'healthy',
      headline: 'Telemetry healthy',
      explanation: 'Connector telemetry, collectors, Log Truth, and session state are currently healthy.'
    },
    engagementHealth: {
      status: 'active',
      headline: '2 players active this week',
      explanation: 'Recent player activity was captured from sessions and player intelligence.',
      currentPlayers: 1,
      uniquePlayersThisWeek: 2,
      lastPlayerActivityAt: generatedAt
    },
    collectorHealth: {
      status: 'healthy',
      totalCollectors: 1,
      enabledCollectors: 1,
      unhealthyCollectors: 0,
      lastSuccessfulCollectionAt: generatedAt,
      summaries: ['Valheim Collector Shadow: enabled']
    },
    logTruthHealth: {
      status: 'healthy',
      path: '/tmp/log-truth.json',
      readable: true,
      writable: true,
      lastSuccessfulAppendAt: generatedAt,
      lastError: null,
      totalEventCount: 10
    },
    sessionHealth: {
      status: 'healthy',
      activeSessions: 1,
      recentClosedSessions: 1,
      stale: false,
      explanation: 'Session tracking is current.'
    },
    telemetry: {
      status: 'live',
      connectorStatus: 'running',
      lastHeartbeatAt: generatedAt,
      lastSuccessfulPollAt: generatedAt
    },
    ...overrides
  };
}

test('operator server health card renders telemetry and engagement health separately', () => {
  const html = renderToStaticMarkup(
    <OperatorServerHealthCard
      servers={[
        {
          displayName: 'Valheim Local',
          game: 'valheim',
          health: health()
        },
        {
          displayName: 'Quiet Server',
          game: 'valheim',
          health: health({
            serverId: 'server-2',
            status: 'healthy',
            headline: 'Telemetry healthy; no player activity captured this week',
            currentPlayers: 0,
            uniquePlayersThisWeek: 0,
            lastPlayerActivityAt: null,
            lastWorldSaveAt: null,
            telemetryHealth: {
              status: 'healthy',
              headline: 'Telemetry healthy',
              explanation: 'Connector telemetry, collectors, Log Truth, and session state are currently healthy.'
            },
            engagementHealth: {
              status: 'inactive',
              headline: 'no player activity captured this week',
              explanation: 'Telemetry is available, but no player activity has been captured this week.',
              currentPlayers: 0,
              uniquePlayersThisWeek: 0,
              lastPlayerActivityAt: null
            },
            telemetry: {
              status: 'live',
              connectorStatus: 'running',
              lastHeartbeatAt: generatedAt,
              lastSuccessfulPollAt: generatedAt
            }
          })
        },
        {
          displayName: 'Collector Error',
          game: 'palworld',
          health: health({
            serverId: 'server-3',
            status: 'unhealthy',
            headline: 'Telemetry unhealthy; engagement unknown',
            recommendedAction: 'Check collector logs and heartbeat payloads',
            telemetryHealth: {
              status: 'unhealthy',
              headline: 'Telemetry unhealthy',
              explanation: '1 collector issue detected.'
            },
            engagementHealth: {
              status: 'unknown',
              headline: 'engagement unknown',
              explanation: 'Engagement cannot be trusted until telemetry is healthy.',
              currentPlayers: 0,
              uniquePlayersThisWeek: 0,
              lastPlayerActivityAt: null
            },
            collectorHealth: {
              status: 'unhealthy',
              totalCollectors: 1,
              enabledCollectors: 1,
              unhealthyCollectors: 1,
              lastSuccessfulCollectionAt: null,
              summaries: ['Palworld Snapshot Collector: error']
            }
          })
        }
      ]}
    />
  );

  assert.match(html, /Server Health/);
  assert.match(html, /Valheim Local/);
  assert.match(html, /Telemetry: healthy/);
  assert.match(html, /Engagement: active/);
  assert.match(html, /Telemetry healthy; no player activity captured this week/);
  assert.match(html, /Quiet Server/);
  assert.match(html, /Engagement: inactive/);
  assert.match(html, /Collector Error/);
  assert.match(html, /Telemetry unhealthy; engagement unknown/);
  assert.match(html, /Engagement: unknown/);
  assert.match(html, /Players: 1/);
  assert.match(html, /Week: 2/);
  assert.match(html, /Log Truth: healthy/);
});
