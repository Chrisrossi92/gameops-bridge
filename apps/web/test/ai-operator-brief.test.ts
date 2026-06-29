import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperatorBriefResponse } from '@gameops/shared';
import {
  deriveOperatorSignals,
  groupOperatorEvents,
  isImportantOperatorRecommendation
} from '../src/ai-operator-brief.ts';

const baseBrief: OperatorBriefResponse = {
  generatedAt: '2026-06-29T12:00:00.000Z',
  readOnly: true,
  health: 'warning',
  summary: '2 operator risks detected. PM2 available; 0 disk warnings; 1 dirty repo; 0 health warnings.',
  risks: [],
  recentEvents: [
    'PM2 reports 4 processes.',
    'Disk: Root filesystem is 62% used.',
    'Git checks: 1 repo configured.',
    'GameOps Bridge is dirty on main -> origin/main, 0 ahead/1 behind, 0 staged/2 modified/1 untracked, last abcdef123456.',
    '1 configured log source unavailable.',
    'Local API health check is ok.'
  ],
  recommendations: [
    'Pull only after local repo changes are reviewed.',
    'Classify untracked files before cleanup.'
  ]
};

test('groups operator events by signal type', () => {
  const groups = groupOperatorEvents(baseBrief.recentEvents);

  assert.deepEqual(groups.map((group) => group.key), ['pm2', 'disk', 'git', 'logs', 'health']);
  assert.equal(groups.find((group) => group.key === 'git')?.events.length, 2);
});

test('derives signal statuses from brief text', () => {
  const signals = deriveOperatorSignals(baseBrief);

  assert.equal(signals.find((signal) => signal.key === 'pm2')?.status, 'OK');
  assert.equal(signals.find((signal) => signal.key === 'git')?.status, 'Warning');
  assert.equal(signals.find((signal) => signal.key === 'logs')?.status, 'Unavailable');
  assert.equal(signals.find((signal) => signal.key === 'health')?.status, 'Warning');
});

test('marks important recommendations', () => {
  assert.equal(isImportantOperatorRecommendation('Pull only after local repo changes are reviewed.'), true);
  assert.equal(isImportantOperatorRecommendation('No immediate server action is indicated.'), false);
});

test('derives unavailable state for missing PM2 and unknown health', () => {
  const signals = deriveOperatorSignals({
    ...baseBrief,
    health: 'unknown',
    summary: 'PM2 unavailable; no repo checks.',
    recentEvents: ['PM2 status is not available to the read-only collector.'],
    recommendations: []
  });

  assert.equal(signals.find((signal) => signal.key === 'pm2')?.status, 'Unavailable');
  assert.equal(signals.find((signal) => signal.key === 'health')?.status, 'Unavailable');
});
