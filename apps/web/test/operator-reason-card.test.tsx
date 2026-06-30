import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperatorReasonResponse } from '@gameops/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OperatorReasonCard, runOperatorAnalysis } from '../src/operator-reason-card.tsx';

const codexResult: OperatorReasonResponse = {
  generatedAt: '2026-06-30T12:00:00.000Z',
  readOnly: true,
  engine: 'codex',
  question: 'analyze-current-context',
  answerHeadline: 'Codex identified one deployment confidence item.',
  answerBullets: ['Review the dirty repository before deploying.'],
  evidence: [{
    source: 'git',
    detail: 'GameOps Bridge has local changes.'
  }],
  limitations: ['Read-only analysis only.'],
  recommendedNextActions: ['Review repository changes before pulling updates.'],
  confidence: 'medium'
};

const placeholderResult: OperatorReasonResponse = {
  ...codexResult,
  engine: 'placeholder',
  answerHeadline: 'Placeholder analysis identified read-only operator focus areas.'
};

test('renders operator reason card idle state', () => {
  const html = renderToStaticMarkup(
    <OperatorReasonCard apiBaseUrl="http://localhost:3001" />
  );

  assert.match(html, /Run Operator Analysis/);
  assert.match(html, /Run Analysis/);
  assert.match(html, /read-only/);
  assert.doesNotMatch(html, /GAMEOPS_OPERATOR_KEY/);
});

test('renders operator reason card loading state', () => {
  const html = renderToStaticMarkup(
    <OperatorReasonCard apiBaseUrl="http://localhost:3001" initialLoading />
  );

  assert.match(html, /Running\.\.\./);
  assert.match(html, /Running read-only operator analysis/);
});

test('renders operator reason card error state', () => {
  const html = renderToStaticMarkup(
    <OperatorReasonCard apiBaseUrl="http://localhost:3001" initialError="Operator analysis unavailable" />
  );

  assert.match(html, /Operator analysis unavailable/);
  assert.match(html, /Read-only reasoning is not available/);
  assert.doesNotMatch(html, /stack/i);
});

test('renders codex reasoning result badge', () => {
  const html = renderToStaticMarkup(
    <OperatorReasonCard apiBaseUrl="http://localhost:3001" initialResult={codexResult} />
  );

  assert.match(html, /Codex reasoning/);
  assert.match(html, /Codex identified one deployment confidence item/);
  assert.match(html, /Review the dirty repository/);
  assert.match(html, /Recommended Next Actions/);
  assert.doesNotMatch(html, /GAMEOPS_OPERATOR_KEY/);
});

test('renders placeholder fallback note', () => {
  const html = renderToStaticMarkup(
    <OperatorReasonCard apiBaseUrl="http://localhost:3001" initialResult={placeholderResult} />
  );

  assert.match(html, /Safe fallback analysis/);
  assert.match(html, /Codex reasoning was unavailable/);
  assert.doesNotMatch(html, /Codex reasoning<\/span>/);
});

test('submits operator analysis through safe endpoint only', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const response = await runOperatorAnalysis({
    apiBaseUrl: 'http://localhost:3001',
    reasonFetch: async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify(codexResult), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      });
    }
  });

  assert.equal(response.engine, 'codex');
  assert.equal(calls.length, 1);
  assert.equal(String(calls[0]?.input), 'http://localhost:3001/api/dashboard/operator/reason');
  assert.equal(calls[0]?.init?.method, 'POST');
  assert.equal(calls[0]?.init?.body, JSON.stringify({ request: 'analyze-current-context' }));
  assert(!JSON.stringify(calls[0]?.init).includes('GAMEOPS_OPERATOR_KEY'));
  assert(!JSON.stringify(calls[0]?.init).includes('x-gameops-operator-key'));
});
