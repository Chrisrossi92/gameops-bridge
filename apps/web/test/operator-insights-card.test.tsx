import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperatorInsightsResponse } from '@gameops/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OperatorInsightsCard } from '../src/operator-insights-card.tsx';

const insights: OperatorInsightsResponse = {
  generatedAt: '2026-06-29T12:00:00.000Z',
  readOnly: true,
  insights: [{
    title: 'I noticed repeated PM2 warnings',
    summary: 'PM2 has produced repeated warning events in the recent operator timeline.',
    severity: 'warning',
    confidence: 'high',
    evidence: ['gameops-api is stopped in PM2.'],
    recommendedAction: 'Review PM2 service state from the VPS before manual action.'
  }]
};

test('renders operator insights', () => {
  const html = renderToStaticMarkup(
    <OperatorInsightsCard insights={insights} loading={false} error={null} />
  );

  assert.match(html, /Operator Insights/);
  assert.match(html, /I noticed/);
  assert.match(html, /repeated PM2 warnings/);
  assert.match(html, /gameops-api is stopped/);
  assert.match(html, /Review PM2 service state/);
});

test('renders operator insights unavailable state', () => {
  const html = renderToStaticMarkup(
    <OperatorInsightsCard insights={null} loading={false} error="Insights unavailable" />
  );

  assert.match(html, /Insights unavailable/);
  assert.doesNotMatch(html, /stack/i);
});

