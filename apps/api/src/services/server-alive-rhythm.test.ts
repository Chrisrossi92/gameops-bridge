import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { ServerAliveRhythmSummary, SessionRecord } from '@gameops/shared';

type RollupStoreModule = {
  recordClosedSessionRollup: (input: { game: 'valheim' | 'palworld'; session: SessionRecord }) => boolean;
};

type RhythmModule = {
  getServerAliveRhythmSummary: (serverId: string, now?: Date) => ServerAliveRhythmSummary;
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

function createClosedSession(serverId: string, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    serverId,
    playerName: 'Kriatiri',
    startedAt: '2026-06-21T12:00:00.000Z',
    endedAt: '2026-06-21T13:00:00.000Z',
    durationSeconds: 3600,
    closeReason: 'player_leave',
    startConfidence: 'high',
    endConfidence: 'high',
    sourceEventIds: ['join-1', 'leave-1'],
    ...overrides
  };
}

async function withFreshRhythm(run: (modules: {
  rollups: RollupStoreModule;
  rhythm: RhythmModule;
  tempDir: string;
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-server-alive-rhythm-test-'));
  const previousSessionPath = process.env.SESSION_STATE_STORE_PATH;
  const previousKnownPath = process.env.KNOWN_PLAYER_STORE_PATH;
  const previousPlayerIntelligencePath = process.env.PLAYER_INTELLIGENCE_STORE_PATH;
  const previousPlayerEngagementPath = process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
  const previousConfigPath = process.env.GAMEOPS_CONFIG_PATH;

  process.env.SESSION_STATE_STORE_PATH = join(tempDir, 'session-state.json');
  process.env.KNOWN_PLAYER_STORE_PATH = join(tempDir, 'known-players.json');
  process.env.PLAYER_INTELLIGENCE_STORE_PATH = join(tempDir, 'player-intelligence-state.json');
  process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = join(tempDir, 'player-engagement-rollups.json');
  process.env.GAMEOPS_CONFIG_PATH = join(tempDir, 'gameops.config.json');

  try {
    const nonce = `${Date.now()}-${Math.random()}`;
    const rollupPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/player-intelligence-rollup-store.ts')).href;
    const rhythmPath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/server-alive-rhythm.ts')).href;
    const rollups: RollupStoreModule = await import(`${rollupPath}?t=${nonce}`);
    const rhythm: RhythmModule = await import(`${rhythmPath}?t=${nonce}`);
    await run({ rollups, rhythm, tempDir });
  } finally {
    if (previousSessionPath === undefined) delete process.env.SESSION_STATE_STORE_PATH;
    else process.env.SESSION_STATE_STORE_PATH = previousSessionPath;

    if (previousKnownPath === undefined) delete process.env.KNOWN_PLAYER_STORE_PATH;
    else process.env.KNOWN_PLAYER_STORE_PATH = previousKnownPath;

    if (previousPlayerIntelligencePath === undefined) delete process.env.PLAYER_INTELLIGENCE_STORE_PATH;
    else process.env.PLAYER_INTELLIGENCE_STORE_PATH = previousPlayerIntelligencePath;

    if (previousPlayerEngagementPath === undefined) delete process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
    else process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = previousPlayerEngagementPath;

    if (previousConfigPath === undefined) delete process.env.GAMEOPS_CONFIG_PATH;
    else process.env.GAMEOPS_CONFIG_PATH = previousConfigPath;

    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('returns empty server alive rhythm without history', async () => {
  await withFreshRhythm(({ rhythm, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'rhythm-empty');

    const result = rhythm.getServerAliveRhythmSummary('rhythm-empty', new Date('2026-06-22T12:00:00.000Z'));

    assert.equal(result.summary, 'Not enough history yet.');
    assert.equal(result.sevenDays.totalSessions, 0);
    assert.equal(result.thirtyDays.totalTrackedSeconds, 0);
    assert.equal(result.hourlyPattern.status, 'unknown');
    assert.equal(result.confidenceWarnings.includes('No daily engagement rollups exist yet.'), true);
  });
});

test('reports one busy day from daily rollups', async () => {
  await withFreshRhythm(({ rollups, rhythm, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'rhythm-one-day');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('rhythm-one-day', {
        playerName: 'Mira',
        startedAt: '2026-06-21T20:00:00.000Z',
        endedAt: '2026-06-21T22:00:00.000Z',
        durationSeconds: 7200,
        sourceEventIds: ['one-day-join', 'one-day-leave']
      })
    });

    const result = rhythm.getServerAliveRhythmSummary('rhythm-one-day', new Date('2026-06-22T12:00:00.000Z'));

    assert.equal(result.sevenDays.busiestDays[0]?.date, '2026-06-21');
    assert.equal(result.sevenDays.busiestDays[0]?.dayOfWeek, 'Sunday');
    assert.equal(result.sevenDays.totalSessions, 1);
    assert.equal(result.sevenDays.totalTrackedSeconds, 7200);
    assert.match(result.summary, /Sunday|Not enough|Most recent/i);
  });
});

test('detects recurring busy day pattern', async () => {
  await withFreshRhythm(({ rollups, rhythm, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'rhythm-pattern');
    for (const [index, date] of ['2026-06-08', '2026-06-15', '2026-06-22'].entries()) {
      rollups.recordClosedSessionRollup({
        game: 'valheim',
        session: createClosedSession('rhythm-pattern', {
          playerName: `Monday Player ${index}`,
          startedAt: `${date}T20:00:00.000Z`,
          endedAt: `${date}T22:00:00.000Z`,
          durationSeconds: 7200,
          sourceEventIds: [`monday-join-${index}`, `monday-leave-${index}`]
        })
      });
    }
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('rhythm-pattern', {
        playerName: 'Short Visitor',
        startedAt: '2026-06-18T20:00:00.000Z',
        endedAt: '2026-06-18T20:30:00.000Z',
        durationSeconds: 1800,
        sourceEventIds: ['short-join', 'short-leave']
      })
    });

    const result = rhythm.getServerAliveRhythmSummary('rhythm-pattern', new Date('2026-06-22T23:00:00.000Z'));

    assert.equal(result.bestDayOfWeekPattern?.dayOfWeek, 'Monday');
    assert.equal(result.bestDayOfWeekPattern?.observedDays, 3);
    assert.match(result.summary, /Mondays/);
  });
});

