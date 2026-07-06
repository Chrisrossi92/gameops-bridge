import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  DataFreshnessResponse,
  ObservedSettingsResponse,
  PalworldGuildActivityEntry,
  PalworldLatestPlayerTelemetry,
  PalworldMetricsSummary,
  ServerHealthSummary,
  ServerOperationalStatus,
  ServerSettingsCapabilitySummary,
  SessionTimelineResponse
} from '@gameops/shared';
import { buildPalworldActivityConfidenceReport } from '../src/palworld-activity-confidence.ts';
import type { WorldChronicleEvent } from '../src/world-memory.ts';

const now = '2026-07-06T12:00:00.000Z';

function operationalStatus(overrides: Partial<ServerOperationalStatus> = {}): ServerOperationalStatus {
  return {
    serverId: 'palworld-1',
    configured: true,
    connectorStatus: 'running',
    lastHeartbeatAt: now,
    lastSuccessfulPollAt: now,
    explanation: 'Connector is running.',
    heartbeatAgeSeconds: 2,
    consecutiveFailureCount: 0,
    connectorMode: 'rest',
    capabilities: ['palworld-rest'],
    collectors: [],
    ...overrides
  };
}

function dataFreshness(overrides: Partial<DataFreshnessResponse> = {}): DataFreshnessResponse {
  return {
    serverId: 'palworld-1',
    status: 'live',
    headline: 'Live telemetry.',
    explanation: 'Connector has recent data.',
    lastHeartbeatAt: now,
    heartbeatAgeSeconds: 2,
    lastSuccessfulPollAt: now,
    lastEventAt: now,
    lastSessionActivityAt: now,
    connectorStatus: 'running',
    confidence: 'high',
    trustWarnings: [],
    recommendedAction: 'No action needed.',
    ...overrides
  };
}

function serverHealth(overrides: Partial<ServerHealthSummary> = {}): ServerHealthSummary {
  return {
    serverId: 'palworld-1',
    status: 'healthy',
    headline: 'Server is healthy.',
    explanation: 'Telemetry is live.',
    generatedAt: now,
    currentPlayers: 1,
    uniquePlayersThisWeek: 4,
    lastPlayerActivityAt: now,
    lastWorldSaveAt: null,
    telemetryHealth: {
      status: 'healthy',
      headline: 'Telemetry live.',
      explanation: 'Connector is reporting.'
    },
    engagementHealth: {
      status: 'active',
      headline: 'Players active.',
      explanation: 'Recent activity exists.',
      currentPlayers: 1,
      uniquePlayersThisWeek: 4,
      lastPlayerActivityAt: now
    },
    collectorHealth: {
      status: 'healthy',
      totalCollectors: 1,
      enabledCollectors: 1,
      unhealthyCollectors: 0,
      lastSuccessfulCollectionAt: now,
      summaries: ['Palworld collector is healthy.']
    },
    logTruthHealth: null,
    sessionHealth: {
      status: 'healthy',
      activeSessions: 1,
      recentClosedSessions: 2,
      stale: false,
      explanation: 'Sessions are current.'
    },
    telemetry: {
      status: 'live',
      connectorStatus: 'running',
      lastHeartbeatAt: now,
      lastSuccessfulPollAt: now
    },
    ...overrides
  };
}

function settingsCapabilities(overrides: Partial<ServerSettingsCapabilitySummary> = {}): ServerSettingsCapabilitySummary {
  return {
    serverId: 'palworld-1',
    serverName: 'Fantasy World',
    game: 'palworld',
    connectorMode: 'rest',
    canReadSettings: 'yes',
    readSource: 'Palworld REST',
    lastSettingsSnapshotAt: now,
    canWriteSettings: 'no',
    writePathStatus: 'possible_needs_validation',
    candidateWritePaths: ['manual', 'rest'],
    requiresRestart: 'unknown',
    supportedSettingGroups: ['rates'],
    validationSteps: ['Confirm a safe server-change method.'],
    rollbackRequirements: ['Record previous values.'],
    unresolvedQuestions: ['Restart requirement is unknown.'],
    safetyNotes: ['Read-only settings are available.'],
    missingRequirements: ['server settings change implementation'],
    nextSafeStep: 'Review settings.',
    ...overrides
  };
}

function observedSettings(): ObservedSettingsResponse {
  return {
    serverId: 'palworld-1',
    serverName: 'Fantasy World',
    game: 'palworld',
    connectorMode: 'rest',
    available: true,
    source: 'Palworld REST',
    snapshotAt: now,
    groups: [{
      group: 'rates',
      settings: [{
        key: 'ExpRate',
        label: 'Exp Rate',
        value: 2,
        valueType: 'number',
        sensitive: false,
        group: 'rates',
        recommendedHandling: 'template_candidate',
        changeRisk: 'gameplay_balance',
        requiresRestart: 'unknown',
        riskLabel: 'Gameplay balance',
        riskNote: 'Could affect progression.'
      }]
    }],
    safetyNotes: [],
    emptyState: null
  };
}

