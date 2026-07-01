import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  OperatorBriefResponse,
  OperatorChangesSummaryResponse,
  OperatorDailyBriefResponse,
  OperatorInsightsResponse,
  OperatorMemoryIndexResponse,
  OperatorTimelineEvent
} from '@gameops/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OperatorSummaryCard, OperatorWorkspace } from '../src/operator-workspace.tsx';

const brief: OperatorBriefResponse = {
  generatedAt: '2026-06-29T12:00:00.000Z',
  readOnly: true,
  health: 'warning',
  summary: '1 operator risk detected. PM2 available; 0 disk warnings; 1 dirty repo; 0 health warnings.',
  risks: ['GameOps Bridge has local changes.'],
  recentEvents: [
    'PM2 reports 4 processes.',
    'GameOps Bridge is dirty on main -> origin/main, 0 ahead/1 behind, 0 staged/2 modified/1 untracked, last abcdef123456.'
  ],
  recommendations: ['Review repository state before deploying or pulling updates.']
};

const dailyBrief: OperatorDailyBriefResponse = {
  generatedAt: brief.generatedAt,
  readOnly: true,
  range: {
    from: '2026-06-28T12:00:00.000Z',
    to: brief.generatedAt
  },
  headline: '1 warning signal observed in the last 24 hours.',
  healthSummary: 'Last 24 hours: 1 event, 1 warning, 0 critical across git.',
  keyChanges: ['GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'],
  warnings: ['GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'],
  recommendations: ['Review local repository changes before deploy or pull.'],
  confidence: 'medium'
};

const changes: OperatorChangesSummaryResponse = {
  generatedAt: brief.generatedAt,
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
  generatedAt: brief.generatedAt,
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
  occurredAt: brief.generatedAt,
  title: 'Repository has local changes',
  summary: 'GameOps Bridge is dirty on main with 2 modified and 1 untracked files.',
  fingerprint: 'git:gameops:dirty',
  metadata: {}
}];

const memoryIndex: OperatorMemoryIndexResponse = {
  generatedAt: brief.generatedAt,
  readOnly: true,
  range: {
    from: brief.generatedAt,
    to: brief.generatedAt
  },
  deployments: {
    count: 1,
    latestOccurrence: brief.generatedAt,
    activeState: 'observed',
    historicalSummary: 'Deployments: 1 event.',
    trend: 'recent',
    examples: ['Repository behind upstream.']
  },
  services: {
    count: 2,
    latestOccurrence: brief.generatedAt,
    activeState: 'attention',
    historicalSummary: 'Services: 2 events.',
    trend: 'stable',
    examples: ['PM2 process state changed.']
  },
  storage: {
    count: 0,
    latestOccurrence: null,
    activeState: 'quiet',
    historicalSummary: 'Storage: no timeline events recorded.',
    trend: 'quiet',
    examples: []
  },
  git: {
    count: 1,
    latestOccurrence: brief.generatedAt,
    activeState: 'attention',
    historicalSummary: 'Git: 1 event.',
    trend: 'recent',
    examples: ['Repository has local changes.']
  },
  recommendations: {
    count: 1,
    latestOccurrence: brief.generatedAt,
    activeState: 'attention',
    historicalSummary: 'Recommendations: 1 event.',
    trend: 'recent',
    examples: ['Review repository state.']
  },
  warnings: {
    count: 2,
    latestOccurrence: brief.generatedAt,
    activeState: 'attention',
    historicalSummary: 'Warnings: 2 events.',
    trend: 'stable',
    examples: ['Repository has local changes.']
  },
  health: {
    count: 0,
    latestOccurrence: null,
    activeState: 'quiet',
    historicalSummary: 'Health: no timeline events recorded.',
    trend: 'quiet',
    examples: []
  },
  timelineStatistics: {
    totalEvents: 5,
    warningEvents: 2,
    criticalEvents: 0,
    byType: { deployment: 1, pm2: 2, git: 1, operator: 1 },
    bySeverity: { info: 3, warning: 2 },
    firstEventAt: brief.generatedAt,
    lastEventAt: brief.generatedAt,
    historicalSummary: 'Timeline memory has 5 events, 2 warnings, and 0 critical events.',
    trend: 'stable'
  }
};

