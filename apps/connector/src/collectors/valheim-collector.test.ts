import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { NormalizedEvent } from '@gameops/shared';
import { valheimAdapter } from '../adapters/valheim/parser.js';
import { CollectorRegistry } from './registry.js';
import { CollectorRunner } from './runner.js';
import { ValheimCollector } from './valheim.js';

function sampleLines(): string[] {
  return readFileSync(resolve('../gameops-bridge/apps/connector/samples/valheim.sample.log'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

test('ValheimCollector emits the same normalized events as the existing parser for sample lines', () => {
  const collector = new ValheimCollector({
    serverId: 'valheim-parity',
    enabled: true,
    mode: 'journal'
  });
  const lines = sampleLines();
  const oldPathEvents = lines
    .map((line) => valheimAdapter.parseLine(line, { serverId: 'valheim-parity' }))
    .filter((event): event is NormalizedEvent => event !== null);
  const collectorEvents = collector.collectLines(lines);

  assert.deepEqual(collectorEvents, oldPathEvents);
  assert.deepEqual(collectorEvents.map((event) => event.eventType), [
    'SERVER_ONLINE',
    'PLAYER_JOIN',
    'PLAYER_JOIN',
    'HEALTH_WARN',
    'PLAYER_LEAVE',
    'HEALTH_WARN',
    'PLAYER_JOIN',
    'PLAYER_JOIN'
  ]);
});

test('ValheimCollector ignores unknown lines like the existing parser', () => {
  const collector = new ValheimCollector({
    serverId: 'valheim-unknown',
    enabled: true,
    mode: 'journal'
  });
  const line = '[2026-04-01T20:00:00Z] harmless informational line';

  assert.equal(valheimAdapter.parseLine(line, { serverId: 'valheim-unknown' }), null);
  assert.deepEqual(collector.collectLines([line]), []);
});

test('ValheimCollector shadow mode emits operational category labels', () => {
  const collector = new ValheimCollector({
    serverId: 'valheim-shadow-categories',
    enabled: true,
    mode: 'journal',
    includeOperationalEventCategories: true
  });
  const line = '07/01/2026 10:00:00: World saved';

  const events = collector.collectLines([line]);

  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, 'CHAT_MESSAGE');
  assert.equal(events[0]?.raw?.valheimEventCategory, 'world_saved');
  assert.equal(events[0]?.raw?.valheimEventConfidence, 'high');
  assert.equal(events[0]?.raw?.valheimRawLine, line);
});

test('ValheimCollector file mode collects only new parsed lines', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-valheim-collector-test-'));
  const logFile = join(tempDir, 'valheim.log');

  try {
    writeFileSync(logFile, [
      '[2026-04-01T20:00:00Z] Game server connected',
      '[2026-04-01T20:01:10Z] Player joined: Alice'
    ].join('\n'), 'utf8');

    const collector = new ValheimCollector({
      serverId: 'valheim-file',
      enabled: true,
      mode: 'file',
      logFile
    });

    const first = await collector.collect();
    assert.deepEqual(first.map((event) => event.eventType), ['SERVER_ONLINE', 'PLAYER_JOIN']);

    const second = await collector.collect();
    assert.deepEqual(second, []);

    writeFileSync(logFile, [
      '[2026-04-01T20:00:00Z] Game server connected',
      '[2026-04-01T20:01:10Z] Player joined: Alice',
      '[2026-04-01T20:10:05Z] Player left: Alice'
    ].join('\n'), 'utf8');

    const third = await collector.collect();
    assert.equal(third.length, 1);
    assert.equal(third[0]?.eventType, 'PLAYER_LEAVE');
    assert.equal(third[0]?.playerName, 'Alice');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ValheimCollector health records runner success', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-valheim-health-test-'));
  const logFile = join(tempDir, 'valheim.log');

  try {
    writeFileSync(logFile, '[2026-04-01T20:00:00Z] Game server connected\n', 'utf8');

    const registry = new CollectorRegistry();
    registry.register(new ValheimCollector({
      serverId: 'valheim-health',
      enabled: true,
      mode: 'file',
      logFile
    }));
    const forwarded: NormalizedEvent[] = [];
    const runner = new CollectorRunner({
      registry,
      forwardEvents: (events) => {
        forwarded.push(...events);
      }
    });

    const result = await runner.runOnce();
    const health = runner.health()[0];

    assert.equal(result[0]?.ok, true);
    assert.equal(result[0]?.emitted, 1);
    assert.equal(forwarded.length, 1);
    assert.equal(health?.lastError, null);
    assert.match(health?.lastSuccessfulCollectionAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(health?.totalEventsEmitted, 1);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ValheimCollector failure does not stop later collectors in the runner', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-valheim-failure-test-'));
  const logFile = join(tempDir, 'valheim.log');

  try {
    writeFileSync(logFile, '[2026-04-01T20:00:00Z] Game server connected\n', 'utf8');

    const registry = new CollectorRegistry();
    registry.register(new ValheimCollector({
      serverId: 'valheim-missing-log',
      enabled: true,
      mode: 'file'
    }));
    registry.register(new ValheimCollector({
      serverId: 'valheim-after-failure',
      enabled: true,
      mode: 'file',
      logFile
    }));
    const forwarded: NormalizedEvent[] = [];
    const runner = new CollectorRunner({
      registry,
      forwardEvents: (events) => {
        forwarded.push(...events);
      }
    });

    const results = await runner.runOnce();
    const health = runner.health();

    assert.equal(results.length, 2);
    assert.equal(results[0]?.ok, false);
    assert.match(results[0]?.error ?? '', /requires configuration\.logFile/);
    assert.equal(results[1]?.ok, true);
    assert.equal(forwarded.length, 1);
    assert.match(health[0]?.lastError ?? '', /requires configuration\.logFile/);
    assert.equal(health[1]?.totalEventsEmitted, 1);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
