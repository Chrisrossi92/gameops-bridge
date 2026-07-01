import { mkdtempSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { NormalizedEvent, SessionRecord } from '@gameops/shared';

type EventStoreModule = {
  addEvents: (events: NormalizedEvent[]) => void;
  getActiveSessionsForServer: (serverId: string) => SessionRecord[];
  getRecentClosedSessionsForServer: (serverId: string, limit?: number) => SessionRecord[];
  getRecentEventsForServer: (serverId: string, limit?: number) => NormalizedEvent[];
};

type RollupStoreModule = {
  getPersistedPlayerRollupsForServer: (serverId: string) => Array<{
    displayName: string;
    totalTrackedSeconds: number;
    sessionCount: number;
  }>;
};

function createEvent(overrides: Partial<NormalizedEvent>): NormalizedEvent {
  return {
    game: 'valheim',
    serverId: 'srv-1',
    occurredAt: '2026-04-05T12:00:00.000Z',
    eventType: 'HEALTH_WARN',
    ...overrides
  };
}

async function withFreshEventStore(run: (store: EventStoreModule) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-event-store-test-'));
  const statePath = join(tempDir, 'session-state.json');
  const previousPath = process.env.SESSION_STATE_STORE_PATH;
  const previousPlayerIntelligencePath = process.env.PLAYER_INTELLIGENCE_STORE_PATH;
  const previousPlayerEngagementPath = process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
  const previousLogTruthPath = process.env.LOG_TRUTH_STORE_PATH;

  process.env.SESSION_STATE_STORE_PATH = statePath;
  process.env.PLAYER_INTELLIGENCE_STORE_PATH = join(tempDir, 'player-intelligence-state.json');
  process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = join(tempDir, 'player-engagement-rollups.json');
  process.env.LOG_TRUTH_STORE_PATH = join(tempDir, 'log-truth.json');

  try {
    const modulePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/event-store.ts')).href;
    const store: EventStoreModule = await import(`${modulePath}?t=${Date.now()}-${Math.random()}`);
    await run(store);
  } finally {
    if (previousPath === undefined) {
      delete process.env.SESSION_STATE_STORE_PATH;
    } else {
      process.env.SESSION_STATE_STORE_PATH = previousPath;
    }

    if (previousPlayerIntelligencePath === undefined) {
      delete process.env.PLAYER_INTELLIGENCE_STORE_PATH;
    } else {
      process.env.PLAYER_INTELLIGENCE_STORE_PATH = previousPlayerIntelligencePath;
    }

    if (previousPlayerEngagementPath === undefined) {
      delete process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH;
    } else {
      process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH = previousPlayerEngagementPath;
    }

    if (previousLogTruthPath === undefined) {
      delete process.env.LOG_TRUTH_STORE_PATH;
    } else {
      process.env.LOG_TRUTH_STORE_PATH = previousLogTruthPath;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function importRollupStore(): Promise<RollupStoreModule> {
  const modulePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/player-intelligence-rollup-store.ts')).href;
  return import(modulePath);
}

test('PLAYER_LEAVE closes an active session for a known player', async () => {
  await withFreshEventStore((store) => {
    store.addEvents([
      createEvent({
        eventType: 'PLAYER_JOIN',
        playerName: 'Alice',
        occurredAt: '2026-04-05T12:00:00.000Z'
      })
    ]);

    store.addEvents([
      createEvent({
        eventType: 'PLAYER_LEAVE',
        playerName: 'Alice',
        occurredAt: '2026-04-05T12:05:00.000Z'
      })
    ]);

    const active = store.getActiveSessionsForServer('srv-1');
    const closed = store.getRecentClosedSessionsForServer('srv-1', 5);
    const recentEvents = store.getRecentEventsForServer('srv-1', 1);

    assert.equal(active.length, 0);
    assert.equal(closed.length, 1);
    assert.equal(closed[0]?.playerName, 'Alice');
    assert.equal(closed[0]?.endedAt, '2026-04-05T12:05:00.000Z');
    assert.equal(closed[0]?.durationSeconds, 300);
    assert.equal(closed[0]?.closeReason, 'player_leave');
    assert.equal(closed[0]?.startConfidence, 'high');
    assert.equal(closed[0]?.endConfidence, 'high');
    assert.equal((closed[0]?.sourceEventIds ?? []).length, 2);
    assert.equal(recentEvents[0]?.raw?.sessionCloseReason, 'player_leave');
  });
});

test('disconnect signal with lower occupancy reconciles oldest active sessions', async () => {
  await withFreshEventStore((store) => {
    store.addEvents([
      createEvent({ eventType: 'PLAYER_JOIN', playerName: 'Alpha', occurredAt: '2026-04-05T12:00:00.000Z' }),
      createEvent({ eventType: 'PLAYER_JOIN', playerName: 'Bravo', occurredAt: '2026-04-05T12:01:00.000Z' }),
      createEvent({ eventType: 'PLAYER_JOIN', playerName: 'Charlie', occurredAt: '2026-04-05T12:02:00.000Z' })
    ]);

    store.addEvents([
      createEvent({
        eventType: 'HEALTH_WARN',
        occurredAt: '2026-04-05T12:03:00.000Z',
        raw: {
          valheimDisconnectSignal: true,
          valheimDisconnectRule: 'playfab_socket_dispose',
          valheimCurrentPlayerCount: 1
        }
      })
    ]);

    const active = store.getActiveSessionsForServer('srv-1');
    const closed = store.getRecentClosedSessionsForServer('srv-1', 10);
    const recentEvents = store.getRecentEventsForServer('srv-1', 1);

    assert.equal(active.length, 1);
    assert.equal(active[0]?.playerName, 'Charlie');

    const closedNames = new Set(closed.map((session) => session.playerName));
    assert.equal(closed.length, 2);
    assert.equal(closedNames.has('Alpha'), true);
    assert.equal(closedNames.has('Bravo'), true);
    assert.equal(closed.every((session) => session.closeReason === 'occupancy_reconciliation'), true);
    assert.equal(closed.every((session) => session.endConfidence === 'low'), true);

    assert.equal(recentEvents[0]?.raw?.sessionCloseReason, 'occupancy_reconciliation');
    assert.equal(recentEvents[0]?.raw?.sessionReconciledCount, 2);
  });
});

test('PLAYER_JOIN still replaces already-active session with replaced_by_new_join', async () => {
  await withFreshEventStore((store) => {
    store.addEvents([
      createEvent({ eventType: 'PLAYER_JOIN', playerName: 'Delta', occurredAt: '2026-04-05T12:00:00.000Z' }),
      createEvent({ eventType: 'PLAYER_JOIN', playerName: 'Delta', occurredAt: '2026-04-05T12:10:00.000Z' })
    ]);

    const active = store.getActiveSessionsForServer('srv-1');
    const closed = store.getRecentClosedSessionsForServer('srv-1', 5);
    const recentEvents = store.getRecentEventsForServer('srv-1', 2);

    assert.equal(active.length, 1);
    assert.equal(active[0]?.playerName, 'Delta');
    assert.equal(active[0]?.startedAt, '2026-04-05T12:10:00.000Z');

    assert.equal(closed.length, 1);
    assert.equal(closed[0]?.playerName, 'Delta');
    assert.equal(closed[0]?.endedAt, '2026-04-05T12:10:00.000Z');
    assert.equal(closed[0]?.closeReason, 'replaced_by_new_join');
    assert.equal(closed[0]?.endConfidence, 'medium');

    const replacementEvent = recentEvents.find((event) => event.eventType === 'PLAYER_JOIN' && event.raw?.sessionCloseReason === 'replaced_by_new_join');
    assert.ok(replacementEvent);
    assert.equal(replacementEvent?.raw?.replacedSessionStartedAt, '2026-04-05T12:00:00.000Z');
  });
});

test('occupancy reconciliation does not close sessions when active count matches reported occupancy', async () => {
  await withFreshEventStore((store) => {
    store.addEvents([
      createEvent({ eventType: 'PLAYER_JOIN', playerName: 'Echo', occurredAt: '2026-04-05T12:00:00.000Z' }),
      createEvent({ eventType: 'PLAYER_JOIN', playerName: 'Foxtrot', occurredAt: '2026-04-05T12:01:00.000Z' })
    ]);

    store.addEvents([
      createEvent({
        eventType: 'PLAYER_LEAVE',
        occurredAt: '2026-04-05T12:02:00.000Z',
        raw: {
          valheimDisconnectRule: 'structured_connection_lost',
          valheimCurrentPlayerCount: 2
        }
      })
    ]);

    const active = store.getActiveSessionsForServer('srv-1');
    const closed = store.getRecentClosedSessionsForServer('srv-1', 10);
    const recentEvent = store.getRecentEventsForServer('srv-1', 1)[0];

    assert.equal(active.length, 2);
    assert.equal(closed.length, 0);
    assert.equal(recentEvent?.raw?.sessionReconciledCount, undefined);
    assert.equal(recentEvent?.raw?.sessionCloseReason, undefined);
  });
});

test('single active player disconnect gets correlated identity and closes session', async () => {
  await withFreshEventStore(async (store) => {
    store.addEvents([
      createEvent({
        id: 'single-join',
        eventType: 'PLAYER_JOIN',
        playerName: 'GeKo ViKiNgSoN',
        occurredAt: '2026-04-05T12:00:00.000Z'
      })
    ]);

    store.addEvents([
      createEvent({
        id: 'single-disconnect',
        eventType: 'PLAYER_LEAVE',
        occurredAt: '2026-04-05T12:02:00.000Z',
        raw: {
          valheimDisconnectRule: 'structured_connection_lost',
          valheimEventSource: 'journal'
        }
      })
    ]);

    const active = store.getActiveSessionsForServer('srv-1');
    const closed = store.getRecentClosedSessionsForServer('srv-1', 5);
    const recent = store.getRecentEventsForServer('srv-1', 1)[0];
    const rollups = await importRollupStore();
    const [player] = rollups.getPersistedPlayerRollupsForServer('srv-1')
      .filter((rollup) => rollup.displayName === 'GeKo ViKiNgSoN');

    assert.equal(active.length, 0);
    assert.equal(closed.length, 1);
    assert.equal(closed[0]?.playerName, 'GeKo ViKiNgSoN');
    assert.equal(closed[0]?.closeReason, 'player_leave');
    assert.equal(closed[0]?.durationSeconds, 120);
    assert.equal(recent?.playerName, 'GeKo ViKiNgSoN');
    assert.equal(recent?.raw?.valheimIdentitySource, 'single_active_session_correlation');
    assert.equal(player?.sessionCount, 1);
    assert.equal(player?.totalTrackedSeconds, 120);
  });
});

test('multiple active players ambiguous disconnect remains missing identity', async () => {
  await withFreshEventStore((store) => {
    store.addEvents([
      createEvent({ id: 'ambiguous-alpha', eventType: 'PLAYER_JOIN', playerName: 'Alpha', occurredAt: '2026-04-05T12:00:00.000Z' }),
      createEvent({ id: 'ambiguous-bravo', eventType: 'PLAYER_JOIN', playerName: 'Bravo', occurredAt: '2026-04-05T12:01:00.000Z' })
    ]);

    store.addEvents([
      createEvent({
        id: 'ambiguous-disconnect',
        eventType: 'PLAYER_LEAVE',
        occurredAt: '2026-04-05T12:02:00.000Z',
        raw: {
          valheimDisconnectRule: 'structured_connection_lost',
          valheimEventSource: 'journal'
        }
      })
    ]);

    const active = store.getActiveSessionsForServer('srv-1');
    const closed = store.getRecentClosedSessionsForServer('srv-1', 5);
    const recent = store.getRecentEventsForServer('srv-1', 1)[0];

    assert.equal(active.length, 2);
    assert.equal(closed.length, 0);
    assert.equal(recent?.playerName, undefined);
    assert.equal(recent?.raw?.valheimIdentitySource, undefined);
  });
});

test('disconnect socket id resolves matching active session identity', async () => {
  await withFreshEventStore((store) => {
    store.addEvents([
      createEvent({
        id: 'steam-alpha',
        eventType: 'PLAYER_JOIN',
        playerName: 'Alpha',
        platformId: 'steam_111',
        occurredAt: '2026-04-05T12:00:00.000Z',
        raw: {
          valheimIdentityPlatformId: 'steam_111'
        }
      })
    ]);
    store.addEvents([
      createEvent({
        id: 'steam-bravo',
        eventType: 'PLAYER_JOIN',
        playerName: 'Bravo',
        platformId: 'steam_222',
        occurredAt: '2026-04-05T12:01:00.000Z',
        raw: {
          valheimIdentityPlatformId: 'steam_222'
        }
      })
    ]);

    store.addEvents([
      createEvent({
        id: 'steam-disconnect',
        eventType: 'HEALTH_WARN',
        occurredAt: '2026-04-05T12:02:00.000Z',
        raw: {
          valheimDisconnectSignal: true,
          valheimDisconnectRule: 'socket_closed',
          valheimDisconnectSocketId: 'steam_222',
          valheimEventSource: 'journal'
        }
      })
    ]);

    const active = store.getActiveSessionsForServer('srv-1');
    const closed = store.getRecentClosedSessionsForServer('srv-1', 5);
    const recent = store.getRecentEventsForServer('srv-1', 1)[0];

    assert.deepEqual(active.map((session) => session.playerName), ['Alpha']);
    assert.equal(closed.length, 1);
    assert.equal(closed[0]?.playerName, 'Bravo');
    assert.equal(closed[0]?.closeReason, 'disconnect_signal');
    assert.equal(recent?.playerName, 'Bravo');
    assert.equal(recent?.platformId, 'steam_222');
    assert.equal(recent?.raw?.valheimIdentitySource, 'active_session_identity_match');
  });
});

test('disconnect with no active session remains missing identity', async () => {
  await withFreshEventStore((store) => {
    store.addEvents([
      createEvent({
        id: 'orphan-disconnect',
        eventType: 'PLAYER_LEAVE',
        occurredAt: '2026-04-05T12:02:00.000Z',
        raw: {
          valheimDisconnectRule: 'structured_connection_lost',
          valheimEventSource: 'journal'
        }
      })
    ]);

    const active = store.getActiveSessionsForServer('srv-1');
    const closed = store.getRecentClosedSessionsForServer('srv-1', 5);
    const recent = store.getRecentEventsForServer('srv-1', 1)[0];

    assert.equal(active.length, 0);
    assert.equal(closed.length, 0);
    assert.equal(recent?.playerName, undefined);
    assert.equal(recent?.raw?.valheimIdentitySource, undefined);
  });
});

test('recent events survive an event-store module restart through log truth storage', async () => {
  await withFreshEventStore(async (store) => {
    store.addEvents([
      createEvent({
        id: 'durable-event-1',
        eventType: 'SERVER_ONLINE',
        occurredAt: '2026-04-05T12:00:00.000Z',
        message: 'server online'
      })
    ]);

    const modulePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/event-store.ts')).href;
    const restartedStore: EventStoreModule = await import(`${modulePath}?t=${Date.now()}-${Math.random()}-restart`);
    const recentEvents = restartedStore.getRecentEventsForServer('srv-1', 5);

    assert.equal(recentEvents.length, 1);
    assert.equal(recentEvents[0]?.id, 'durable-event-1');
    assert.equal(recentEvents[0]?.eventType, 'SERVER_ONLINE');
    assert.equal(recentEvents[0]?.message, 'server online');
  });
});

test('duplicate PLAYER_JOIN does not mutate active sessions or recent events twice', async () => {
  await withFreshEventStore((store) => {
    const join = createEvent({
      id: 'duplicate-join',
      eventType: 'PLAYER_JOIN',
      playerName: 'Retry Alice',
      occurredAt: '2026-04-05T12:00:00.000Z'
    });

    store.addEvents([join]);
    store.addEvents([join]);

    const active = store.getActiveSessionsForServer('srv-1');
    const recentEvents = store.getRecentEventsForServer('srv-1', 10);

    assert.equal(active.length, 1);
    assert.equal(active[0]?.playerName, 'Retry Alice');
    assert.equal(active[0]?.startedAt, '2026-04-05T12:00:00.000Z');
    assert.equal(recentEvents.length, 1);
    assert.equal(recentEvents[0]?.id, 'duplicate-join');
  });
});

test('duplicate PLAYER_LEAVE does not double-close or double-count playtime', async () => {
  await withFreshEventStore(async (store) => {
    const join = createEvent({
      id: 'duplicate-leave-join',
      eventType: 'PLAYER_JOIN',
      playerName: 'Retry Bob',
      occurredAt: '2026-04-05T12:00:00.000Z'
    });
    const leave = createEvent({
      id: 'duplicate-leave',
      eventType: 'PLAYER_LEAVE',
      playerName: 'Retry Bob',
      occurredAt: '2026-04-05T12:05:00.000Z'
    });

    store.addEvents([join]);
    store.addEvents([leave]);
    store.addEvents([leave]);

    const active = store.getActiveSessionsForServer('srv-1');
    const closed = store.getRecentClosedSessionsForServer('srv-1', 10);
    const recentEvents = store.getRecentEventsForServer('srv-1', 10);
    const rollups = await importRollupStore();
    const [player] = rollups.getPersistedPlayerRollupsForServer('srv-1')
      .filter((rollup) => rollup.displayName === 'Retry Bob');

    assert.equal(active.length, 0);
    assert.equal(closed.length, 1);
    assert.equal(closed[0]?.durationSeconds, 300);
    assert.equal(closed[0]?.closeReason, 'player_leave');
    assert.equal(recentEvents.length, 2);
    assert.deepEqual(recentEvents.map((event) => event.id), ['duplicate-leave', 'duplicate-leave-join']);
    assert.equal(player?.sessionCount, 1);
    assert.equal(player?.totalTrackedSeconds, 300);
  });
});

test('duplicate unknown events do not appear twice in recent events', async () => {
  await withFreshEventStore((store) => {
    const chat = createEvent({
      eventType: 'CHAT_MESSAGE',
      playerName: 'Retry Charlie',
      message: 'Retry Charlie: hello',
      occurredAt: '2026-04-05T12:00:00.000Z',
      raw: {
        channel: 'global'
      }
    });

    store.addEvents([chat]);
    store.addEvents([{ ...chat }]);

    const recentEvents = store.getRecentEventsForServer('srv-1', 10);

    assert.equal(recentEvents.length, 1);
    assert.equal(recentEvents[0]?.eventType, 'CHAT_MESSAGE');
    assert.equal(recentEvents[0]?.message, 'Retry Charlie: hello');
  });
});
