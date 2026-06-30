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
const DEFAULT_CODEX_MODEL = 'placeholder';

interface ReasoningLogger {
  warn: (payload: Record<string, unknown>, message?: string) => void;
}

interface ReasoningDiagnosticsState {
  lastReasonCode: OperatorReasonFallbackReasonCode | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  placeholderFallbackCount: number;
}

const diagnosticsState: ReasoningDiagnosticsState = {
  lastReasonCode: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
  placeholderFallbackCount: 0
};

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

export function getOperatorReasoningFallbackReason(env: NodeJS.ProcessEnv = process.env): OperatorReasonFallbackReasonCode {
  if (!isCodexEnabled(env)) {
    return 'CODEX_DISABLED';
  }

  if (!isCodexConfigured(env)) {
    return 'CODEX_NOT_CONFIGURED';
  }

  return 'CODEX_DISABLED';
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

export function buildOperatorReasoningResponse(input: {
  request: OperatorReasonRequest;
  contextPack: OperatorContextPackResponse;
  generatedAt?: string;
  logger?: ReasoningLogger;
  env?: NodeJS.ProcessEnv;
}): OperatorReasonResponse {
  recordOperatorReasoningFallback(getOperatorReasoningFallbackReason(input.env), input.logger);
  const answerBullets = buildAnswerBullets(input.contextPack);
  const recommendedNextActions = unique(input.contextPack.recommendedFocus).slice(0, MAX_ACTIONS);
  const evidence = input.contextPack.evidence
    .filter((item) => !item.source.toLowerCase().includes('log'))
    .slice(0, MAX_EVIDENCE)
    .map((item) => reasonEvidence(item.source, item.detail));
  const limitations = [
    'Placeholder mode only: no Codex call has been made.',
    'No shell commands, deploy commands, or external AI calls were executed.',
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
