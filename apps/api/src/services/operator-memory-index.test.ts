import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperatorTimelineEvent } from '@gameops/shared';
import { buildOperatorMemoryIndex } from './operator-memory-index.js';

const baseTime = '2026-06-29T12:00:00.000Z';

function event(input: Partial<OperatorTimelineEvent> & Pick<OperatorTimelineEvent, 'type' | 'title' | 'summary' | 'fingerprint'>): OperatorTimelineEvent {
  return {
    id: input.id ?? `${input.type}:${input.fingerprint}`,
    type: input.type,
    severity: input.severity ?? 'info',
    occurredAt: input.occurredAt ?? baseTime,
    title: input.title,
    summary: input.summary,
    fingerprint: input.fingerprint,
    metadata: input.metadata ?? {}
  };
}

test('memory index handles empty timeline', () => {
  const index = buildOperatorMemoryIndex({ events: [], generatedAt: baseTime });

  assert.equal(index.readOnly, true);
  assert.equal(index.timelineStatistics.totalEvents, 0);
  assert.equal(index.timelineStatistics.trend, 'quiet');
  assert.equal(index.git.activeState, 'quiet');
});

test('memory index aggregates deployment counts', () => {
  const index = buildOperatorMemoryIndex({
    events: [
      event({ type: 'deployment', title: 'Repository behind upstream', summary: 'API is 1 commit behind.', fingerprint: 'deploy:behind' }),
      event({ type: 'deployment', title: 'Repository behind upstream', summary: 'Web is 2 commits behind.', fingerprint: 'deploy:behind:web' })
    ],
    generatedAt: baseTime
  });

  assert.equal(index.deployments.count, 2);
  assert.match(index.deployments.historicalSummary, /2 events/);
});

test('memory index aggregates service restart counts', () => {
  const index = buildOperatorMemoryIndex({
    events: [
      event({ type: 'pm2', severity: 'warning', title: 'PM2 process state changed', summary: 'gameops-api restarted.', fingerprint: 'pm2:api:restart' }),
      event({ type: 'pm2', severity: 'warning', title: 'PM2 process state changed', summary: 'gameops-dashboard restarted.', fingerprint: 'pm2:web:restart' })
    ],
    generatedAt: baseTime
  });

  assert.equal(index.services.count, 2);
  assert.equal(index.services.activeState, 'attention');
});

test('memory index rolls up recommendations', () => {
  const index = buildOperatorMemoryIndex({
    events: [
      event({ type: 'operator', severity: 'warning', title: 'Operator recommendation generated', summary: 'Review local changes before deploy.', fingerprint: 'operator:review' })
    ],
    generatedAt: baseTime
  });

  assert.equal(index.recommendations.count, 1);
  assert.match(index.recommendations.examples[0] ?? '', /Review local changes/);
});

test('memory index generates increasing trend when recent warnings rise', () => {
  const index = buildOperatorMemoryIndex({
    events: [
      event({ type: 'git', severity: 'info', occurredAt: '2026-06-29T09:00:00.000Z', title: 'Git clean', summary: 'Repo clean.', fingerprint: 'git:clean' }),
      event({ type: 'disk', severity: 'warning', occurredAt: '2026-06-29T10:00:00.000Z', title: 'Disk usage high', summary: 'Disk at 91%.', fingerprint: 'disk:high' }),
      event({ type: 'pm2', severity: 'warning', occurredAt: '2026-06-29T11:00:00.000Z', title: 'PM2 process state changed', summary: 'API stopped.', fingerprint: 'pm2:api' }),
      event({ type: 'git', severity: 'critical', occurredAt: '2026-06-29T12:00:00.000Z', title: 'Repository unavailable', summary: 'Repo missing.', fingerprint: 'git:missing' })
    ],
    generatedAt: baseTime
  });

  assert.equal(index.timelineStatistics.trend, 'increasing');
  assert.equal(index.warnings.trend, 'increasing');
});

test('memory index redacts secret-like examples', () => {
  const index = buildOperatorMemoryIndex({
    events: [
      event({
        type: 'operator',
        severity: 'warning',
        title: 'Operator recommendation generated',
        summary: 'Check DISCORD_TOKEN=super-secret-token-value',
        fingerprint: 'operator:secret'
      })
    ],
    generatedAt: baseTime
  });
  const serialized = JSON.stringify(index);

  assert(!serialized.includes('super-secret-token-value'));
  assert(serialized.includes('[REDACTED]'));
});
