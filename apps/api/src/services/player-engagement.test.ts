import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { NormalizedEvent, PlayerEngagementDetail, PlayerEngagementSummary, SessionRecord } from '@gameops/shared';

type EventStoreModule = {
  addEvents: (events: NormalizedEvent[]) => void;
};

type HeartbeatModule = {
  clearConnectorHeartbeatsForTests: () => void;
};

type RollupStoreModule = {
  recordClosedSessionRollup: (input: { game: 'valheim' | 'palworld'; session: SessionRecord }) => boolean;
};

type EngagementModule = {
  getPlayerEngagementSummaryForServer: (serverId: string, now?: Date) => PlayerEngagementSummary;
  getPlayerEngagementDetailForServer: (serverId: string, playerId: string, now?: Date) => PlayerEngagementDetail | null;
};

function createConfig(path: string, serverId: string): void {
  writeFileSync(path, JSON.stringify({
    version: 1,
    workspace: {
      workspaceId: 'test',
      workspaceName: 'Test',
      ownerName: 'Test Owner',
      hostingMode: 'self_hosted',
      timezone: 'UTC'
    },
    api: {
      baseUrl: 'http://localhost:3001',
      port: 3001
    },
    discord: {
      enabled: false
    },
    servers: [{
      id: serverId,
      displayName: serverId,
      game: 'valheim',
      connector: {
        mode: 'journal',
        journalServiceName: 'valheim.service'
      }
    }],
    featureFlags: {
      dashboardEnabled: true,
      botEnabled: true,
      connectorEnabled: true,
      identityResolutionEnabled: true,
      sessionReconciliationEnabled: true
    }
  }, null, 2), 'utf8');
}

function createEvent(serverId: string, overrides: Partial<NormalizedEvent>): NormalizedEvent {
  return {
    game: 'valheim',
    serverId,
    occurredAt: '2026-06-11T12:00:00.000Z',
    eventType: 'HEALTH_WARN',
    ...overrides
  };
}

function createClosedSession(serverId: string, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    serverId,
    playerName: 'Kriatiri',
    startedAt: '2026-06-11T12:00:00.000Z',
    endedAt: '2026-06-11T12:45:00.000Z',
    durationSeconds: 2700,
    closeReason: 'player_leave',
    startConfidence: 'high',
    endConfidence: 'high',
    sourceEventIds: ['join-1', 'leave-1'],
    ...overrides
  };
}

