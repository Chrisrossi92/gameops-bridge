import { mkdtempSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { ActivityLogItem, NormalizedEvent } from '@gameops/shared';

type EventStoreModule = {
  addEvents: (events: NormalizedEvent[]) => void;
};

type ActivityLogModule = {
  getActivityLogForServer: (serverId: string, limit?: number) => ActivityLogItem[];
};

type LogTruthStoreModule = {
  appendLogTruthEvents: (events: NormalizedEvent[], receivedAt?: string) => unknown[];
};

function createEvent(serverId: string, overrides: Partial<NormalizedEvent>): NormalizedEvent {
  return {
    game: 'valheim',
    serverId,
    occurredAt: '2026-04-05T12:00:00.000Z',
    eventType: 'HEALTH_WARN',
    message: 'server warning',
    ...overrides
  };
}

async function withFreshActivityLog(run: (paths: { tempDir: string }) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-activity-log-test-'));
  const previousSessionPath = process.env.SESSION_STATE_STORE_PATH;
  const previousPlayerIntelligencePath = process.env.PLAYER_INTELLIGENCE_STORE_PATH;
  const previousPlayerEngagementPath = process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
  const previousLogTruthPath = process.env.LOG_TRUTH_STORE_PATH;

  process.env.SESSION_STATE_STORE_PATH = join(tempDir, 'session-state.json');
  process.env.PLAYER_INTELLIGENCE_STORE_PATH = join(tempDir, 'player-intelligence-state.json');
  process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = join(tempDir, 'player-engagement-rollups.json');
  process.env.LOG_TRUTH_STORE_PATH = join(tempDir, 'log-truth.json');

  try {
    await run({ tempDir });
  } finally {
    if (previousSessionPath === undefined) delete process.env.SESSION_STATE_STORE_PATH;
    else process.env.SESSION_STATE_STORE_PATH = previousSessionPath;

    if (previousPlayerIntelligencePath === undefined) delete process.env.PLAYER_INTELLIGENCE_STORE_PATH;
    else process.env.PLAYER_INTELLIGENCE_STORE_PATH = previousPlayerIntelligencePath;

    if (previousPlayerEngagementPath === undefined) delete process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
    else process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = previousPlayerEngagementPath;

    if (previousLogTruthPath === undefined) delete process.env.LOG_TRUTH_STORE_PATH;
    else process.env.LOG_TRUTH_STORE_PATH = previousLogTruthPath;

    rmSync(tempDir, { recursive: true, force: true });
  }
}

function moduleUrl(path: string, suffix: string): string {
  return `${pathToFileURL(resolve(`../gameops-bridge/${path}`)).href}?t=${Date.now()}-${Math.random()}-${suffix}`;
}

function plainModuleUrl(path: string): string {
  return pathToFileURL(resolve(`../gameops-bridge/${path}`)).href;
}

test('activity log includes durable events after simulated API restart', async () => {
  await withFreshActivityLog(async () => {
    const serverId = 'srv-activity-restart';
    const logTruth: LogTruthStoreModule = await import(moduleUrl('apps/api/src/services/log-truth-store.ts', 'truth'));
    logTruth.appendLogTruthEvents([
      createEvent(serverId, {
        id: 'durable-health-warn',
        eventType: 'HEALTH_WARN',
        occurredAt: '2026-04-05T12:03:00.000Z',
        message: 'PlayFab connection timeout',
        raw: {
          valheimEventSource: 'journal'
        }
      })
    ]);

    const activityLog: ActivityLogModule = await import(moduleUrl('apps/api/src/services/activity-log.ts', 'activity-restart'));
    const items = activityLog.getActivityLogForServer(serverId, 10);

    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, 'Server health warning');
    assert.match(items[0]?.description ?? '', /PlayFab connection timeout/);
    assert.equal(items[0]?.sourceEventIds[0], 'durable-health-warn');
  });
});

test('unknown event types remain visible in a readable way', async () => {
  await withFreshActivityLog(async () => {
    const serverId = 'srv-activity-unknown';
    const eventStore: EventStoreModule = await import(plainModuleUrl('apps/api/src/services/event-store.ts'));
    const activityLog: ActivityLogModule = await import(moduleUrl('apps/api/src/services/activity-log.ts', 'activity-unknown'));

    eventStore.addEvents([
      createEvent(serverId, {
        id: 'chat-event-1',
        eventType: 'CHAT_MESSAGE',
        playerName: 'Alice',
        message: 'Alice: hello world',
        occurredAt: '2026-04-05T12:01:00.000Z',
        raw: {
          channel: 'global'
        }
      })
    ]);

    const items = activityLog.getActivityLogForServer(serverId, 10);

    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, 'chat message');
    assert.equal(items[0]?.description, 'Alice: hello world');
    assert.equal(items[0]?.playerName, 'Alice');
    assert.equal(items[0]?.confidence, 'medium');
  });
});

test('player join and leave events still format correctly while memory is warm', async () => {
  await withFreshActivityLog(async () => {
    const serverId = 'srv-activity-player';
    const eventStore: EventStoreModule = await import(plainModuleUrl('apps/api/src/services/event-store.ts'));
    const activityLog: ActivityLogModule = await import(moduleUrl('apps/api/src/services/activity-log.ts', 'activity-player'));

    eventStore.addEvents([
      createEvent(serverId, {
        id: 'alice-join',
        eventType: 'PLAYER_JOIN',
        playerName: 'Alice',
        occurredAt: '2026-04-05T12:00:00.000Z'
      }),
      createEvent(serverId, {
        id: 'alice-leave',
        eventType: 'PLAYER_LEAVE',
        playerName: 'Alice',
        occurredAt: '2026-04-05T12:05:00.000Z'
      })
    ]);

    const items = activityLog.getActivityLogForServer(serverId, 10);
    const leave = items.find((item) => item.title === 'Player left');
    const join = items.find((item) => item.title === 'Player joined');

    assert.equal(items.length, 2);
    assert.equal(leave?.description, 'Alice left Valheim after 5m.');
    assert.equal(leave?.playerName, 'Alice');
    assert.equal(leave?.confidence, 'high');
    assert.equal(join?.description, 'Alice joined Valheim.');
    assert.equal(join?.playerName, 'Alice');
    assert.equal(join?.confidence, 'high');
  });
});
