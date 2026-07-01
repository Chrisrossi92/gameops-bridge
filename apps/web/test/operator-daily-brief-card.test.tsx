import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperatorDailyBriefResponse } from '@gameops/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OperatorDailyBriefCard } from '../src/operator-daily-brief-card.tsx';

const brief: OperatorDailyBriefResponse = {
  generatedAt: '2026-06-29T12:00:00.000Z',
  readOnly: true,
  range: {
    from: '2026-06-28T12:00:00.000Z',
    to: '2026-06-29T12:00:00.000Z'
  },
  headline: '2 warning signals observed in the last 24 hours.',
  healthSummary: 'Last 24 hours: 2 events, 2 warnings, 0 critical across git, disk.',
  keyChanges: [
    'GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'
  ],
  warnings: [
    'root disk usage is 93%.'
  ],
  recommendations: [
    'Review local repository changes before deploy or pull.'
  ],
  confidence: 'high'
};

test('renders operator daily brief summary', () => {
  const html = renderToStaticMarkup(
    <OperatorDailyBriefCard brief={brief} loading={false} error={null} />
  );

  assert.match(html, /Today/);
  assert.match(html, /2 warning signals/);
  assert.match(html, /Key Changes/);
  assert.match(html, /root disk usage/);
  assert.match(html, /High confidence/);
  assert.match(html, /Next recommended action/);
});

test('renders operator daily brief unavailable state', () => {
  const html = renderToStaticMarkup(
    <OperatorDailyBriefCard brief={null} loading={false} error="Daily brief unavailable" />
  );

  assert.match(html, /Daily brief unavailable/);
  assert.doesNotMatch(html, /stack/i);
});

test('renders operator daily brief quiet warning state', () => {
  const html = renderToStaticMarkup(
    <OperatorDailyBriefCard
      brief={{
        ...brief,
        warnings: [],
        recommendations: ['No immediate operator action is indicated from timeline events.'],
        confidence: 'low'
      }}
      loading={false}
      error={null}
    />
  );

  assert.match(html, /No warnings in the last 24 hours/);
  assert.match(html, /Low confidence/);
});

