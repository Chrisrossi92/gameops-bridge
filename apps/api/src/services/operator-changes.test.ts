import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperatorBrief, OperatorTimelineEvent } from '@gameops/shared';
import { buildOperatorChangesSummary } from './operator-changes.js';
import type { OperatorTimelineEventInput } from './operator-timeline.js';

const now = new Date('2026-06-29T12:00:00.000Z');
const quietBrief: OperatorBrief = {
  generatedAt: now.toISOString(),
  readOnly: true,
  health: 'ok',
  summary: 'Server health stable.',
  risks: [],
  recentEvents: [],
  recommendations: ['No immediate server action is indicated from read-only signals.']
};

function event(input: Partial<OperatorTimelineEvent> & Pick<OperatorTimelineEvent, 'type' | 'summary' | 'fingerprint'>): OperatorTimelineEvent {
  return {
    id: input.id ?? input.fingerprint,
    severity: input.severity ?? 'warning',
    occurredAt: input.occurredAt ?? '2026-06-29T11:00:00.000Z',
    title: input.title ?? 'Operator event',
    metadata: input.metadata ?? {},
    ...input
  };
}

function current(input: Pick<OperatorTimelineEventInput, 'type' | 'summary' | 'fingerprint'> & Partial<OperatorTimelineEventInput>): OperatorTimelineEventInput {
  return {
    severity: input.severity ?? 'warning',
    title: input.title ?? 'Current operator event',
    ...input
  };
}

test('change summary handles no changes', () => {
  const summary = buildOperatorChangesSummary({
    events: [],
    currentBrief: quietBrief,
    currentEvents: [],
    now
  });

  assert.equal(summary.confidence, 'low');
  assert.match(summary.headline, /No meaningful operator changes/);
  assert.deepEqual(summary.newWarnings, []);
  assert.deepEqual(summary.resolvedWarnings, []);
  assert(summary.unchangedSignals.some((signal) => signal.includes('no active risks')));
});

test('change summary detects new git dirty state', () => {
  const gitDirty = event({
    type: 'git',
    summary: 'GameOps Bridge is dirty on main with 2 modified and 1 untracked files.',
    fingerprint: 'git:gameops:dirty'
  });
  const summary = buildOperatorChangesSummary({
    events: [gitDirty],
    currentBrief: { ...quietBrief, health: 'warning', risks: ['GameOps Bridge has local changes.'] },
    currentEvents: [current(gitDirty)],
    now
  });

  assert(summary.newWarnings.some((warning) => warning.includes('dirty on main')));
  assert.equal(summary.resolvedWarnings.length, 0);
  assert.match(summary.recommendedNextAction, /repository changes/);
});

test('change summary detects disk threshold crossed', () => {
  const diskHigh = event({
    type: 'disk',
    summary: 'root disk usage is 93%.',
    fingerprint: 'disk:root:high'
  });
  const summary = buildOperatorChangesSummary({
    events: [diskHigh],
    currentBrief: { ...quietBrief, health: 'warning', risks: ['root disk usage is high.'] },
    currentEvents: [current(diskHigh)],
    now
  });

  assert(summary.newWarnings.some((warning) => warning.includes('root disk usage')));
  assert.equal(summary.recommendedNextAction, 'Review disk usage and safe cleanup options on the VPS.');
});

test('change summary detects PM2 issue appeared', () => {
  const pm2Stopped = event({
    type: 'pm2',
    summary: 'gameops-api is stopped in PM2.',
    fingerprint: 'pm2:process:gameops-api:stopped'
  });
  const summary = buildOperatorChangesSummary({
    events: [pm2Stopped],
    currentBrief: { ...quietBrief, health: 'warning', risks: ['gameops-api is stopped.'] },
    currentEvents: [current(pm2Stopped)],
    now
  });

  assert(summary.newWarnings.some((warning) => warning.includes('gameops-api is stopped')));
  assert.equal(summary.recommendedNextAction, 'Review PM2 service state from the VPS before manual action.');
});

test('change summary reports resolved warning', () => {
  const oldDiskHigh = event({
    type: 'disk',
    summary: 'root disk usage is 93%.',
    fingerprint: 'disk:root:high'
  });
  const summary = buildOperatorChangesSummary({
    events: [oldDiskHigh],
    currentBrief: quietBrief,
    currentEvents: [],
    now
  });

  assert.deepEqual(summary.newWarnings, []);
  assert(summary.resolvedWarnings.some((warning) => warning.includes('root disk usage')));
  assert.equal(summary.recommendedNextAction, 'Confirm the resolved warning remains stable on the next refresh.');
});

test('change summary handles mixed changes', () => {
  const gitDirty = event({
    type: 'git',
    summary: 'GameOps Bridge is dirty on main with 2 modified and 1 untracked files.',
    fingerprint: 'git:gameops:dirty'
  });
  const diskResolved = event({
    type: 'disk',
    summary: 'root disk usage is 93%.',
    fingerprint: 'disk:root:high'
  });
  const pm2Stopped = event({
    type: 'pm2',
    summary: 'gameops-api is stopped in PM2.',
    fingerprint: 'pm2:process:gameops-api:stopped'
  });
  const summary = buildOperatorChangesSummary({
    events: [gitDirty, diskResolved, pm2Stopped],
    currentBrief: { ...quietBrief, health: 'warning', risks: ['Git and PM2 warnings active.'] },
    currentEvents: [current(gitDirty), current(pm2Stopped)],
    now
  });

  assert.equal(summary.confidence, 'high');
  assert.equal(summary.newWarnings.length, 2);
  assert.equal(summary.resolvedWarnings.length, 1);
  assert(summary.meaningfulChanges.length <= 5);
  assert(summary.unchangedSignals.some((signal) => signal.includes('Disk has no active warning')));
});

