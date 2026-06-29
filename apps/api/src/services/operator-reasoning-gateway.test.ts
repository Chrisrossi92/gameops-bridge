import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperatorContextPackResponse } from '@gameops/shared';
import { buildOperatorReasoningResponse } from './operator-reasoning-gateway.js';

const generatedAt = '2026-06-29T12:00:00.000Z';

function contextPack(overrides: Partial<OperatorContextPackResponse> = {}): OperatorContextPackResponse {
  return {
    generatedAt,
    readOnly: true,
    sections: [{
      title: 'Current operator brief',
      summary: 'Operator detected warnings.',
      bullets: ['GameOps Bridge has local changes.']
    }],
    evidence: [{
      source: 'brief',
      detail: '1 operator risk detected.'
    }],
    warnings: ['GameOps Bridge has local changes.'],
    recommendedFocus: ['Review repository state before deploying or pulling updates.'],
    redactionApplied: true,
    ...overrides
  };
}

test('reasoning gateway returns placeholder engine response', () => {
  const response = buildOperatorReasoningResponse({
    request: { request: 'analyze-current-context' },
    contextPack: contextPack(),
    generatedAt
  });

  assert.equal(response.generatedAt, generatedAt);
  assert.equal(response.readOnly, true);
  assert.equal(response.engine, 'placeholder');
  assert.equal(response.question, 'analyze-current-context');
  assert(response.answerHeadline.includes('Placeholder analysis'));
  assert(response.answerBullets.some((bullet) => bullet.includes('Top attention')));
  assert(response.limitations.some((limitation) => limitation.includes('no Codex call')));
});

test('reasoning gateway caps evidence', () => {
  const response = buildOperatorReasoningResponse({
    request: { request: 'analyze-current-context' },
    contextPack: contextPack({
      evidence: Array.from({ length: 20 }, (_, index) => ({
        source: `source-${index}`,
        detail: `Evidence item ${index}`
      }))
    }),
    generatedAt
  });

  assert.equal(response.evidence.length, 12);
});

test('reasoning gateway redacts secrets and excludes raw log detail', () => {
  const response = buildOperatorReasoningResponse({
    request: {
      request: 'analyze-current-context',
      question: 'DISCORD_TOKEN=super-secret-token-value should not leak'
    },
    contextPack: contextPack({
      warnings: ['Bearer super-secret-token-value should be redacted.'],
      evidence: [{
        source: 'logs',
        detail: 'DISCORD_TOKEN=super-secret-token-value raw log line'
      }]
    }),
    generatedAt
  });
  const serialized = JSON.stringify(response);

  assert(!serialized.includes('super-secret-token-value'));
  assert(!serialized.includes('DISCORD_TOKEN='));
  assert(serialized.includes('[REDACTED]'));
});

test('reasoning gateway handles empty context safely', () => {
  const response = buildOperatorReasoningResponse({
    request: { request: 'analyze-current-context' },
    contextPack: contextPack({
      sections: [{
        title: 'Recent timeline',
        summary: '0 recent timeline events included.',
        bullets: []
      }],
      evidence: [],
      warnings: [],
      recommendedFocus: []
    }),
    generatedAt
  });

  assert.equal(response.confidence, 'low');
  assert(response.answerBullets.some((bullet) => bullet.includes('no active warning')));
  assert.deepEqual(response.recommendedNextActions, []);
});
