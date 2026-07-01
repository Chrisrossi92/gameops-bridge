import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperatorChangesSummaryResponse } from '@gameops/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OperatorChangesCard } from '../src/operator-changes-card.tsx';

const changes: OperatorChangesSummaryResponse = {
  generatedAt: '2026-06-29T12:00:00.000Z',
  readOnly: true,
  range: {
    from: '2026-06-28T12:00:00.000Z',
    to: '2026-06-29T12:00:00.000Z'
  },
  headline: '2 active warnings changed in the last 24 hours.',
  meaningfulChanges: [
    'GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'
  ],
  unchangedSignals: [
    'Disk has no active warning in the current operator snapshot.'
  ],
  newWarnings: [
    'gameops-api is stopped in PM2.'
  ],
  resolvedWarnings: [
    'root disk usage is 93%.'
  ],
  recommendedNextAction: 'Review PM2 service state from the VPS before manual action.',
  confidence: 'high'
};

test('renders operator changes summary', () => {
  const html = renderToStaticMarkup(
    <OperatorChangesCard changes={changes} loading={false} error={null} />
  );

  assert.match(html, /What Changed/);
  assert.match(html, /2 active warnings/);
  assert.match(html, /Meaningful Changes/);
  assert.match(html, /gameops-api is stopped/);
  assert.match(html, /root disk usage/);
  assert.match(html, /High confidence/);
});

test('renders operator changes unavailable state', () => {
  const html = renderToStaticMarkup(
    <OperatorChangesCard changes={null} loading={false} error="Change summary unavailable" />
  );

  assert.match(html, /Change summary unavailable/);
  assert.doesNotMatch(html, /stack/i);
});

test('renders operator changes quiet state', () => {
  const html = renderToStaticMarkup(
    <OperatorChangesCard
      changes={{
        ...changes,
        newWarnings: [],
        resolvedWarnings: [],
        meaningfulChanges: ['No meaningful timeline changes recorded.'],
        recommendedNextAction: 'No immediate operator action is indicated from read-only signals.',
        confidence: 'low'
      }}
      loading={false}
      error={null}
    />
  );

  assert.match(html, /No new active warnings/);
  assert.match(html, /No recently resolved warnings/);
  assert.match(html, /Low confidence/);
});

