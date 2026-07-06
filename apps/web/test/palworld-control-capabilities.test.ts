import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  ObservedSettingsResponse,
  PalworldGuildActivityEntry,
  PalworldLatestPlayerTelemetry,
  PalworldMetricsSummary,
  ServerHealthSummary,
  ServerSettingsCapabilitySummary,
  SessionTimelineResponse
} from '@gameops/shared';
import { buildPalworldControlCapabilitySections } from '../src/palworld-control-capabilities.ts';

const now = '2026-07-06T12:00:00.000Z';

function baseHealth(overrides: Partial<ServerHealthSummary> = {}): ServerHealthSummary {
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

test('marks only evidenced Palworld control capabilities as verified', () => {
  const sections = buildPalworldControlCapabilitySections({
    serverName: 'Fantasy World',
    serverState: 'online',
    serverHealth: baseHealth(),
    settingsCapabilities: settingsCapabilities(),
    observedSettings: observedSettings(),
    runtimeAudit: null,
    latestPlayers: [latestPlayer()],
    sessionTimeline: sessionTimeline(),
    guildActivity: [guildActivity()],
    recentMetrics: [metric()],
    milestoneFeed: [],
    transitionEvents: [],
    hasBaseTelemetry: true
  });
  const capabilities = sections.flatMap((section) => section.capabilities);

  assert.equal(capabilities.find((capability) => capability.name === 'Read server status')?.status, 'verified');
  assert.equal(capabilities.find((capability) => capability.name === 'Read current settings')?.status, 'verified');
  assert.equal(capabilities.find((capability) => capability.name === 'Change settings')?.status, 'planned');
  assert.equal(capabilities.find((capability) => capability.name === 'Restart server')?.status, 'planned');
  assert.equal(capabilities.find((capability) => capability.name === 'Spawn item')?.status, 'unknown');
  assert.equal(capabilities.find((capability) => capability.name === 'Kick or ban player')?.status, 'unsupported');
  assert.equal(sections.map((section) => section.group).includes('Inventories'), true);
});

test('keeps guilds, bases, and telemetry unknown without direct evidence', () => {
  const sections = buildPalworldControlCapabilitySections({
    serverName: 'Fantasy World',
    serverState: 'online',
    serverHealth: baseHealth(),
    settingsCapabilities: settingsCapabilities({ canReadSettings: 'unknown', lastSettingsSnapshotAt: null }),
    observedSettings: null,
    runtimeAudit: null,
    latestPlayers: [],
    sessionTimeline: { ...sessionTimeline(), sessions: [] },
    guildActivity: [],
    recentMetrics: [],
    milestoneFeed: [],
    transitionEvents: [],
    hasBaseTelemetry: false
  });
  const capabilities = sections.flatMap((section) => section.capabilities);

  assert.equal(capabilities.find((capability) => capability.name === 'Read current settings')?.status, 'unknown');
  assert.equal(capabilities.find((capability) => capability.name === 'Read guilds')?.status, 'unknown');
  assert.equal(capabilities.find((capability) => capability.name === 'Read base telemetry')?.status, 'unknown');
  assert.equal(capabilities.find((capability) => capability.name === 'Read milestones and telemetry')?.status, 'unknown');
});
