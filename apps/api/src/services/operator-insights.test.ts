import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  OperatorBrief,
  OperatorChangesSummary,
  OperatorDailyBrief,
  OperatorTimelineEvent
} from '@gameops/shared';
import { buildOperatorInsights } from './operator-insights.js';

const now = new Date('2026-06-29T12:00:00.000Z');

const quietBrief: OperatorBrief = {
  generatedAt: now.toISOString(),
  readOnly: true,
  health: 'ok',
  summary: 'Server health stable. PM2 available; 1 disk check; 1 repo check; 0 health warnings.',
  risks: [],
  recentEvents: [],
  recommendations: ['No immediate server action is indicated from read-only signals.']
};

const quietDailyBrief: OperatorDailyBrief = {
  generatedAt: now.toISOString(),
  readOnly: true,
  range: {
    from: '2026-06-28T12:00:00.000Z',
    to: now.toISOString()
  },
  headline: 'Operator timeline is quiet for the last 24 hours.',
  healthSummary: 'Last 24 hours: 1 event, 0 warnings, 0 critical across operator.',
  keyChanges: ['No key operational changes recorded.'],
  warnings: [],
  recommendations: ['No immediate operator action is indicated from timeline events.'],
  confidence: 'medium'
};

const quietChanges: OperatorChangesSummary = {
  generatedAt: now.toISOString(),
  readOnly: true,
  range: {
    from: '2026-06-28T12:00:00.000Z',
    to: now.toISOString()
  },
  headline: 'No meaningful operator changes in the last 24 hours.',
  meaningfulChanges: ['No meaningful timeline changes recorded.'],
  unchangedSignals: [
    'Current operator brief reports no active risks.',
    'Git has no active warning in the current operator snapshot.',
    'Disk has no active warning in the current operator snapshot.'
  ],
  newWarnings: [],
  resolvedWarnings: [],
  recommendedNextAction: 'No immediate operator action is indicated from read-only signals.',
  confidence: 'low'
};

function timelineEvent(input: Partial<OperatorTimelineEvent> & Pick<OperatorTimelineEvent, 'type' | 'summary' | 'fingerprint'>): OperatorTimelineEvent {
  return {
    id: input.id ?? input.fingerprint,
    severity: input.severity ?? 'warning',
    occurredAt: input.occurredAt ?? '2026-06-29T11:00:00.000Z',
    title: input.title ?? 'Operator event',
    metadata: input.metadata ?? {},
    ...input
  };
}

test('builds dirty repo insight for larger change set', () => {
  const response = buildOperatorInsights({
    brief: {
      ...quietBrief,
      health: 'warning',
      risks: ['GameOps Bridge has 9 uncommitted file changes.'],
      recentEvents: ['GameOps Bridge is dirty on main with 6 modified and 3 untracked files.']
    },
    dailyBrief: {
      ...quietDailyBrief,
      keyChanges: ['GameOps Bridge is dirty on main with 6 modified and 3 untracked files.']
    },
    changes: {
      ...quietChanges,
      newWarnings: ['GameOps Bridge is dirty on main with 6 modified and 3 untracked files.']
    },
    timelineEvents: [],
    now
  });

  assert(response.insights.some((insight) => insight.title.includes('repo') && insight.severity === 'warning'));
  assert(response.insights.some((insight) => insight.recommendedAction?.includes('repository changes')));
});

test('builds disk usage insight above 80 percent', () => {
  const response = buildOperatorInsights({
    brief: {
      ...quietBrief,
      health: 'warning',
      risks: ['root disk usage is 83%.']
    },
    dailyBrief: {
      ...quietDailyBrief,
      warnings: ['root disk usage is 83%.']
    },
    changes: quietChanges,
    timelineEvents: [],
    now
  });

  assert(response.insights.some((insight) => insight.title.includes('disk usage') && insight.severity === 'info'));
  assert(response.insights.some((insight) => insight.evidence.some((item) => item.includes('83%'))));
});

test('builds repeated PM2 insight', () => {
  const response = buildOperatorInsights({
    brief: quietBrief,
    dailyBrief: quietDailyBrief,
    changes: quietChanges,
    timelineEvents: [
      timelineEvent({
        type: 'pm2',
        summary: 'gameops-api is stopped in PM2.',
        fingerprint: 'pm2:gameops-api:stopped'
      }),
      timelineEvent({
        type: 'pm2',
        summary: 'gameops-api is stopped in PM2.',
        fingerprint: 'pm2:gameops-api:stopped-2'
      })
    ],
    now
  });

  assert(response.insights.some((insight) => insight.title.includes('PM2') && insight.confidence === 'medium'));
});

test('builds stable no-action insight', () => {
  const response = buildOperatorInsights({
    brief: quietBrief,
    dailyBrief: quietDailyBrief,
    changes: quietChanges,
    timelineEvents: [],
    now
  });

  assert.equal(response.insights[0]?.severity, 'info');
  assert.match(response.insights[0]?.summary ?? '', /stable/);
  assert.match(response.insights[0]?.recommendedAction ?? '', /No immediate/);
});

test('redacts insight evidence', () => {
  const response = buildOperatorInsights({
    brief: {
      ...quietBrief,
      health: 'warning',
      risks: ['DISCORD_TOKEN=super-secret-token-value disk usage is 83%.']
    },
    dailyBrief: {
      ...quietDailyBrief,
      warnings: ['DISCORD_TOKEN=super-secret-token-value disk usage is 83%.']
    },
    changes: quietChanges,
    timelineEvents: [],
    now
  });
  const serialized = JSON.stringify(response);

  assert(!serialized.includes('super-secret-token-value'));
  assert(serialized.includes('[REDACTED]'));
});

test('builds resolved warning and activity spike insights', () => {
  const response = buildOperatorInsights({
    brief: quietBrief,
    dailyBrief: quietDailyBrief,
    changes: {
      ...quietChanges,
      resolvedWarnings: ['root disk usage is 93%.'],
      confidence: 'high'
    },
    timelineEvents: Array.from({ length: 10 }, (_, index) => timelineEvent({
      type: index % 2 === 0 ? 'disk' : 'operator',
      severity: index % 2 === 0 ? 'warning' : 'info',
      summary: `Timeline event ${index}`,
      fingerprint: `timeline:${index}`
    })),
    now
  });

  assert(response.insights.some((insight) => insight.title.includes('warning may have cleared')));
  assert(response.insights.some((insight) => insight.title.includes('timeline activity')));
});

