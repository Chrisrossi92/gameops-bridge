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
type MockFetcher = NonNullable<Parameters<typeof buildOperatorReasoningResponse>[0]['fetcher']>;

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

function codexJsonResponse(output: unknown): Awaited<ReturnType<MockFetcher>> {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      output_text: typeof output === 'string' ? output : JSON.stringify(output)
    })
  };
}

function codexPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    answerHeadline: 'Codex identified one deployment confidence item.',
    answerBullets: [
      'Review the dirty repository before deploying.',
      'Disk and PM2 signals do not require action.'
    ],
    evidence: [{
      source: 'git',
      detail: 'GameOps Bridge has local changes.'
    }],
    limitations: [
      'Read-only analysis only.',
      'No commands were executed.'
    ],
    recommendedNextActions: [
      'Review repository changes before pulling updates.'
    ],
    confidence: 'medium',
    ...overrides
  };
}

test('reasoning gateway returns placeholder engine response', async () => {
  resetOperatorReasoningDiagnostics();
  const response = await buildOperatorReasoningResponse({
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
  assert(response.limitations.some((limitation) => limitation.includes('Placeholder mode')));
  assert.equal(getOperatorReasoningStatus().lastReasonCode, 'CODEX_DISABLED');
});

test('reasoning gateway returns validated Codex engine response when enabled and configured', async () => {
  resetOperatorReasoningDiagnostics();
  const response = await buildOperatorReasoningResponse({
    request: { request: 'analyze-current-context' },
    contextPack: contextPack(),
    generatedAt,
    env: {
      GAMEOPS_CODEX_REASONING_ENABLED: 'true',
      GAMEOPS_CODEX_API_KEY: 'server-only-secret',
      GAMEOPS_CODEX_MODEL: 'codex-test'
    },
    fetcher: async () => codexJsonResponse(codexPayload())
  });
  const status = getOperatorReasoningStatus({
    GAMEOPS_CODEX_REASONING_ENABLED: 'true',
    GAMEOPS_CODEX_API_KEY: 'server-only-secret',
    GAMEOPS_CODEX_MODEL: 'codex-test'
  });
  const serialized = JSON.stringify(response);

  assert.equal(response.generatedAt, generatedAt);
  assert.equal(response.readOnly, true);
  assert.equal(response.engine, 'codex');
  assert.equal(response.answerHeadline, 'Codex identified one deployment confidence item.');
  assert.equal(status.lastReasonCode, null);
  assert.equal(status.lastAttemptAt, status.lastSuccessAt);
  assert.equal(status.placeholderFallbackCount, 0);
  assert(!serialized.includes('server-only-secret'));
});

test('reasoning gateway caps evidence', async () => {
  const response = await buildOperatorReasoningResponse({
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

test('reasoning gateway redacts secrets and excludes raw log detail', async () => {
  const response = await buildOperatorReasoningResponse({
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

test('reasoning gateway handles empty context safely', async () => {
  const response = await buildOperatorReasoningResponse({
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
  }), null);
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

test('reasoning gateway fallback paths record exact reason codes', async () => {
  const cases: Array<{
    name: string;
    expected: OperatorReasonFallbackReasonCode;
    env?: NodeJS.ProcessEnv;
    fetcher?: MockFetcher;
  }> = [
    {
      name: 'disabled',
      expected: 'CODEX_DISABLED',
      env: {}
    },
    {
      name: 'not configured',
      expected: 'CODEX_NOT_CONFIGURED',
      env: { GAMEOPS_CODEX_REASONING_ENABLED: 'true' }
    },
    {
      name: 'input too large',
      expected: 'CODEX_INPUT_TOO_LARGE',
      env: {
        GAMEOPS_CODEX_REASONING_ENABLED: 'true',
        GAMEOPS_CODEX_API_KEY: 'server-only-secret',
        GAMEOPS_CODEX_INPUT_MAX_BYTES: '10'
      },
      fetcher: async () => codexJsonResponse(codexPayload())
    },
    {
      name: 'timeout',
      expected: 'CODEX_TIMEOUT',
      env: {
        GAMEOPS_CODEX_REASONING_ENABLED: 'true',
        GAMEOPS_CODEX_API_KEY: 'server-only-secret'
      },
      fetcher: async () => {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      }
    },
    {
      name: 'non 2xx',
      expected: 'CODEX_NON_2XX',
      env: {
        GAMEOPS_CODEX_REASONING_ENABLED: 'true',
        GAMEOPS_CODEX_API_KEY: 'server-only-secret'
      },
      fetcher: async () => ({
        ok: false,
        status: 500,
        json: async () => ({})
      })
    },
    {
      name: 'invalid response json',
      expected: 'CODEX_INVALID_JSON',
      env: {
        GAMEOPS_CODEX_REASONING_ENABLED: 'true',
        GAMEOPS_CODEX_API_KEY: 'server-only-secret'
      },
      fetcher: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('bad json');
        }
      })
    },
    {
      name: 'schema invalid',
      expected: 'CODEX_SCHEMA_INVALID',
      env: {
        GAMEOPS_CODEX_REASONING_ENABLED: 'true',
        GAMEOPS_CODEX_API_KEY: 'server-only-secret'
      },
      fetcher: async () => codexJsonResponse({ answerHeadline: 'missing required fields' })
    },
    {
      name: 'output too large',
      expected: 'CODEX_OUTPUT_TOO_LARGE',
      env: {
        GAMEOPS_CODEX_REASONING_ENABLED: 'true',
        GAMEOPS_CODEX_API_KEY: 'server-only-secret',
        GAMEOPS_CODEX_OUTPUT_MAX_BYTES: '10'
      },
      fetcher: async () => codexJsonResponse(codexPayload())
    },
    {
      name: 'network error',
      expected: 'CODEX_NETWORK_ERROR',
      env: {
        GAMEOPS_CODEX_REASONING_ENABLED: 'true',
        GAMEOPS_CODEX_API_KEY: 'server-only-secret'
      },
      fetcher: async () => {
        throw new TypeError('network unavailable');
      }
    },
    {
      name: 'response redacted',
      expected: 'CODEX_RESPONSE_REDACTED',
      env: {
        GAMEOPS_CODEX_REASONING_ENABLED: 'true',
        GAMEOPS_CODEX_API_KEY: 'server-only-secret'
      },
      fetcher: async () => codexJsonResponse(codexPayload({
        answerHeadline: 'DISCORD_TOKEN=super-secret-token-value'
      }))
    },
    {
      name: 'unknown error',
      expected: 'CODEX_UNKNOWN_ERROR',
      env: {
        GAMEOPS_CODEX_REASONING_ENABLED: 'true',
        GAMEOPS_CODEX_API_KEY: 'server-only-secret'
      },
      fetcher: async () => {
        throw new Error('unexpected failure');
      }
    }
  ];

  for (const item of cases) {
    resetOperatorReasoningDiagnostics();
    const logs: Record<string, unknown>[] = [];
    const buildInput = {
      request: { request: 'analyze-current-context' },
      contextPack: contextPack(),
      generatedAt,
      logger: {
        warn: (payload) => {
          logs.push(payload);
        }
      }
    } satisfies Parameters<typeof buildOperatorReasoningResponse>[0];
    const response = await buildOperatorReasoningResponse({
      ...buildInput,
      ...(item.env ? { env: item.env } : {}),
      ...(item.fetcher ? { fetcher: item.fetcher } : {})
    });
    const status = getOperatorReasoningStatus(item.env);
    const serializedLogs = JSON.stringify(logs);

    assert.equal(response.engine, 'placeholder', item.name);
    assert.equal(status.lastReasonCode, item.expected, item.name);
    assert.equal(status.placeholderFallbackCount, 1, item.name);
    assert.equal(logs.length, 1, item.name);
    assert(serializedLogs.includes(item.expected), item.name);
    assert(!serializedLogs.includes('server-only-secret'), item.name);
    assert(!serializedLogs.includes('super-secret-token-value'), item.name);
    assert(!serializedLogs.includes('contextPack'), item.name);
    assert(!serializedLogs.includes('answerBullets'), item.name);
  }
});