test('returns quiet days in 7d and 30d windows', async () => {
  await withFreshRhythm(({ rollups, rhythm, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'rhythm-quiet');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('rhythm-quiet', {
        playerName: 'Weekend Player',
        startedAt: '2026-06-21T20:00:00.000Z',
        endedAt: '2026-06-21T21:00:00.000Z',
        durationSeconds: 3600,
        sourceEventIds: ['quiet-join', 'quiet-leave']
      })
    });

    const result = rhythm.getServerAliveRhythmSummary('rhythm-quiet', new Date('2026-06-22T12:00:00.000Z'));

    assert.equal(result.sevenDays.quietDays.some((day) => day.date === '2026-06-20'), true);
    assert.equal(result.thirtyDays.quietDays.length, 29);
  });
});

test('separates 7d and 30d server alive totals', async () => {
  await withFreshRhythm(({ rollups, rhythm, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'rhythm-windows');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('rhythm-windows', {
        playerName: 'Recent Player',
        startedAt: '2026-06-21T10:00:00.000Z',
        endedAt: '2026-06-21T11:00:00.000Z',
        durationSeconds: 3600,
        sourceEventIds: ['recent-join', 'recent-leave']
      })
    });
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('rhythm-windows', {
        playerName: 'Older Player',
        startedAt: '2026-06-05T10:00:00.000Z',
        endedAt: '2026-06-05T12:00:00.000Z',
        durationSeconds: 7200,
        sourceEventIds: ['older-join', 'older-leave']
      })
    });

    const result = rhythm.getServerAliveRhythmSummary('rhythm-windows', new Date('2026-06-22T12:00:00.000Z'));

    assert.equal(result.sevenDays.totalSessions, 1);
    assert.equal(result.sevenDays.totalTrackedSeconds, 3600);
    assert.equal(result.sevenDays.uniqueActivePlayers, 1);
    assert.equal(result.thirtyDays.totalSessions, 2);
    assert.equal(result.thirtyDays.totalTrackedSeconds, 10800);
    assert.equal(result.thirtyDays.uniqueActivePlayers, 2);
  });
});