async function withFreshEngagement(run: (modules: {
  store: EventStoreModule;
  heartbeat: HeartbeatModule;
  rollups: RollupStoreModule;
  engagement: EngagementModule;
  tempDir: string;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-player-engagement-test-'));
  const previousSessionPath = process.env.SESSION_STATE_STORE_PATH;
  const previousKnownPath = process.env.KNOWN_PLAYER_STORE_PATH;
  const previousTelemetryPath = process.env.PALWORLD_TELEMETRY_STORE_PATH;
  const previousPlayersSummaryPath = process.env.PALWORLD_PLAYERS_SUMMARY_PATH;
  const previousPlayerIntelligencePath = process.env.PLAYER_INTELLIGENCE_STORE_PATH;
  const previousPlayerEngagementPath = process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
  const previousConfigPath = process.env.GAMEOPS_CONFIG_PATH;

  process.env.SESSION_STATE_STORE_PATH = join(tempDir, 'session-state.json');
  process.env.KNOWN_PLAYER_STORE_PATH = join(tempDir, 'known-players.json');
  process.env.PALWORLD_TELEMETRY_STORE_PATH = join(tempDir, 'palworld-telemetry.json');
  process.env.PALWORLD_PLAYERS_SUMMARY_PATH = join(tempDir, 'players-summary.json');
  process.env.PLAYER_INTELLIGENCE_STORE_PATH = join(tempDir, 'player-intelligence-state.json');
  process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = join(tempDir, 'player-engagement-rollups.json');
  process.env.GAMEOPS_CONFIG_PATH = join(tempDir, 'gameops.config.json');

  try {
    const nonce = `${Date.now()}-${Math.random()}`;
    const storePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/event-store.ts')).href;
    const heartbeatPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/connector-heartbeat.ts')).href;
    const rollupPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/player-intelligence-rollup-store.ts')).href;
    const engagementPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/player-engagement.ts')).href;
    const store: EventStoreModule = await import(storePath);
    const heartbeat: HeartbeatModule = await import(heartbeatPath);
    const rollups: RollupStoreModule = await import(rollupPath);
    const engagement: EngagementModule = await import(`${engagementPath}?t=${nonce}`);
    heartbeat.clearConnectorHeartbeatsForTests();
    await run({ store, heartbeat, rollups, engagement, tempDir });
  } finally {
    if (previousSessionPath === undefined) delete process.env.SESSION_STATE_STORE_PATH;
    else process.env.SESSION_STATE_STORE_PATH = previousSessionPath;

    if (previousKnownPath === undefined) delete process.env.KNOWN_PLAYER_STORE_PATH;
    else process.env.KNOWN_PLAYER_STORE_PATH = previousKnownPath;

    if (previousTelemetryPath === undefined) delete process.env.PALWORLD_TELEMETRY_STORE_PATH;
    else process.env.PALWORLD_TELEMETRY_STORE_PATH = previousTelemetryPath;

    if (previousPlayersSummaryPath === undefined) delete process.env.PALWORLD_PLAYERS_SUMMARY_PATH;
    else process.env.PALWORLD_PLAYERS_SUMMARY_PATH = previousPlayersSummaryPath;

    if (previousPlayerIntelligencePath === undefined) delete process.env.PLAYER_INTELLIGENCE_STORE_PATH;
    else process.env.PLAYER_INTELLIGENCE_STORE_PATH = previousPlayerIntelligencePath;

    if (previousPlayerEngagementPath === undefined) delete process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
    else process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = previousPlayerEngagementPath;

    if (previousConfigPath === undefined) delete process.env.GAMEOPS_CONFIG_PATH;
    else process.env.GAMEOPS_CONFIG_PATH = previousConfigPath;

    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('returns an empty engagement state', async () => {
  await withFreshEngagement(({ engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-empty');

    const result = engagement.getPlayerEngagementSummaryForServer('engagement-empty', new Date('2026-06-11T13:00:00.000Z'));

    assert.equal(result.headline, 'No engagement tracked yet');
    assert.equal(result.activity.activeNowCount, 0);
    assert.equal(result.activity.today.sessions, 0);
    assert.deepEqual(result.returningPlayers, []);
    assert.match(result.explanation, /No player engagement/);
  });
});

test('summarizes active live sessions', async () => {
  await withFreshEngagement(({ store, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-live');
    store.addEvents([
      createEvent('engagement-live', {
        eventType: 'PLAYER_JOIN',
        playerName: 'Mira',
        occurredAt: '2026-06-11T12:00:00.000Z'
      })
    ]);

    const result = engagement.getPlayerEngagementSummaryForServer('engagement-live', new Date('2026-06-11T12:30:00.000Z'));

    assert.equal(result.activity.activeNowCount, 1);
    assert.equal(result.activity.activeNow[0]?.displayName, 'Mira');
    assert.equal(result.activity.today.sessions, 1);
    assert.equal(result.activity.today.trackedSeconds, 1800);
    assert.equal(result.headline, '1 player online now');
  });
});

test('summarizes stored rollups only', async () => {
  await withFreshEngagement(({ rollups, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-stored');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-stored', {
        playerName: 'Kriatiri',
        startedAt: '2026-06-10T12:00:00.000Z',
        endedAt: '2026-06-10T13:00:00.000Z',
        durationSeconds: 3600
      })
    });

    const result = engagement.getPlayerEngagementSummaryForServer('engagement-stored', new Date('2026-06-11T12:00:00.000Z'));

    assert.equal(result.activity.activeNowCount, 0);
    assert.equal(result.activity.sevenDays.sessions, 1);
    assert.equal(result.activity.sevenDays.trackedSeconds, 3600);
    assert.equal(result.highEngagementPlayers[0]?.displayName, 'Kriatiri');
    assert.equal(result.mostRecentPlayers[0]?.displayName, 'Kriatiri');
  });
});

test('summarizes mixed live and stored sessions', async () => {
  await withFreshEngagement(({ store, rollups, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-mixed');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-mixed', {
        playerName: 'Kriatiri',
        startedAt: '2026-06-10T12:00:00.000Z',
        endedAt: '2026-06-10T13:00:00.000Z',
        durationSeconds: 3600
      })
    });
    store.addEvents([
      createEvent('engagement-mixed', {
        eventType: 'PLAYER_JOIN',
        playerName: 'Mira',
        occurredAt: '2026-06-11T11:00:00.000Z'
      })
    ]);

    const result = engagement.getPlayerEngagementSummaryForServer('engagement-mixed', new Date('2026-06-11T12:00:00.000Z'));

    assert.equal(result.activity.activeNowCount, 1);
    assert.equal(result.activity.thirtyDays.sessions, 2);
    assert.equal(result.activity.thirtyDays.uniquePlayers, 2);
    assert.equal(result.mostRecentPlayers[0]?.displayName, 'Mira');
    assert.equal(result.highEngagementPlayers.some((player) => player.displayName === 'Kriatiri'), true);
  });
});

test('reports stale and low-confidence data warnings', async () => {
  await withFreshEngagement(({ store, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-warning');
    store.addEvents([
      createEvent('engagement-warning', {
        eventType: 'PLAYER_JOIN',
        playerName: 'Unknown Raider',
        occurredAt: '2026-06-11T11:00:00.000Z',
        raw: {
          valheimIdentityConfidence: 'low'
        }
      })
    ]);

    const result = engagement.getPlayerEngagementSummaryForServer('engagement-warning', new Date('2026-06-11T12:00:00.000Z'));

    assert.equal(result.confidence, 'low');
    assert.equal(result.dataWarnings.includes('Connector has not reported yet'), true);
    assert.equal(result.dataWarnings.includes('Some player identities are low confidence.'), true);
  });
});

test('uses daily rollups for 7d and 30d windows when recent timeline is missing', async () => {
  await withFreshEngagement(({ rollups, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-rollup-window');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-rollup-window', {
        playerName: 'Archive Player',
        startedAt: '2026-06-02T10:00:00.000Z',
        endedAt: '2026-06-02T11:00:00.000Z',
        durationSeconds: 3600
      })
    });

    const result = engagement.getPlayerEngagementSummaryForServer('engagement-rollup-window', new Date('2026-06-11T12:00:00.000Z'));

    assert.equal(result.activity.sevenDays.sessions, 0);
    assert.equal(result.activity.thirtyDays.sessions, 1);
    assert.equal(result.activity.thirtyDays.trackedSeconds, 3600);
    assert.equal(result.dataWarnings.includes('7d/30d engagement includes persisted daily rollups.'), true);
  });
});

test('daily rollup warnings surface inferred sessions', async () => {
  await withFreshEngagement(({ rollups, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-rollup-warning');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-rollup-warning', {
        playerName: 'Inferred Player',
        closeReason: 'occupancy_reconciliation',
        endConfidence: 'low'
      })
    });

    const result = engagement.getPlayerEngagementSummaryForServer('engagement-rollup-warning', new Date('2026-06-11T13:00:00.000Z'));

    assert.equal(result.dataWarnings.includes('Some daily engagement totals include low-confidence or inferred sessions.'), true);
  });
});

