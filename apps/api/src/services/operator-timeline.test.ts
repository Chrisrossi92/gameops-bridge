import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { OperatorBrief, OperatorContext } from '@gameops/shared';
import {
  buildTimelineEventsFromOperatorState,
  OperatorTimelineStore
} from './operator-timeline.js';

function timelinePath(): string {
  return join(mkdtempSync(join(tmpdir(), 'gameops-operator-timeline-')), 'timeline.json');
}

test('appends and queries timeline events', () => {
  const store = new OperatorTimelineStore({ path: timelinePath(), dedupWindowMs: 0 });
  const event = store.appendEvent({
    type: 'git',
    severity: 'warning',
    occurredAt: '2026-06-29T12:00:00.000Z',
    title: 'Repository has local changes',
    summary: 'GameOps Bridge is dirty on main.',
    fingerprint: 'git:gameops:dirty'
  });

  assert.equal(event.type, 'git');
  assert.equal(store.recentEvents(10).length, 1);
  assert.equal(store.queryEvents({ type: 'git' })[0]?.title, 'Repository has local changes');
  assert.equal(store.queryEvents({ type: 'disk' }).length, 0);
});

test('trims oldest timeline events', () => {
  const store = new OperatorTimelineStore({ path: timelinePath(), maxEvents: 3, dedupWindowMs: 0 });

  for (let index = 0; index < 5; index += 1) {
    store.appendEvent({
      type: 'operator',
      severity: 'info',
      occurredAt: `2026-06-29T12:0${index}:00.000Z`,
      title: `Event ${index}`,
      summary: `Operator event ${index}`,
      fingerprint: `operator:event:${index}`
    });
  }

  const events = store.recentEvents(10);
  assert.equal(events.length, 3);
  assert.deepEqual(events.map((event) => event.title), ['Event 4', 'Event 3', 'Event 2']);
});

test('deduplicates repeated events within the configured window', () => {
  const store = new OperatorTimelineStore({ path: timelinePath(), dedupWindowMs: 60_000 });
  const first = store.appendEvent({
    type: 'pm2',
    severity: 'warning',
    occurredAt: '2026-06-29T12:00:00.000Z',
    title: 'PM2 process state changed',
    summary: 'gameops-api is stopped in PM2.',
    fingerprint: 'pm2:process:gameops-api:stopped'
  });
  const second = store.appendEvent({
    type: 'pm2',
    severity: 'warning',
    occurredAt: '2026-06-29T12:00:30.000Z',
    title: 'PM2 process state changed',
    summary: 'gameops-api is stopped in PM2.',
    fingerprint: 'pm2:process:gameops-api:stopped'
  });

  assert.equal(second.id, first.id);
  assert.equal(store.recentEvents(10).length, 1);
});

test('redacts event text before persistence', () => {
  const path = timelinePath();
  const store = new OperatorTimelineStore({ path, dedupWindowMs: 0 });
  store.appendEvent({
    type: 'operator',
    severity: 'warning',
    title: 'Secret seen',
    summary: 'DISCORD_TOKEN=super-secret-token-value should not persist',
    fingerprint: 'operator:secret-test'
  });

  const raw = readFileSync(path, 'utf8');
  assert(!raw.includes('super-secret-token-value'));
  assert(raw.includes('[REDACTED]'));
});

test('builds timeline events from meaningful operator state', () => {
  const context: OperatorContext = {
    generatedAt: '2026-06-29T12:00:00.000Z',
    readOnly: true,
    pm2: {
      status: 'available',
      processCount: 1,
      processes: [{
        name: 'gameops-api',
        pid: 123,
        status: 'stopped',
        restarts: 0,
        uptimeMs: null,
        memoryBytes: null,
        cpuPercent: null
      }]
    },
    system: {
      uptimeSeconds: 100,
      loadAverage: [0.2, 0.3, 0.4],
      cpuCount: 2,
      memory: {
        totalBytes: 100,
        freeBytes: 50,
        usedBytes: 50,
        usedPercent: 50
      }
    },
    disks: [{
      label: 'root',
      status: 'available',
      sizeBytes: 100,
      usedBytes: 91,
      availableBytes: 9,
      usedPercent: 91
    }],
    logs: [],
    repos: [{
      label: 'gameops',
      status: 'available',
      branch: 'main',
      upstream: 'origin/main',
      isDirty: true,
      ahead: 0,
      behind: 1,
      modifiedCount: 2,
      stagedCount: 0,
      untrackedCount: 1,
      changedFilePaths: ['apps/api/src/index.ts'],
      changes: [' M apps/api/src/index.ts'],
      lastCommit: null,
      recommendations: ['local-changes-review', 'behind-upstream']
    }],
    healthChecks: [],
    collectionWarnings: []
  };
  const brief: OperatorBrief = {
    generatedAt: context.generatedAt,
    readOnly: true,
    health: 'warning',
    summary: 'Operator warning.',
    risks: ['gameops-api is stopped in PM2.'],
    recentEvents: [],
    recommendations: ['Pull only after local repo changes are reviewed.']
  };
  const events = buildTimelineEventsFromOperatorState(context, brief);

  assert(events.some((event) => event.type === 'pm2' && event.fingerprint === 'pm2:process:gameops-api:stopped'));
  assert(events.some((event) => event.type === 'disk' && event.fingerprint === 'disk:root:high'));
  assert(events.some((event) => event.type === 'git' && event.fingerprint === 'git:gameops:dirty'));
  assert(events.some((event) => event.type === 'deployment' && event.fingerprint === 'deployment:gameops:behind'));
  assert(events.some((event) => event.type === 'operator' && event.title === 'Operator recommendation generated'));
});

