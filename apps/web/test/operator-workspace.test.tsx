import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  OperatorBriefResponse,
  OperatorChangesSummaryResponse,
  OperatorDailyBriefResponse,
  OperatorInsightsResponse,
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

function workspaceHtml(overrides: Partial<React.ComponentProps<typeof OperatorWorkspace>> = {}): string {
  return renderToStaticMarkup(
    <OperatorWorkspace
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
      timelineEvents={timelineEvents}
      timelineLoading={false}
      timelineError={null}
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
  assert.match(html, /Today&#x27;s Brief/);
  assert.match(html, /What Changed/);
  assert.match(html, /Operator Insights/);
  assert.match(html, /Recent Timeline/);
  assert.match(html, /Signals \/ Current State/);
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
    timelineEvents: [],
    timelineError: 'Timeline unavailable'
  });

  assert.match(html, /Operator unavailable/);
  assert.match(html, /Daily brief unavailable/);
  assert.match(html, /Change summary unavailable/);
  assert.match(html, /Insights unavailable/);
  assert.match(html, /Timeline unavailable/);
  assert.doesNotMatch(html, /stack/i);
});