test('returns active player engagement detail', async () => {
  await withFreshEngagement(({ store, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-detail-active');
    store.addEvents([
      createEvent('engagement-detail-active', {
        eventType: 'PLAYER_JOIN',
        playerName: 'Mira',
        occurredAt: '2026-06-11T12:00:00.000Z'
      })
    ]);

    const detail = engagement.getPlayerEngagementDetailForServer('engagement-detail-active', 'Mira', new Date('2026-06-11T12:30:00.000Z'));

    assert.equal(detail?.status, 'active_now');
    assert.equal(detail?.sevenDays.sessions, 1);
    assert.equal(detail?.sevenDays.trackedSeconds, 1800);
    assert.equal(detail?.recentSessions[0]?.observedName, 'Mira');
    assert.equal(detail?.whyTheyMatter.some((note) => /online right now/i.test(note)), true);
  });
});

test('returns returning player engagement detail', async () => {
  await withFreshEngagement(({ rollups, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-detail-returning');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-detail-returning', {
        playerName: 'Kriatiri',
        startedAt: '2026-06-10T10:00:00.000Z',
        endedAt: '2026-06-10T11:00:00.000Z',
        durationSeconds: 3600
      })
    });
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-detail-returning', {
        playerName: 'Kriatiri',
        startedAt: '2026-06-11T10:00:00.000Z',
        endedAt: '2026-06-11T11:00:00.000Z',
        durationSeconds: 3600
      })
    });

    const detail = engagement.getPlayerEngagementDetailForServer('engagement-detail-returning', 'Kriatiri', new Date('2026-06-11T12:00:00.000Z'));

    assert.equal(detail?.status, 'recently_active');
    assert.equal(detail?.totalSessions, 2);
    assert.equal(detail?.sevenDays.sessions, 2);
    assert.equal(detail?.sevenDays.trackedSeconds, 7200);
    assert.equal(detail?.whyTheyMatter.some((note) => /came back/i.test(note)), true);
  });
});

