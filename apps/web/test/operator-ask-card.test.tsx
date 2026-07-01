import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperatorAskResponse } from '@gameops/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { askOperatorQuestion, OperatorAskCard } from '../src/operator-ask-card.tsx';

const answer: OperatorAskResponse = {
  question: 'what changed?',
  intent: 'changes',
  headline: '1 active warning changed in the last 24 hours.',
  bullets: ['GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'],
  confidence: 'medium',
  source: 'changes',
  readOnly: true
};

test('renders ask operator card', () => {
  const html = renderToStaticMarkup(
    <OperatorAskCard apiBaseUrl="http://localhost:3001" />
  );

  assert.match(html, /Ask Operator/);
  assert.match(html, /Ask a read-only question/);
  assert.match(html, /What changed/);
  assert.match(html, /Current health/);
});

test('submits ask operator question through safe endpoint', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const response = await askOperatorQuestion({
    apiBaseUrl: 'http://localhost:3001',
    question: 'what changed?',
    askFetch: async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify(answer), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      });
    }
  });

  assert.equal(response.intent, 'changes');
  assert.equal(response.source, 'changes');
  assert.equal(calls.length, 1);
  assert.equal(String(calls[0]?.input), 'http://localhost:3001/api/dashboard/operator/ask');
  assert.equal(calls[0]?.init?.method, 'POST');
  assert(!JSON.stringify(calls[0]?.init).includes('GAMEOPS_OPERATOR_KEY'));
});