test('reports sparse and low-confidence server alive warnings', async () => {
  await withFreshRhythm(({ rollups, rhythm, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'rhythm-low-confidence');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('rhythm-low-confidence', {
        playerName: 'Inferred Player',
        startedAt: '2026-06-21T10:00:00.000Z',
        endedAt: '2026-06-21T11:00:00.000Z',
        durationSeconds: 3600,
        closeReason: 'occupancy_reconciliation',
        endConfidence: 'low',
        sourceEventIds: ['low-rhythm-join', 'low-rhythm-leave']
      })
    });

    const result = rhythm.getServerAliveRhythmSummary('rhythm-low-confidence', new Date('2026-06-22T12:00:00.000Z'));

    assert.equal(result.confidence, 'medium');
    assert.equal(result.confidenceWarnings.includes('Engagement history is sparse; rhythm may change as more sessions close.'), true);
    assert.equal(result.confidenceWarnings.includes('Some rhythm totals include low-confidence or inferred sessions.'), true);
    assert.equal(result.confidenceWarnings.includes('Hourly rhythm is unknown because daily engagement rollups do not have per-hour buckets yet.'), false);
  });
});

test('returns busiest UTC hour when hourly bucket data exists', async () => {
  await withFreshRhythm(({ rollups, rhythm, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'rhythm-hourly');
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('rhythm-hourly', {
        playerName: 'Prime Time',
        startedAt: '2026-06-21T20:00:00.000Z',
        endedAt: '2026-06-21T22:00:00.000Z',
        durationSeconds: 7200,
        sourceEventIds: ['hourly-prime-join', 'hourly-prime-leave']
      })
    });
    rollups.recordClosedSessionRollup({
      game: 'valheim',
      session: createClosedSession('rhythm-hourly', {
        playerName: 'Short Time',
        startedAt: '2026-06-20T18:00:00.000Z',
        endedAt: '2026-06-20T18:30:00.000Z',
        durationSeconds: 1800,
        sourceEventIds: ['hourly-short-join', 'hourly-short-leave']
      })
    });

    const result = rhythm.getServerAliveRhythmSummary('rhythm-hourly', new Date('2026-06-22T12:00:00.000Z'));

    assert.equal(result.hourlyPattern.status, 'available');
    assert.equal(result.hourlyPattern.busiestUtcHours[0]?.hourUtc, 20);
    assert.equal(result.hourlyPattern.busiestUtcHours[0]?.trackedSeconds, 3600);
    assert.match(result.hourlyPattern.explanation, /UTC buckets/);
  });
});

test('keeps hourly rhythm unknown when rollups do not have buckets', async () => {
  await withFreshRhythm(({ rhythm, tempDir }) => {
    createConfig(join(tempDir, 'gameops.config.json'), 'rhythm-old-hourly');
    writeFileSync(join(tempDir, 'player-engagement-rollups.json'), JSON.stringify({
      dailyRollups: [{
        serverId: 'rhythm-old-hourly',
        date: '2026-06-21',
        playerId: 'rhythm-old-hourly:kriatiri',
        playerKey: 'kriatiri',
        displayName: 'Kriatiri',
        sessionCount: 1,
        trackedSeconds: 3600,
        firstSeenAt: '2026-06-21T20:00:00.000Z',
        lastSeenAt: '2026-06-21T21:00:00.000Z',
        lowConfidenceSessionCount: 0,
        inferredSessionCount: 0,
        sourceSummary: ['daily engagement rollup'],
        sourceSessionIds: ['old-hourly-session']
      }],
      processedSessionIds: ['old-hourly-session']
    }, null, 2), 'utf8');

    const result = rhythm.getServerAliveRhythmSummary('rhythm-old-hourly', new Date('2026-06-22T12:00:00.000Z'));

    assert.equal(result.hourlyPattern.status, 'unknown');
    assert.deepEqual(result.hourlyPattern.busiestUtcHours, []);
    assert.equal(result.confidenceWarnings.includes('Hourly rhythm is unknown because daily engagement rollups do not have per-hour buckets yet.'), true);
  });
});
