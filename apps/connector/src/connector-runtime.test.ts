import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildConnectorHeartbeatPayload,
  createCollectorRegistry,
  createCollectorRunner,
  createValheimCollectorShadow,
  getCollectorHealthForHeartbeat,
  getValheimCollectorShadowHealthForHeartbeat,
  resolveValheimCollectorShadowBackfillLines,
  resolveValheimCollectorShadowEnabled,
  resolveCollectorsEnabled
} from './connector-runtime.js';
import type { NormalizedEvent } from '@gameops/shared';

function valheimJoinEvent(playerName = 'Alice'): NormalizedEvent {
  return {
    game: 'valheim',
    serverId: 'srv-shadow',
    eventType: 'PLAYER_JOIN',
    playerName,
    occurredAt: '2026-07-01T12:00:00.000Z'
  };
}

test('collectors are disabled by default and heartbeat payload has empty health', () => {
  const registry = createCollectorRegistry({
    serverId: 'srv-disabled',
    game: 'valheim',
    mode: 'journal',
    collectorsEnabled: false
  });
  const runner = createCollectorRunner(registry);
  const payload = buildConnectorHeartbeatPayload({
    serverId: 'srv-disabled',
    game: 'valheim',
    mode: 'journal',
    observedAt: '2026-07-01T12:00:00.000Z',
    status: 'running',
    message: 'Journal stream is active.',
    capabilities: ['log_stream', 'join_leave'],
    collectors: getCollectorHealthForHeartbeat(runner)
  });

  assert.equal(registry.list().length, 0);
  assert.deepEqual(payload.collectors, []);
  assert.equal(payload.connectorMode, 'journal');
  assert.deepEqual(payload.capabilities, ['log_stream', 'join_leave']);
});

test('collector health is included when collectors are enabled', () => {
  const registry = createCollectorRegistry({
    serverId: 'srv-enabled',
    game: 'palworld',
    mode: 'rest',
    collectorsEnabled: true
  });
  const runner = createCollectorRunner(registry);
  const payload = buildConnectorHeartbeatPayload({
    serverId: 'srv-enabled',
    game: 'palworld',
    mode: 'rest',
    observedAt: '2026-07-01T12:00:00.000Z',
    status: 'running',
    message: 'Palworld REST poll succeeded.',
    capabilities: ['players', 'metrics'],
    collectors: getCollectorHealthForHeartbeat(runner)
  });

  assert.equal(registry.list().length, 1);
  assert.equal(payload.collectors.length, 1);
  assert.equal(payload.collectors[0]?.collectorId, 'palworld:srv-enabled:rest');
  assert.equal(payload.collectors[0]?.enabled, true);
  assert.equal(payload.collectors[0]?.totalEventsEmitted, 0);
});

test('failed collector health does not break heartbeat payload building', () => {
  const collectors = getCollectorHealthForHeartbeat({
    health: () => {
      throw new Error('health failed');
    }
  });
  const payload = buildConnectorHeartbeatPayload({
    serverId: 'srv-health-failed',
    game: 'valheim',
    mode: 'journal',
    observedAt: '2026-07-01T12:00:00.000Z',
    status: 'degraded',
    message: 'Heartbeat still sends.',
    capabilities: ['log_stream'],
    collectors
  });

  assert.deepEqual(collectors, []);
  assert.deepEqual(payload.collectors, []);
  assert.equal(payload.status, 'degraded');
});

test('collector enabled flag can come from environment or feature flag', () => {
  assert.equal(resolveCollectorsEnabled({ env: {} }), false);
  assert.equal(resolveCollectorsEnabled({ env: {}, featureFlagValue: true }), true);
  assert.equal(resolveCollectorsEnabled({ env: { GAMEOPS_COLLECTORS_ENABLED: 'true' } }), true);
  assert.equal(resolveCollectorsEnabled({ env: { CONNECTOR_COLLECTORS_ENABLED: '1' } }), true);
  assert.equal(resolveCollectorsEnabled({
    env: {
      GAMEOPS_COLLECTORS_ENABLED: 'false',
      CONNECTOR_COLLECTORS_ENABLED: 'true'
    },
    featureFlagValue: true
  }), false);
});

test('valheim collector shadow is disabled by default', () => {
  assert.equal(resolveValheimCollectorShadowEnabled({ env: {} }), false);
  assert.equal(createValheimCollectorShadow({
    serverId: 'srv-shadow-disabled',
    game: 'valheim',
    mode: 'file',
    enabled: false
  }), null);
});

