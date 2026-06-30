import { z } from 'zod';
import {
  operatorReasonFallbackReasonCodeSchema,
  operatorReasonResponseSchema,
  operatorReasonStatusResponseSchema,
  type OperatorContextPackResponse,
  type OperatorReasonEvidence,
  type OperatorReasonFallbackReasonCode,
  type OperatorReasonRequest,
  type OperatorReasonResponse,
  type OperatorReasonStatusResponse
} from '@gameops/shared';
import { redactSecrets } from './operator-redaction.js';

const MAX_EVIDENCE = 12;
const MAX_BULLETS = 8;
const MAX_ACTIONS = 6;
const DEFAULT_CODEX_MODEL = 'gpt-5-codex';
const DEFAULT_CODEX_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_CODEX_TIMEOUT_MS = 20_000;
const DEFAULT_INPUT_MAX_BYTES = 24_000;
const DEFAULT_OUTPUT_MAX_BYTES = 12_000;

interface ReasoningLogger {
  warn: (payload: Record<string, unknown>, message?: string) => void;
}

interface ReasoningDiagnosticsState {
  lastReasonCode: OperatorReasonFallbackReasonCode | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  placeholderFallbackCount: number;
}

interface CodexFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

type CodexFetcher = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  }
) => Promise<CodexFetchResponse>;

const diagnosticsState: ReasoningDiagnosticsState = {
  lastReasonCode: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
  placeholderFallbackCount: 0
};

const codexReasoningPayloadSchema = z.object({
  answerHeadline: z.string().min(1),
  answerBullets: z.array(z.string().min(1)).min(1).max(MAX_BULLETS),
  evidence: z.array(z.object({
    source: z.string().min(1),
    detail: z.string().min(1)
  })).max(MAX_EVIDENCE),
  limitations: z.array(z.string().min(1)).min(1).max(6),
  recommendedNextActions: z.array(z.string().min(1)).max(MAX_ACTIONS),
  confidence: z.enum(['high', 'medium', 'low'])
});

function clean(value: string, maxLength = 260): string {
  const cleaned = redactSecrets(value)
    .replace(/\b[A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD)[A-Z0-9_]*=\[REDACTED\]/gi, '[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'No detail available.').slice(0, maxLength);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => clean(value)).filter(Boolean)));
}

function reasonEvidence(source: string, detail: string): OperatorReasonEvidence {
  return {
    source: clean(source, 80),
    detail: clean(detail)
  };
}

function collectAttentionItems(contextPack: OperatorContextPackResponse): string[] {
  return unique([
    ...contextPack.warnings,
    ...contextPack.recommendedFocus,
    ...contextPack.sections.flatMap((section) => section.bullets.slice(0, 2))
  ]).slice(0, 4);
}

function buildAnswerBullets(contextPack: OperatorContextPackResponse): string[] {
  const attentionItems = collectAttentionItems(contextPack);

  if (attentionItems.length === 0) {
    return [
      'Top attention: no active warning or focus item is present in the context pack.',
      'Why it matters: the placeholder gateway has limited signal until more operator events accumulate.',
      'Check next: review current health, timeline activity, and configured collectors if more detail is needed.'
    ];
  }

  return attentionItems.flatMap((item, index) => [
    `Top attention ${index + 1}: ${item}`,
    `Why it matters: this item appears in the sanitized operator context pack and may affect deployment confidence.`,
    `Check next: inspect the related dashboard-safe operator section before taking manual action.`
  ]).slice(0, MAX_BULLETS);
}

function confidenceFor(contextPack: OperatorContextPackResponse): OperatorReasonResponse['confidence'] {
  if (contextPack.evidence.length >= 6 && contextPack.sections.length >= 4) {
    return 'medium';
  }

  return 'low';
}

function isCodexEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GAMEOPS_CODEX_REASONING_ENABLED === 'true';
}

function isCodexConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.GAMEOPS_CODEX_API_KEY?.trim());
}

function getCodexModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.GAMEOPS_CODEX_MODEL?.trim() || DEFAULT_CODEX_MODEL;
}

function getCodexEndpoint(env: NodeJS.ProcessEnv = process.env): string {
  return env.GAMEOPS_CODEX_ENDPOINT?.trim() || DEFAULT_CODEX_ENDPOINT;
}