test('reports player engagement trend up by playtime from daily rollups', async () => {
  await withFreshEngagement(({ rollups, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-trend-up');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-trend-up', {
        playerName: 'Trend Player',
        startedAt: '2026-06-04T10:00:00.000Z',
        endedAt: '2026-06-04T10:30:00.000Z',
        durationSeconds: 1800,
        sourceEventIds: ['prev-up-join', 'prev-up-leave']
      })
    });
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-trend-up', {
        playerName: 'Trend Player',
        startedAt: '2026-06-12T10:00:00.000Z',
        endedAt: '2026-06-12T12:00:00.000Z',
        durationSeconds: 7200,
        sourceEventIds: ['current-up-join', 'current-up-leave']
      })
    });

    const detail = engagement.getPlayerEngagementDetailForServer('engagement-trend-up', 'Trend Player', new Date('2026-06-15T12:00:00.000Z'));

    assert.equal(detail?.trendDirection, 'up');
    assert.equal(detail?.current7dSessions, 1);
    assert.equal(detail?.previous7dSessions, 1);
    assert.equal(detail?.current7dPlaySeconds, 7200);
    assert.equal(detail?.previous7dPlaySeconds, 1800);
    assert.equal(detail?.trendReasons.some((reason) => /more tracked playtime/i.test(reason)), true);
  });
});

test('reports player engagement trend down by sessions and playtime from daily rollups', async () => {
  await withFreshEngagement(({ rollups, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-trend-down');
    for (const [index, date] of ['2026-06-03', '2026-06-04', '2026-06-05'].entries()) {
      rollups.recordClosedSessionRollup({
        game: 'valheim',
        session: createClosedSession('engagement-trend-down', {
          playerName: 'Trend Down',
          startedAt: `${date}T10:00:00.000Z`,
          endedAt: `${date}T12:00:00.000Z`,
          durationSeconds: 7200,
          sourceEventIds: [`prev-down-join-${index}`, `prev-down-leave-${index}`]
        })
      });
    }
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-trend-down', {
        playerName: 'Trend Down',
        startedAt: '2026-06-12T10:00:00.000Z',
        endedAt: '2026-06-12T10:30:00.000Z',
        durationSeconds: 1800,
        sourceEventIds: ['current-down-join', 'current-down-leave']
      })
    });

    const detail = engagement.getPlayerEngagementDetailForServer('engagement-trend-down', 'Trend Down', new Date('2026-06-15T12:00:00.000Z'));

    assert.equal(detail?.trendDirection, 'down');
    assert.equal(detail?.current7dSessions, 1);
    assert.equal(detail?.previous7dSessions, 3);
    assert.equal(detail?.trendReasons.some((reason) => /fewer sessions/i.test(reason)), true);
    assert.equal(detail?.trendReasons.some((reason) => /less tracked playtime/i.test(reason)), true);
  });
});

test('reports player engagement trend steady within the comparison threshold', async () => {
  await withFreshEngagement(({ rollups, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-trend-steady');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-trend-steady', {
        playerName: 'Steady Player',
        startedAt: '2026-06-04T10:00:00.000Z',
        endedAt: '2026-06-04T11:00:00.000Z',
        durationSeconds: 3600,
        sourceEventIds: ['prev-steady-join', 'prev-steady-leave']
      })
    });
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-trend-steady', {
        playerName: 'Steady Player',
        startedAt: '2026-06-12T10:00:00.000Z',
        endedAt: '2026-06-12T11:05:00.000Z',
        durationSeconds: 3900,
        sourceEventIds: ['current-steady-join', 'current-steady-leave']
      })
    });

    const detail = engagement.getPlayerEngagementDetailForServer('engagement-trend-steady', 'Steady Player', new Date('2026-06-15T12:00:00.000Z'));

    assert.equal(detail?.trendDirection, 'steady');
    assert.equal(detail?.trendReasons.some((reason) => /similar activity/i.test(reason)), true);
  });
});