function latestPlayer(): PalworldLatestPlayerTelemetry {
  return {
    serverId: 'palworld-1',
    lookupKey: 'player-1',
    playerName: 'Rossi',
    firstSeenAt: now,
    lastSeenAt: now,
    totalSessions: 2,
    isOnline: true
  };
}

function sessionTimeline(): SessionTimelineResponse {
  return {
    serverId: 'palworld-1',
    sessions: [{
      sessionId: 'session-1',
      playerId: 'player-1',
      displayName: 'Rossi',
      observedName: 'Rossi',
      startedAt: now,
      endedAt: null,
      isActive: true,
      durationSeconds: 600,
      closeReason: null,
      startConfidence: 'high',
      endConfidence: null,
      explanation: 'Player is online.',
      source: 'live'
    }],
    summary: {
      activeCount: 1,
      sessionsToday: 1,
      trackedSecondsToday: 600,
      lastActivityAt: now
    },
    explanation: 'Session timeline is current.'
  };
}

function guildActivity(): PalworldGuildActivityEntry {
  return {
    guildName: 'Iron Wolves',
    memberCount: 2,
    members: [],
    lastMemberSeenAt: now,
    lastSeenMemberName: 'Rossi',
    daysInactive: 0,
    daysUntilPalboxRisk: 7,
    riskLevel: 'active'
  };
}

function metric(): PalworldMetricsSummary {
  return {
    serverId: 'palworld-1',
    observedAt: now,
    currentPlayerCount: 1,
    serverFps: 60,
    raw: {}
  };
}

function chronicleEvent(): WorldChronicleEvent {
  return {
    id: 'chronicle-1',
    kind: 'guild_active',
    occurredAt: now,
    title: 'Iron Wolves showed activity.',
    detail: 'Guild activity was recorded.',
    actorName: 'Iron Wolves',
    memoryRecordId: 'memory:guild:iron-wolves',
    confidence: 'high',
    sourceLabel: 'Guild activity'
  };
}

test('reports high operations confidence when trusted evidence is present', () => {
  const report = buildPalworldActivityConfidenceReport({
    operationalStatus: operationalStatus(),
    dataFreshness: dataFreshness(),
    serverHealth: serverHealth(),
    settingsCapabilities: settingsCapabilities(),
    observedSettings: observedSettings(),
    latestPlayers: [latestPlayer()],
    sessionTimeline: sessionTimeline(),
    guildActivity: [guildActivity()],
    hasBaseTelemetry: true,
    recentMetrics: [metric()],
    chronicleEvents: [chronicleEvent()],
    worldHistoryUsesPreview: false,
    milestoneFeed: [],
    transitionEvents: []
  });

  assert.equal(report.overall.confidence, 'high');
  assert.equal(report.areas.find((area) => area.name === 'Server Reachability')?.confidence, 'high');
  assert.equal(report.areas.find((area) => area.name === 'Settings Confidence')?.confidence, 'high');
  assert.equal(report.areas.find((area) => area.name === 'World History')?.supportingEvidence.includes('No estimated events'), true);
});

test('marks confidence unknown when live evidence is mostly missing', () => {
  const report = buildPalworldActivityConfidenceReport({
    operationalStatus: operationalStatus({ connectorStatus: 'stale', heartbeatAgeSeconds: 600 }),
    dataFreshness: dataFreshness({ status: 'stale', connectorStatus: 'stale', confidence: 'low' }),
    serverHealth: serverHealth({
      telemetryHealth: {
        status: 'warning',
        headline: 'Telemetry stale.',
        explanation: 'Connector has not reported recently.'
      },
      sessionHealth: {
        status: 'warning',
        activeSessions: 0,
        recentClosedSessions: 0,
        stale: true,
        explanation: 'Session continuity is stale.'
      },
      telemetry: {
        status: 'stale',
        connectorStatus: 'stale',
        lastHeartbeatAt: now,
        lastSuccessfulPollAt: now
      }
    }),
    settingsCapabilities: settingsCapabilities({ canReadSettings: 'unknown', lastSettingsSnapshotAt: null }),
    observedSettings: null,
    latestPlayers: [],
    sessionTimeline: { ...sessionTimeline(), sessions: [] },
    guildActivity: [],
    hasBaseTelemetry: false,
    recentMetrics: [],
    chronicleEvents: [],
    worldHistoryUsesPreview: true,
    milestoneFeed: [],
    transitionEvents: []
  });

  assert.equal(report.overall.confidence, 'unknown');
  assert.equal(report.areas.find((area) => area.name === 'Server Reachability')?.confidence, 'unknown');
  assert.equal(report.areas.find((area) => area.name === 'World History')?.confidence, 'low');
  assert.equal(report.areas.find((area) => area.name === 'Guild Intelligence')?.confidence, 'unknown');
  assert.match(report.overall.operatorNote, /does not have enough evidence/);
});