function getPositiveIntegerEnv(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const value = Number(env[key]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function sanitizeCodexText(value: string): { text: string; redacted: boolean } {
  const redacted = redactSecrets(value);
  return {
    text: redacted,
    redacted: redacted !== value
  };
}

function buildCodexInput(input: {
  request: OperatorReasonRequest;
  contextPack: OperatorContextPackResponse;
}): string {
  return JSON.stringify({
    request: input.request.request,
    question: clean(input.request.question ?? input.request.request),
    safety: {
      readOnly: true,
      noShellExecution: true,
      noFileContents: true,
      noRawLogs: true,
      redactionApplied: input.contextPack.redactionApplied
    },
    context: {
      generatedAt: input.contextPack.generatedAt,
      sections: input.contextPack.sections.map((section) => ({
        title: clean(section.title, 120),
        summary: clean(section.summary, 220),
        bullets: section.bullets.slice(0, 6).map((bullet) => clean(bullet, 220))
      })),
      warnings: input.contextPack.warnings.slice(0, 12).map((warning) => clean(warning, 220)),
      recommendedFocus: input.contextPack.recommendedFocus.slice(0, 8).map((focus) => clean(focus, 220)),
      evidence: input.contextPack.evidence.slice(0, 16).map((item) => reasonEvidence(item.source, item.detail)),
      memoryIndex: input.contextPack.memoryIndex ? {
        deployments: input.contextPack.memoryIndex.deployments,
        services: input.contextPack.memoryIndex.services,
        storage: input.contextPack.memoryIndex.storage,
        git: input.contextPack.memoryIndex.git,
        recommendations: input.contextPack.memoryIndex.recommendations,
        warnings: input.contextPack.memoryIndex.warnings,
        health: input.contextPack.memoryIndex.health,
        timelineStatistics: input.contextPack.memoryIndex.timelineStatistics
      } : undefined,
      recentTimeline: input.contextPack.recentTimeline?.slice(0, 8).map((event) => ({
        occurredAt: event.occurredAt,
        type: event.type,
        severity: event.severity,
        title: clean(event.title, 140),
        summary: clean(event.summary, 220)
      }))
    }
  });
}

function buildCodexRequestBody(input: {
  request: OperatorReasonRequest;
  contextPack: OperatorContextPackResponse;
  model: string;
}): string {
  return JSON.stringify({
    model: input.model,
    instructions: [
      'You are GameOps Bridge AI Operator.',
      'Use only the provided sanitized operational context.',
      'Do not ask to run commands, restart services, deploy, modify files, or expose secrets.',
      'Return concise dashboard-safe JSON only.'
    ].join(' '),
    input: buildCodexInput(input),
    text: {
      format: {
        type: 'json_schema',
        name: 'gameops_operator_reasoning',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: [
            'answerHeadline',
            'answerBullets',
            'evidence',
            'limitations',
            'recommendedNextActions',
            'confidence'
          ],
          properties: {
            answerHeadline: { type: 'string', minLength: 1 },
            answerBullets: {
              type: 'array',
              minItems: 1,
              maxItems: MAX_BULLETS,
              items: { type: 'string', minLength: 1 }
            },
            evidence: {
              type: 'array',
              maxItems: MAX_EVIDENCE,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['source', 'detail'],
                properties: {
                  source: { type: 'string', minLength: 1 },
                  detail: { type: 'string', minLength: 1 }
                }
              }
            },
            limitations: {
              type: 'array',
              minItems: 1,
              maxItems: 6,
              items: { type: 'string', minLength: 1 }
            },
            recommendedNextActions: {
              type: 'array',
              maxItems: MAX_ACTIONS,
              items: { type: 'string', minLength: 1 }
            },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
          }
        }
      }
    }
  });
}