test('valheim collector shadow flag can come from environment or feature flag', () => {
  assert.equal(resolveValheimCollectorShadowEnabled({ env: {}, featureFlagValue: true }), true);
  assert.equal(resolveValheimCollectorShadowEnabled({
    env: { GAMEOPS_VALHEIM_COLLECTOR_SHADOW: 'true' }
  }), true);
  assert.equal(resolveValheimCollectorShadowEnabled({
    env: { GAMEOPS_VALHEIM_COLLECTOR_SHADOW: 'false' },
    featureFlagValue: true
  }), false);
});

test('valheim collector shadow backfill is disabled by default', () => {
  assert.equal(resolveValheimCollectorShadowBackfillLines({ env: {} }), 0);
  assert.equal(resolveValheimCollectorShadowBackfillLines({
    env: { GAMEOPS_VALHEIM_COLLECTOR_SHADOW_BACKFILL_LINES: 'not-a-number' },
    featureFlagValue: 25
  }), 0);
});

test('valheim collector shadow backfill line count can come from environment or config', () => {
  assert.equal(resolveValheimCollectorShadowBackfillLines({ env: {}, featureFlagValue: 25 }), 25);
  assert.equal(resolveValheimCollectorShadowBackfillLines({
    env: { GAMEOPS_VALHEIM_COLLECTOR_SHADOW_BACKFILL_LINES: '10' },
    featureFlagValue: 25
  }), 10);
  assert.equal(resolveValheimCollectorShadowBackfillLines({
    env: { GAMEOPS_VALHEIM_COLLECTOR_SHADOW_BACKFILL_LINES: '-5' }
  }), 0);
});

test('valheim collector shadow runs without forwarding events', async () => {
  const shadow = createValheimCollectorShadow({
    serverId: 'srv-shadow',
    game: 'valheim',
    mode: 'file',
    enabled: true
  });
  const forwarded: NormalizedEvent[] = [];

  assert.ok(shadow);

  await shadow.run({
    oldPathEvents: [valheimJoinEvent()],
    collect: () => [valheimJoinEvent()]
  });

  const health = shadow.health();

  assert.deepEqual(forwarded, []);
  assert.equal(health.shadow?.eventCount, 1);
  assert.deepEqual(health.shadow?.eventTypes, ['PLAYER_JOIN']);
  assert.equal(health.shadow?.parityStatus, 'matching');
  assert.equal(health.lastError, null);
});

