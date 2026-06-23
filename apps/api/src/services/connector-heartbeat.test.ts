import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearConnectorHeartbeatsForTests,
  getServerOperationalStatus,
  recordConnectorHeartbeat
} from './connector-heartbeat.js';

test('returns unknown for a configured server before connector heartbeat arrives', () => {
  clearConnectorHeartbeatsForTests();

  const status = getServerOperationalStatus('srv-1', true, new Date('2026-06-10T12:00:00.000Z'));

  assert.equal(status.configured, true);
  assert.equal(status.connectorStatus, 'unknown');
  assert.equal(status.lastHeartbeatAt, null);
  assert.equal(status.explanation, 'Configured, but connector has not reported yet.');
});

test('returns running while heartbeat is fresh', () => {
  clearConnectorHeartbeatsForTests();
  recordConnectorHeartbeat({
    serverId: 'srv-1',
    game: 'palworld',
    connectorMode: 'rest',
    observedAt: '2026-06-10T12:00:00.000Z',
    status: 'running',
    message: 'Palworld REST poll succeeded.',
    lastSuccessfulPollAt: '2026-06-10T12:00:00.000Z',
    consecutiveFailureCount: 0,
    capabilities: ['players', 'metrics']
  });

  const status = getServerOperationalStatus('srv-1', true, new Date('2026-06-10T12:00:08.000Z'));

  assert.equal(status.connectorStatus, 'running');
  assert.equal(status.heartbeatAgeSeconds, 8);
  assert.equal(status.lastSuccessfulPollAt, '2026-06-10T12:00:00.000Z');
  assert.deepEqual(status.capabilities, ['players', 'metrics']);
});

test('returns stale when heartbeat is older than threshold', () => {
  clearConnectorHeartbeatsForTests();
  recordConnectorHeartbeat({
    serverId: 'srv-1',
    game: 'valheim',
    connectorMode: 'journal',
    observedAt: '2026-06-10T12:00:00.000Z',
    status: 'running',
    message: 'Journal stream is active.',
    capabilities: ['log_stream']
  });

  const status = getServerOperationalStatus('srv-1', true, new Date('2026-06-10T12:02:00.000Z'));

  assert.equal(status.connectorStatus, 'stale');
  assert.equal(status.heartbeatAgeSeconds, 120);
  assert.equal(status.explanation, 'Connector stale. Last heard 2 minutes ago.');
});

test('returns error details from fresh failing heartbeat', () => {
  clearConnectorHeartbeatsForTests();
  recordConnectorHeartbeat({
    serverId: 'srv-1',
    game: 'palworld',
    connectorMode: 'rest',
    observedAt: '2026-06-10T12:00:00.000Z',
    status: 'error',
    message: 'Palworld REST poll failed.',
    consecutiveFailureCount: 3,
    capabilities: ['players', 'metrics']
  });

  const status = getServerOperationalStatus('srv-1', true, new Date('2026-06-10T12:00:05.000Z'));

  assert.equal(status.connectorStatus, 'error');
  assert.equal(status.consecutiveFailureCount, 3);
  assert.equal(status.explanation, 'Connector reporting errors after 3 consecutive failed polls.');
});