function findTextInResponse(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.output_text === 'string') {
    return record.output_text;
  }

  if (typeof record.text === 'string') {
    return record.text;
  }

  if (Array.isArray(record.output)) {
    for (const outputItem of record.output) {
      const found = findTextInResponse(outputItem);
      if (found) {
        return found;
      }
    }
  }

  if (Array.isArray(record.content)) {
    for (const contentItem of record.content) {
      const found = findTextInResponse(contentItem);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

export function getOperatorReasoningFallbackReason(env: NodeJS.ProcessEnv = process.env): OperatorReasonFallbackReasonCode | null {
  if (!isCodexEnabled(env)) {
    return 'CODEX_DISABLED';
  }

  if (!isCodexConfigured(env)) {
    return 'CODEX_NOT_CONFIGURED';
  }

  return null;
}

export function recordOperatorReasoningFallback(
  reasonCode: OperatorReasonFallbackReasonCode,
  logger?: ReasoningLogger,
  now = new Date()
): void {
  const parsedReasonCode = operatorReasonFallbackReasonCodeSchema.parse(reasonCode);
  diagnosticsState.lastReasonCode = parsedReasonCode;
  diagnosticsState.lastAttemptAt = now.toISOString();
  diagnosticsState.placeholderFallbackCount += 1;
  logger?.warn({
    route: '/api/operator/reason',
    reasonCode: parsedReasonCode,
    engine: 'placeholder'
  }, 'AI Operator reasoning placeholder fallback');
}

export function recordOperatorReasoningSuccess(now = new Date()): void {
  diagnosticsState.lastReasonCode = null;
  diagnosticsState.lastAttemptAt = now.toISOString();
  diagnosticsState.lastSuccessAt = now.toISOString();
}

export function getOperatorReasoningStatus(env: NodeJS.ProcessEnv = process.env): OperatorReasonStatusResponse {
  return operatorReasonStatusResponseSchema.parse({
    enabled: isCodexEnabled(env),
    configured: isCodexConfigured(env),
    model: getCodexModel(env),
    lastReasonCode: diagnosticsState.lastReasonCode,
    lastAttemptAt: diagnosticsState.lastAttemptAt,
    lastSuccessAt: diagnosticsState.lastSuccessAt,
    placeholderFallbackCount: diagnosticsState.placeholderFallbackCount
  });
}

export function resetOperatorReasoningDiagnostics(): void {
  diagnosticsState.lastReasonCode = null;
  diagnosticsState.lastAttemptAt = null;
  diagnosticsState.lastSuccessAt = null;
  diagnosticsState.placeholderFallbackCount = 0;
}

function buildPlaceholderReasoningResponse(input: {
  request: OperatorReasonRequest;
  contextPack: OperatorContextPackResponse;
  generatedAt?: string;
}): OperatorReasonResponse {
  const answerBullets = buildAnswerBullets(input.contextPack);
  const recommendedNextActions = unique(input.contextPack.recommendedFocus).slice(0, MAX_ACTIONS);
  const evidence = input.contextPack.evidence
    .filter((item) => !item.source.toLowerCase().includes('log'))
    .slice(0, MAX_EVIDENCE)
    .map((item) => reasonEvidence(item.source, item.detail));
  const limitations = [
    'Placeholder mode returned safe local analysis because Codex reasoning was unavailable.',
    'No shell commands, deploy commands, or write actions were executed.',
    'Reasoning is limited to sanitized context-pack summaries, capped evidence, and read-only operator state.',
    'Raw logs and file contents are intentionally excluded.'
  ];

  return operatorReasonResponseSchema.parse({
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    readOnly: true,
    engine: 'placeholder',
    question: clean(input.request.question ?? input.request.request),
    answerHeadline: answerBullets.length > 0
      ? 'Placeholder analysis identified read-only operator focus areas.'
      : 'Placeholder analysis found limited operator signal.',
    answerBullets,
    evidence,
    limitations,
    recommendedNextActions,
    confidence: confidenceFor(input.contextPack)
  });
}

async function attemptCodexReasoning(input: {
  request: OperatorReasonRequest;
  contextPack: OperatorContextPackResponse;
  generatedAt?: string;
  env: NodeJS.ProcessEnv;
  fetcher: CodexFetcher;
}): Promise<{ response: OperatorReasonResponse } | { reasonCode: OperatorReasonFallbackReasonCode }> {
  const apiKey = input.env.GAMEOPS_CODEX_API_KEY?.trim();
  const model = getCodexModel(input.env);
  const requestBody = buildCodexRequestBody({
    request: input.request,
    contextPack: input.contextPack,
    model
  });
  const inputMaxBytes = getPositiveIntegerEnv(input.env, 'GAMEOPS_CODEX_INPUT_MAX_BYTES', DEFAULT_INPUT_MAX_BYTES);
  const outputMaxBytes = getPositiveIntegerEnv(input.env, 'GAMEOPS_CODEX_OUTPUT_MAX_BYTES', DEFAULT_OUTPUT_MAX_BYTES);

  if (byteLength(requestBody) > inputMaxBytes) {
    return { reasonCode: 'CODEX_INPUT_TOO_LARGE' };
  }

  const controller = new AbortController();
  const timeoutMs = getPositiveIntegerEnv(input.env, 'GAMEOPS_CODEX_TIMEOUT_MS', DEFAULT_CODEX_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await input.fetcher(getCodexEndpoint(input.env), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: requestBody,
      signal: controller.signal
    });

    if (!response.ok) {
      return { reasonCode: 'CODEX_NON_2XX' };
    }

    let responseJson: unknown;
    try {
      responseJson = await response.json();
    } catch {
      return { reasonCode: 'CODEX_INVALID_JSON' };
    }

    const outputText = findTextInResponse(responseJson);
    if (!outputText) {
      return { reasonCode: 'CODEX_INVALID_JSON' };
    }

    if (byteLength(outputText) > outputMaxBytes) {
      return { reasonCode: 'CODEX_OUTPUT_TOO_LARGE' };
    }

    const sanitizedOutput = sanitizeCodexText(outputText);
    if (sanitizedOutput.redacted) {
      return { reasonCode: 'CODEX_RESPONSE_REDACTED' };
    }

    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(sanitizedOutput.text);
    } catch {
      return { reasonCode: 'CODEX_INVALID_JSON' };
    }

    const parsed = codexReasoningPayloadSchema.safeParse(parsedOutput);
    if (!parsed.success) {
      return { reasonCode: 'CODEX_SCHEMA_INVALID' };
    }

    const safeOutput = parsed.data;
    return {
      response: operatorReasonResponseSchema.parse({
        generatedAt: input.generatedAt ?? new Date().toISOString(),
        readOnly: true,
        engine: 'codex',
        question: clean(input.request.question ?? input.request.request),
        answerHeadline: clean(safeOutput.answerHeadline, 180),
        answerBullets: safeOutput.answerBullets.slice(0, MAX_BULLETS).map((bullet) => clean(bullet, 280)),
        evidence: safeOutput.evidence.slice(0, MAX_EVIDENCE).map((item) => reasonEvidence(item.source, item.detail)),
        limitations: safeOutput.limitations.slice(0, 6).map((limitation) => clean(limitation, 220)),
        recommendedNextActions: safeOutput.recommendedNextActions.slice(0, MAX_ACTIONS).map((action) => clean(action, 220)),
        confidence: safeOutput.confidence
      })
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { reasonCode: 'CODEX_TIMEOUT' };
    }

    if (error instanceof TypeError) {
      return { reasonCode: 'CODEX_NETWORK_ERROR' };
    }

    return { reasonCode: 'CODEX_UNKNOWN_ERROR' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function buildOperatorReasoningResponse(input: {
  request: OperatorReasonRequest;
  contextPack: OperatorContextPackResponse;
  generatedAt?: string;
  logger?: ReasoningLogger;
  env?: NodeJS.ProcessEnv;
  fetcher?: CodexFetcher;
}): Promise<OperatorReasonResponse> {
  const env = input.env ?? process.env;
  const preflightReasonCode = getOperatorReasoningFallbackReason(env);

  if (preflightReasonCode) {
    recordOperatorReasoningFallback(preflightReasonCode, input.logger);
    return buildPlaceholderReasoningResponse(input);
  }

  const codexInput = {
    request: input.request,
    contextPack: input.contextPack,
    env,
    fetcher: input.fetcher ?? fetch
  };
  const codexResult = await attemptCodexReasoning(input.generatedAt
    ? { ...codexInput, generatedAt: input.generatedAt }
    : codexInput);

  if ('response' in codexResult) {
    recordOperatorReasoningSuccess();
    return codexResult.response;
  }

  recordOperatorReasoningFallback(codexResult.reasonCode, input.logger);
  return buildPlaceholderReasoningResponse(input);
}