test('reports player engagement trend unknown without previous rollup history', async () => {
  await withFreshEngagement(({ rollups, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-trend-unknown');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-trend-unknown', {
        playerName: 'New Player',
        startedAt: '2026-06-12T10:00:00.000Z',
        endedAt: '2026-06-12T11:00:00.000Z',
        durationSeconds: 3600,
        sourceEventIds: ['current-unknown-join', 'current-unknown-leave']
      })
    });

    const detail = engagement.getPlayerEngagementDetailForServer('engagement-trend-unknown', 'New Player', new Date('2026-06-15T12:00:00.000Z'));

    assert.equal(detail?.trendDirection, 'unknown');
    assert.equal(detail?.current7dSessions, 1);
    assert.equal(detail?.previous7dSessions, 0);
    assert.match(detail?.trendConfidenceWarning ?? '', /not enough daily rollup history/i);
  });
});

test('preserves low-confidence warnings when engagement trend is available', async () => {
  await withFreshEngagement(({ rollups, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-trend-low-confidence');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-trend-low-confidence', {
        playerName: 'Low Trend',
        startedAt: '2026-06-04T10:00:00.000Z',
        endedAt: '2026-06-04T11:00:00.000Z',
        durationSeconds: 3600,
        sourceEventIds: ['prev-low-trend-join', 'prev-low-trend-leave']
      })
    });
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-trend-low-confidence', {
        playerName: 'Low Trend',
        startedAt: '2026-06-12T10:00:00.000Z',
        endedAt: '2026-06-12T11:00:00.000Z',
        durationSeconds: 3600,
        closeReason: 'occupancy_reconciliation',
        endConfidence: 'low',
        sourceEventIds: ['current-low-trend-join', 'current-low-trend-leave']
      })
    });

    const detail = engagement.getPlayerEngagementDetailForServer('engagement-trend-low-confidence', 'Low Trend', new Date('2026-06-15T12:00:00.000Z'));

    assert.equal(detail?.trendDirection, 'steady');
    assert.equal(detail?.trendConfidenceWarning, 'Trend includes low-confidence or inferred daily rollup sessions.');
    assert.equal(detail?.confidenceWarnings.includes('Some daily rollup totals include low-confidence or inferred sessions.'), true);
  });
});

test('returns fading and inactive player engagement detail', async () => {
  await withFreshEngagement(({ rollups, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-detail-fading');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-detail-fading', {
        playerName: 'Fading Player',
        startedAt: '2026-06-01T10:00:00.000Z',
        endedAt: '2026-06-01T11:00:00.000Z',
        durationSeconds: 3600
      })
    });
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-detail-fading', {
        playerName: 'Inactive Player',
        startedAt: '2026-05-20T10:00:00.000Z',
        endedAt: '2026-05-20T11:00:00.000Z',
        durationSeconds: 3600
      })
    });

    const fading = engagement.getPlayerEngagementDetailForServer('engagement-detail-fading', 'Fading Player', new Date('2026-06-11T12:00:00.000Z'));
    const inactive = engagement.getPlayerEngagementDetailForServer('engagement-detail-fading', 'Inactive Player', new Date('2026-06-11T12:00:00.000Z'));

    assert.equal(fading?.status, 'fading');
    assert.equal(fading?.whyTheyMatter.some((note) => /not been seen this week/i.test(note)), true);
    assert.equal(inactive?.status, 'inactive');
    assert.equal(inactive?.whyTheyMatter.some((note) => /two weeks/i.test(note)), true);
  });
});

test('returns low-confidence inferred session engagement detail warnings', async () => {
  await withFreshEngagement(({ rollups, engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-detail-low');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('engagement-detail-low', {
        playerName: 'Scout',
        closeReason: 'occupancy_reconciliation',
        endConfidence: 'low'
      })
    });

    const detail = engagement.getPlayerEngagementDetailForServer('engagement-detail-low', 'Scout', new Date('2026-06-11T13:00:00.000Z'));

    assert.equal(detail?.confidence, 'low');
    assert.equal(detail?.confidenceWarnings.includes('Some recent sessions are low confidence or inferred.'), true);
    assert.equal(detail?.confidenceWarnings.includes('Some daily rollup totals include low-confidence or inferred sessions.'), true);
  });
});

test('returns null for missing player engagement detail', async () => {
  await withFreshEngagement(({ engagement, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'engagement-detail-missing');

    const detail = engagement.getPlayerEngagementDetailForServer('engagement-detail-missing', 'missing-player', new Date('2026-06-11T13:00:00.000Z'));

    assert.equal(detail, null);
  });
});
