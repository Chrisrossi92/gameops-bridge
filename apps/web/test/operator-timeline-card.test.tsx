import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperatorTimelineEvent } from '@gameops/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OperatorTimelineCard } from '../src/operator-timeline-card.tsx';

const gitEvent: OperatorTimelineEvent = {
  id: 'event-1',
  type: 'git',
  severity: 'warning',
  occurredAt: '2026-06-29T12:00:00.000Z',
  title: 'Repository has local changes',
  summary: 'GameOps Bridge is dirty on main with 2 modified and 1 untracked files.',
  fingerprint: 'git:gameops:dirty',
  metadata: {}
};

test('renders recent operator timeline events', () => {
  const html = renderToStaticMarkup(
    <OperatorTimelineCard events={[gitEvent]} loading={false} error={null} />
  );

  assert.match(html, /Recent Timeline/);
  assert.match(html, /Repository has local changes/);
  assert.match(html, /GameOps Bridge is dirty/);
  assert.match(html, /read-only/);
});

test('renders operator timeline unavailable state', () => {
  const html = renderToStaticMarkup(
    <OperatorTimelineCard events={[]} loading={false} error="Timeline unavailable" />
  );

  assert.match(html, /Timeline unavailable/);
  assert.doesNotMatch(html, /stack/i);
});

test('renders empty operator timeline state', () => {
  const html = renderToStaticMarkup(
    <OperatorTimelineCard events={[]} loading={false} error={null} />
  );

  assert.match(html, /No operator timeline events recorded yet/);
});