function workspaceHtml(overrides: Partial<React.ComponentProps<typeof OperatorWorkspace>> = {}): string {
  return renderToStaticMarkup(
    <OperatorWorkspace
      apiBaseUrl="http://localhost:3001"
      brief={brief}
      briefLoading={false}
      briefError={null}
      dailyBrief={dailyBrief}
      dailyBriefLoading={false}
      dailyBriefError={null}
      changes={changes}
      changesLoading={false}
      changesError={null}
      insights={insights}
      insightsLoading={false}
      insightsError={null}
      memoryIndex={memoryIndex}
      memoryIndexLoading={false}
      memoryIndexError={null}
      timelineEvents={timelineEvents}
      timelineLoading={false}
      timelineError={null}
      debugServers={[]}
      serverHealth={[]}
      {...overrides}
    />
  );
}

function findButton(element: React.ReactNode): React.ReactElement<{ onClick?: () => void }> | null {
  if (!React.isValidElement(element)) {
    return null;
  }

  if (element.type === 'button') {
    return element as React.ReactElement<{ onClick?: () => void }>;
  }

  const children = React.Children.toArray((element.props as { children?: React.ReactNode }).children);

  for (const child of children) {
    const found = findButton(child);
    if (found) {
      return found;
    }
  }

  return null;
}

test('main dashboard operator summary stays compact', () => {
  const html = renderToStaticMarkup(
    <OperatorSummaryCard brief={brief} loading={false} error={null} onOpen={() => undefined} />
  );

  assert.match(html, /AI Operator/);
  assert.match(html, /Open Operator/);
  assert.match(html, /1 operator risk/);
  assert.doesNotMatch(html, /Today&#x27;s Brief/);
  assert.doesNotMatch(html, /Recent Timeline/);
});

test('operator workspace renders full operator cards', () => {
  const html = workspaceHtml();

  assert.match(html, /AI Operator/);
  assert.match(html, /Ask Operator/);
  assert.match(html, /Run Operator Analysis/);
  assert.match(html, /Operational Memory/);
  assert.match(html, /repo status/);
  assert.match(html, /Today&#x27;s Brief/);
  assert.match(html, /What Changed/);
  assert.match(html, /Operator Insights/);
  assert.match(html, /Recent Timeline/);
  assert.match(html, /Signals \/ Current State/);
  assert.match(html, /Server Health/);
  assert.match(html, /Telemetry Pipeline/);
});

test('operator summary navigation callback works', () => {
  let opened = false;
  const element = OperatorSummaryCard({
    brief,
    loading: false,
    error: null,
    onOpen: () => { opened = true; }
  });
  const button = findButton(element);

  button?.props.onClick?.();

  assert.equal(opened, true);
});

test('operator workspace unavailable states render safely', () => {
  const html = workspaceHtml({
    brief: null,
    briefError: 'Operator unavailable',
    dailyBrief: null,
    dailyBriefError: 'Daily brief unavailable',
    changes: null,
    changesError: 'Change summary unavailable',
    insights: null,
    insightsError: 'Insights unavailable',
    memoryIndex: null,
    memoryIndexLoading: false,
    memoryIndexError: 'Operational memory unavailable',
    timelineEvents: [],
    timelineError: 'Timeline unavailable'
  });

  assert.match(html, /Operator unavailable/);
  assert.match(html, /Daily brief unavailable/);
  assert.match(html, /Change summary unavailable/);
  assert.match(html, /Insights unavailable/);
  assert.match(html, /Operational memory unavailable/);
  assert.match(html, /Timeline unavailable/);
  assert.doesNotMatch(html, /stack/i);
});