test('valheim collector shadow scheduled run collects from configured file without forwarding', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-valheim-shadow-scheduler-test-'));
  const logFile = join(tempDir, 'valheim.log');

  try {
    writeFileSync(logFile, [
      '[2026-04-01T20:00:00Z] Game server connected',
      '[2026-04-01T20:01:10Z] Player joined: Alice'
    ].join('\n'), 'utf8');

    const shadow = createValheimCollectorShadow({
      serverId: 'srv-shadow-scheduled',
      game: 'valheim',
      mode: 'file',
      enabled: true,
      logFile
    });
    const apiIngestedEvents: NormalizedEvent[] = [];

    assert.ok(shadow);

    await shadow.runScheduled();

    const health = shadow.health();

    assert.deepEqual(apiIngestedEvents, []);
    assert.equal(health.shadow?.eventCount, 2);
    assert.deepEqual(health.shadow?.eventTypes, ['SERVER_ONLINE', 'PLAYER_JOIN']);
    assert.equal(health.shadow?.parityStatus, 'not_available');
    assert.match(health.shadow?.lastRunAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(health.lastError, null);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('valheim collector shadow backfill reads recent file window and does not forward events', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-valheim-shadow-backfill-test-'));
  const logFile = join(tempDir, 'valheim.log');

  try {
    writeFileSync(logFile, [
      '[2026-04-01T20:00:00Z] Game server connected',
      '[2026-04-01T20:01:10Z] Player joined: Alice',
      '[2026-04-01T20:10:05Z] Player left: Alice'
    ].join('\n'), 'utf8');

    const shadow = createValheimCollectorShadow({
      serverId: 'srv-shadow-backfill',
      game: 'valheim',
      mode: 'file',
      enabled: true,
      backfillLines: 2,
      logFile
    });
    const apiIngestedEvents: NormalizedEvent[] = [];

    assert.ok(shadow);

    await shadow.runBackfill();

    const health = shadow.health();

    assert.deepEqual(apiIngestedEvents, []);
    assert.equal(health.shadow?.eventCount, 2);
    assert.deepEqual(health.shadow?.eventTypes, ['PLAYER_JOIN', 'PLAYER_LEAVE']);
    assert.equal(health.shadow?.parityStatus, 'not_available');
    assert.match(health.shadow?.lastRunAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(health.shadow?.lastError, null);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('valheim collector shadow failure records health without throwing', async () => {
  const shadow = createValheimCollectorShadow({
    serverId: 'srv-shadow-failure',
    game: 'valheim',
    mode: 'file',
    enabled: true
  });

  assert.ok(shadow);

  await shadow.run({
    oldPathEvents: [valheimJoinEvent()],
    collect: () => {
      throw new Error('shadow read failed');
    }
  });

  const health = shadow.health();

  assert.match(health.lastError ?? '', /shadow read failed/);
  assert.equal(health.shadow?.lastError, 'shadow read failed');
  assert.equal(health.shadow?.parityStatus, 'error');
  assert.equal(health.shadow?.eventCount, 0);
});

test('valheim collector shadow scheduled failure updates lastError without throwing', async () => {
  const shadow = createValheimCollectorShadow({
    serverId: 'srv-shadow-scheduled-failure',
    game: 'valheim',
    mode: 'file',
    enabled: true
  });

  assert.ok(shadow);

  await shadow.runScheduled();

  const health = shadow.health();

  assert.match(health.shadow?.lastError ?? '', /requires configuration\.logFile/);
  assert.equal(health.shadow?.parityStatus, 'error');
  assert.equal(health.shadow?.eventCount, 0);
});

test('valheim collector shadow backfill failure updates lastError without forwarding', async () => {
  const shadow = createValheimCollectorShadow({
    serverId: 'srv-shadow-backfill-failure',
    game: 'valheim',
    mode: 'file',
    enabled: true,
    backfillLines: 5
  });
  const apiIngestedEvents: NormalizedEvent[] = [];

  assert.ok(shadow);

  await shadow.runBackfill();

  const health = shadow.health();

  assert.deepEqual(apiIngestedEvents, []);
  assert.match(health.shadow?.lastError ?? '', /backfill requires configuration\.logFile/);
  assert.equal(health.shadow?.parityStatus, 'error');
  assert.equal(health.shadow?.eventCount, 0);
});

test('heartbeat includes valheim shadow health', async () => {
  const shadow = createValheimCollectorShadow({
    serverId: 'srv-shadow-heartbeat',
    game: 'valheim',
    mode: 'file',
    enabled: true
  });

  assert.ok(shadow);

  await shadow.run({
    oldPathEvents: [valheimJoinEvent()],
    collect: () => [valheimJoinEvent()]
  });

  const collectors = getValheimCollectorShadowHealthForHeartbeat(shadow);
  const payload = buildConnectorHeartbeatPayload({
    serverId: 'srv-shadow-heartbeat',
    game: 'valheim',
    mode: 'file',
    observedAt: '2026-07-01T12:00:01.000Z',
    status: 'running',
    message: 'Connector is reading the configured log file.',
    capabilities: ['log_file', 'join_leave'],
    collectors
  });

  assert.equal(payload.collectors.length, 1);
  assert.equal(payload.collectors[0]?.collectorId, 'valheim:srv-shadow-heartbeat:file:shadow');
  assert.equal(payload.collectors[0]?.name, 'Valheim Collector Shadow');
  assert.equal(payload.collectors[0]?.shadow?.enabled, true);
  assert.equal(payload.collectors[0]?.shadow?.parityStatus, 'matching');
  assert.deepEqual(payload.collectors[0]?.shadow?.eventTypes, ['PLAYER_JOIN']);
});

test('existing heartbeat fields remain unchanged when collectors are absent', () => {
  const payload = buildConnectorHeartbeatPayload({
    serverId: 'srv-existing',
    game: 'valheim',
    mode: 'file',
    observedAt: '2026-07-01T12:00:00.000Z',
    status: 'running',
    message: 'Connector is reading the configured log file.',
    lastSuccessfulPollAt: '2026-07-01T12:00:00.000Z',
    consecutiveFailureCount: 0,
    capabilities: ['log_file', 'join_leave']
  });

  assert.equal(payload.serverId, 'srv-existing');
  assert.equal(payload.game, 'valheim');
  assert.equal(payload.connectorMode, 'file');
  assert.equal(payload.status, 'running');
  assert.equal(payload.lastSuccessfulPollAt, '2026-07-01T12:00:00.000Z');
  assert.equal(payload.consecutiveFailureCount, 0);
  assert.deepEqual(payload.capabilities, ['log_file', 'join_leave']);
  assert.deepEqual(payload.collectors, []);
});
