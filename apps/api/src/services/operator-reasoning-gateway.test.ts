import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperatorContextPackResponse, OperatorReasonFallbackReasonCode } from '@gameops/shared';
import {
  buildOperatorReasoningResponse,
  getOperatorReasoningFallbackReason,
  getOperatorReasoningStatus,
  recordOperatorReasoningFallback,
  recordOperatorReasoningSuccess,
  resetOperatorReasoningDiagnostics
} from './operator-reasoning-gateway.js';

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
  resetOperatorReasoningDiagnostics();
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
  assert.equal(getOperatorReasoningStatus().lastReasonCode, 'CODEX_DISABLED');
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

test('reasoning gateway classifies disabled and unconfigured fallback states', () => {
  assert.equal(getOperatorReasoningFallbackReason({}), 'CODEX_DISABLED');
  assert.equal(getOperatorReasoningFallbackReason({ GAMEOPS_CODEX_REASONING_ENABLED: 'true' }), 'CODEX_NOT_CONFIGURED');
  assert.equal(getOperatorReasoningFallbackReason({
    GAMEOPS_CODEX_REASONING_ENABLED: 'true',
    GAMEOPS_CODEX_API_KEY: 'server-only-secret'
  }), 'CODEX_DISABLED');
});

test('reasoning diagnostics records every fallback reason code without leaking secrets', () => {
  resetOperatorReasoningDiagnostics();
  const reasonCodes: OperatorReasonFallbackReasonCode[] = [
    'CODEX_DISABLED',
    'CODEX_NOT_CONFIGURED',
    'CODEX_TIMEOUT',
    'CODEX_NON_2XX',
    'CODEX_INVALID_JSON',
    'CODEX_SCHEMA_INVALID',
    'CODEX_OUTPUT_TOO_LARGE',
    'CODEX_INPUT_TOO_LARGE',
    'CODEX_NETWORK_ERROR',
    'CODEX_RESPONSE_REDACTED',
    'CODEX_UNKNOWN_ERROR'
  ];
  const logs: Record<string, unknown>[] = [];
  const logger = {
    warn: (payload: Record<string, unknown>) => {
      logs.push(payload);
    }
  };

  reasonCodes.forEach((reasonCode, index) => {
    recordOperatorReasoningFallback(reasonCode, logger, new Date(Date.parse(generatedAt) + index));
    const status = getOperatorReasoningStatus({
      GAMEOPS_CODEX_REASONING_ENABLED: 'true',
      GAMEOPS_CODEX_API_KEY: 'server-only-secret',
      GAMEOPS_CODEX_MODEL: 'codex-test'
    });

    assert.equal(status.lastReasonCode, reasonCode);
    assert.equal(status.placeholderFallbackCount, index + 1);
    assert.equal(status.configured, true);
    assert.equal(status.model, 'codex-test');
  });

  const serializedLogs = JSON.stringify(logs);
  assert.equal(logs.length, reasonCodes.length);
  assert(!serializedLogs.includes('server-only-secret'));
  assert(!serializedLogs.includes('contextPack'));
  assert(!serializedLogs.includes('answerBullets'));
});

test('reasoning diagnostics success clears previous error state', () => {
  resetOperatorReasoningDiagnostics();
  recordOperatorReasoningFallback('CODEX_TIMEOUT', undefined, new Date(generatedAt));
  recordOperatorReasoningSuccess(new Date('2026-06-29T12:01:00.000Z'));
  const status = getOperatorReasoningStatus();

  assert.equal(status.lastReasonCode, null);
  assert.equal(status.lastAttemptAt, '2026-06-29T12:01:00.000Z');
  assert.equal(status.lastSuccessAt, '2026-06-29T12:01:00.000Z');
  assert.equal(status.placeholderFallbackCount, 1);
});
