import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  OperatorBrief,
  OperatorChangesSummary,
  OperatorDailyBrief,
  OperatorInsightsResponse,
  OperatorTimelineEvent
} from '@gameops/shared';
import { answerOperatorQuestion, classifyOperatorQuestion } from './operator-ask.js';

const generatedAt = '2026-06-29T12:00:00.000Z';

const brief: OperatorBrief = {
  generatedAt,
  readOnly: true,
  health: 'warning',
  summary: '1 operator risk detected. PM2 available; 0 disk warnings; 1 dirty repo; 0 health warnings.',
  risks: ['GameOps Bridge has local changes.'],
  recentEvents: ['PM2 reports 4 processes.'],
  recommendations: ['Review repository state before deploying or pulling updates.']
};

const dailyBrief: OperatorDailyBrief = {
  generatedAt,
  readOnly: true,
  range: {
    from: '2026-06-28T12:00:00.000Z',
    to: generatedAt
  },
  headline: '1 warning signal observed in the last 24 hours.',
  healthSummary: 'Last 24 hours: 1 event, 1 warning, 0 critical across git.',
  keyChanges: ['GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'],
  warnings: ['GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'],
  recommendations: ['Review local repository changes before deploy or pull.'],
  confidence: 'medium'
};

const changes: OperatorChangesSummary = {
  generatedAt,
  readOnly: true,
  range: dailyBrief.range,
  headline: '1 active warning changed in the last 24 hours.',
  meaningfulChanges: ['GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'],
  unchangedSignals: ['Disk has no active warning in the current operator snapshot.'],
  newWarnings: ['GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'],
  resolvedWarnings: [],
  recommendedNextAction: 'Review local repository changes before deploy or pull.',
  confidence: 'medium'
};

const insights: OperatorInsightsResponse = {
  generatedAt,
  readOnly: true,
  insights: [{
    title: 'I noticed a repo with local changes',
    summary: 'A configured repository appears dirty and should be reviewed before deployment.',
    severity: 'warning',
    confidence: 'medium',
    evidence: ['GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'],
    recommendedAction: 'Review local repository changes before deploy or pull.'
  }]
};

const timelineEvents: OperatorTimelineEvent[] = [{
  id: 'event-1',
  type: 'git',
  severity: 'warning',
  occurredAt: generatedAt,
  title: 'Repository has local changes',
  summary: 'GameOps Bridge is dirty on main with 2 modified and 1 untracked files.',
  fingerprint: 'git:gameops:dirty',
  metadata: {}
}];

function ask(question: string) {
  return answerOperatorQuestion({
    question,
    brief,
    dailyBrief,
    changes,
    insights,
    timelineEvents
  });
}

test('routes supported operator ask intents', () => {
  assert.equal(classifyOperatorQuestion('what changed?'), 'changes');
  assert.equal(classifyOperatorQuestion('what happened today?'), 'daily-brief');
  assert.equal(classifyOperatorQuestion('any insights?'), 'insights');
  assert.equal(classifyOperatorQuestion('show recent events'), 'timeline');
  assert.equal(classifyOperatorQuestion('current health'), 'current-state');
});

test('returns unsupported operator ask answer', () => {
  const response = ask('can you restart the service?');

  assert.equal(response.intent, 'unsupported');
  assert.match(response.headline, /I can answer questions/);
  assert.equal(response.readOnly, true);
});

test('returns daily brief operator ask answer', () => {
  const response = ask('daily brief');

  assert.equal(response.intent, 'daily-brief');
  assert.equal(response.source, 'daily-brief');
  assert.match(response.headline, /warning signal/);
  assert(response.bullets.some((bullet) => bullet.includes('Last 24 hours')));
});

test('returns changes operator ask answer', () => {
  const response = ask('what changed?');

  assert.equal(response.intent, 'changes');
  assert.equal(response.source, 'changes');
  assert.match(response.headline, /active warning/);
  assert(response.bullets.some((bullet) => bullet.includes('dirty on main')));
});

test('returns insights operator ask answer', () => {
  const response = ask('what should I know?');

  assert.equal(response.intent, 'insights');
  assert.equal(response.source, 'insights');
  assert.match(response.headline, /repo/);
  assert(response.bullets.some((bullet) => bullet.includes('reviewed before deployment')));
});

test('redacts operator ask answer evidence', () => {
  const response = answerOperatorQuestion({
    question: 'health',
    brief: {
      ...brief,
      risks: ['DISCORD_TOKEN=super-secret-token-value should be hidden.']
    },
    dailyBrief,
    changes,
    insights,
    timelineEvents
  });
  const serialized = JSON.stringify(response);

  assert(!serialized.includes('super-secret-token-value'));
  assert(serialized.includes('[REDACTED]'));
});

