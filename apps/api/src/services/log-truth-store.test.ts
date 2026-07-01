import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { LogTruthHealth, NormalizedEvent } from '@gameops/shared';
import type { LogTruthEntry } from './log-truth-store.js';

type LogTruthStoreModule = {
  appendLogTruthEvents: (events: NormalizedEvent[], receivedAt?: string) => LogTruthEntry[];
  getRecentLogTruthEntriesForServer: (serverId: string, limit?: number) => LogTruthEntry[];
  getRecentLogTruthEventsForServer: (serverId: string, limit?: number) => NormalizedEvent[];
  getLogTruthHealth: () => LogTruthHealth;
};

function createEvent(overrides: Partial<NormalizedEvent>): NormalizedEvent {
  return {
    game: 'valheim',
    serverId: 'srv-1',
    occurredAt: '2026-04-05T12:00:00.000Z',
    eventType: 'HEALTH_WARN',
    message: 'server warning',
    ...overrides
  };
}

async function withFreshLogTruthStore(run: (store: LogTruthStoreModule) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-log-truth-test-'));
  const previousPath = process.env.LOG_TRUTH_STORE_PATH;
  process.env.LOG_TRUTH_STORE_PATH = join(tempDir, 'log-truth.json');

  try {
    const modulePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/log-truth-store.ts')).href;
    const store: LogTruthStoreModule = await import(`${modulePath}?t=${Date.now()}-${Math.random()}`);
    await run(store);
  } finally {
    if (previousPath === undefined) {
      delete process.env.LOG_TRUTH_STORE_PATH;
    } else {
      process.env.LOG_TRUTH_STORE_PATH = previousPath;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('appends canonical normalized events with wrapper metadata', async () => {
  await withFreshLogTruthStore((store) => {
    const appended = store.appendLogTruthEvents([
      createEvent({
        id: 'event-1',
        eventType: 'PLAYER_JOIN',
        playerName: 'Alice',
        raw: {
          valheimEventSource: 'journal',
          valheimIdentityConfidence: 'high'
        }
      })
    ], '2026-04-05T12:00:01.000Z');

    assert.equal(appended.length, 1);
    assert.equal(appended[0]?.serverId, 'srv-1');
    assert.equal(appended[0]?.game, 'valheim');
    assert.equal(appended[0]?.eventType, 'PLAYER_JOIN');
    assert.equal(appended[0]?.occurredAt, '2026-04-05T12:00:00.000Z');
    assert.equal(appended[0]?.receivedAt, '2026-04-05T12:00:01.000Z');
    assert.equal(appended[0]?.source, 'journal');
    assert.equal(appended[0]?.confidence, 'high');
    assert.equal(appended[0]?.event.playerName, 'Alice');
  });
});

test('dedupes repeated events by event id', async () => {
  await withFreshLogTruthStore((store) => {
    const event = createEvent({ id: 'same-event', eventType: 'SERVER_ONLINE' });

    assert.equal(store.appendLogTruthEvents([event]).length, 1);
    assert.equal(store.appendLogTruthEvents([event]).length, 0);
    assert.equal(store.getRecentLogTruthEntriesForServer('srv-1', 10).length, 1);
  });
});

test('dedupes repeated events by fallback fingerprint', async () => {
  await withFreshLogTruthStore((store) => {
    const event = createEvent({
      eventType: 'PLAYER_LEAVE',
      playerName: 'Alice',
      message: 'player left: Alice'
    });

    assert.equal(store.appendLogTruthEvents([event]).length, 1);
    assert.equal(store.appendLogTruthEvents([{ ...event }]).length, 0);
    assert.equal(store.getRecentLogTruthEventsForServer('srv-1', 10).length, 1);
  });
});

test('preserves unrecognized raw event details', async () => {
  await withFreshLogTruthStore((store) => {
    store.appendLogTruthEvents([
      createEvent({
        eventType: 'CHAT_MESSAGE',
        playerName: 'Mystery',
        message: 'unhandled chat payload',
        raw: {
          unrecognizedPacket: {
            channel: 'global',
            text: 'hello'
          }
        }
      })
    ]);

    const recent = store.getRecentLogTruthEventsForServer('srv-1', 1);
    assert.equal(recent[0]?.eventType, 'CHAT_MESSAGE');
    assert.deepEqual(recent[0]?.raw?.unrecognizedPacket, {
      channel: 'global',
      text: 'hello'
    });
  });
});

test('reports healthy log truth storage with event count and last append time', async () => {
  await withFreshLogTruthStore((store) => {
    store.appendLogTruthEvents([
      createEvent({
        id: 'health-event-1',
        eventType: 'SERVER_ONLINE'
      })
    ], '2026-04-05T12:00:02.000Z');

    const health = store.getLogTruthHealth();

    assert.equal(health.status, 'healthy');
    assert.equal(health.readable, true);
    assert.equal(health.writable, true);
    assert.equal(health.lastSuccessfulAppendAt, '2026-04-05T12:00:02.000Z');
    assert.equal(health.lastError, null);
    assert.equal(health.totalEventCount, 1);
    assert.match(health.path, /log-truth\.json$/);
  });
});

test('reports unhealthy log truth storage after write failure', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-log-truth-failed-test-'));
  const badPath = join(tempDir, 'log-truth-dir');
  const previousPath = process.env.LOG_TRUTH_STORE_PATH;
  mkdirSync(badPath);
  process.env.LOG_TRUTH_STORE_PATH = badPath;

  try {
    const modulePath = pathToFileURL(resolve('../gameops-bridge/apps/api/src/services/log-truth-store.ts')).href;
    const store: LogTruthStoreModule = await import(`${modulePath}?t=${Date.now()}-${Math.random()}-failed`);

    assert.equal(store.appendLogTruthEvents([createEvent({ id: 'write-fail' })]).length, 0);

    const health = store.getLogTruthHealth();
    assert.equal(health.status, 'unhealthy');
    assert.equal(health.readable, false);
    assert.equal(health.writable, false);
    assert.match(health.lastError ?? '', /EISDIR|illegal operation|not a file|directory/i);
  } finally {
    if (previousPath === undefined) {
      delete process.env.LOG_TRUTH_STORE_PATH;
    } else {
      process.env.LOG_TRUTH_STORE_PATH = previousPath;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
});
