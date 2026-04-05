import { mkdtempSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

type EventStoreModule = {
  addEvents: (events: Array<Record<string, unknown>>) => void;
  getActiveSessionsForServer: (serverId: string) => Array<Record<string, unknown>>;
  getRecentClosedSessionsForServer: (serverId: string, limit?: number) => Array<Record<string, unknown>>;
  getRecentEventsForServer: (serverId: string, limit?: number) => Array<Record<string, unknown>>;
};

function createEvent(overrides: Record<string, unknown>): Record<string, unknown> {
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

  process.env.SESSION_STATE_STORE_PATH = statePath;

  try {
    const modulePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/event-store.ts')).href;
    const store = await import(`${modulePath}?t=${Date.now()}-${Math.random()}`) as unknown as EventStoreModule;
    await run(store);
  } finally {
    if (previousPath === undefined) {
      delete process.env.SESSION_STATE_STORE_PATH;
    } else {
      process.env.SESSION_STATE_STORE_PATH = previousPath;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
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
