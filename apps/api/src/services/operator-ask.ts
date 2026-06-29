import {
  operatorAskResponseSchema,
  type OperatorAskIntent,
  type OperatorAskResponse,
  type OperatorBrief,
  type OperatorChangesSummary,
  type OperatorDailyBrief,
  type OperatorInsightsResponse,
  type OperatorTimelineEvent
} from '@gameops/shared';
import { redactSecrets } from './operator-redaction.js';

const UNSUPPORTED_ANSWER = 'I can answer questions about current health, what changed, today\'s brief, insights, and recent timeline.';

function clean(value: string, maxLength = 220): string {
  const cleaned = redactSecrets(value).replace(/\s+/g, ' ').trim();
  return (cleaned || 'No detail available.').slice(0, maxLength);
}

function cleanBullets(values: string[]): string[] {
  const bullets = Array.from(new Set(values.map((value) => clean(value)).filter(Boolean))).slice(0, 6);
  return bullets.length > 0 ? bullets : ['No matching operator details are available yet.'];
}

export function classifyOperatorQuestion(question: string): OperatorAskIntent {
  const normalized = question.trim().toLowerCase();

  if (/\bwhat changed\b/.test(normalized) || normalized.includes('changes') || normalized.includes('changed')) {
    return 'changes';
  }

  if (normalized.includes('what happened today') || normalized.includes('daily brief') || normalized.includes('today') || normalized.includes('brief')) {
    return 'daily-brief';
  }

  if (normalized.includes('any insights') || normalized.includes('insights') || normalized.includes('what should i know') || normalized.includes('should know')) {
    return 'insights';
  }

  if (normalized.includes('timeline') || normalized.includes('recent events') || normalized.includes('events')) {
    return 'timeline';
  }

  if (normalized.includes('current state') || normalized.includes('health') || normalized.includes('status')) {
    return 'current-state';
  }

  return 'unsupported';
}

export function answerOperatorQuestion(input: {
  question: string;
  brief: OperatorBrief;
  dailyBrief: OperatorDailyBrief;
  changes: OperatorChangesSummary;
  insights: OperatorInsightsResponse;
  timelineEvents: OperatorTimelineEvent[];
}): OperatorAskResponse {
  const question = clean(input.question, 240);
  const intent = classifyOperatorQuestion(question);

  if (intent === 'changes') {
    return operatorAskResponseSchema.parse({
      question,
      intent,
      headline: input.changes.headline,
      bullets: cleanBullets([
        ...input.changes.meaningfulChanges.slice(0, 2),
        ...input.changes.newWarnings.slice(0, 2),
        ...input.changes.resolvedWarnings.slice(0, 1),
        input.changes.recommendedNextAction
      ]),
      confidence: input.changes.confidence,
      source: 'changes',
      readOnly: true
    });
  }

  if (intent === 'daily-brief') {
    return operatorAskResponseSchema.parse({
      question,
      intent,
      headline: input.dailyBrief.headline,
      bullets: cleanBullets([
        input.dailyBrief.healthSummary,
        ...input.dailyBrief.keyChanges.slice(0, 2),
        ...input.dailyBrief.warnings.slice(0, 2),
        ...input.dailyBrief.recommendations.slice(0, 1)
      ]),
      confidence: input.dailyBrief.confidence,
      source: 'daily-brief',
      readOnly: true
    });
  }

  if (intent === 'insights') {
    const topInsights = input.insights.insights.slice(0, 3);

    return operatorAskResponseSchema.parse({
      question,
      intent,
      headline: topInsights[0]?.title ?? 'No operator insight is available yet.',
      bullets: cleanBullets(topInsights.flatMap((insight) => [
        insight.summary,
        ...insight.evidence.slice(0, 1),
        insight.recommendedAction ?? ''
      ])),
      confidence: topInsights[0]?.confidence ?? 'low',
      source: 'insights',
      readOnly: true
    });
  }

  if (intent === 'timeline') {
    const events = input.timelineEvents.slice(0, 5);

    return operatorAskResponseSchema.parse({
      question,
      intent,
      headline: events.length > 0 ? `${events.length} recent operator timeline event${events.length === 1 ? '' : 's'}.` : 'No recent operator timeline events.',
      bullets: cleanBullets(events.map((event) => `${event.title}: ${event.summary}`)),
      confidence: events.length >= 3 ? 'high' : events.length > 0 ? 'medium' : 'low',
      source: 'timeline',
      readOnly: true
    });
  }

  if (intent === 'current-state') {
    return operatorAskResponseSchema.parse({
      question,
      intent,
      headline: input.brief.summary,
      bullets: cleanBullets([
        ...input.brief.risks.slice(0, 3),
        ...input.brief.recentEvents.slice(0, 2),
        ...input.brief.recommendations.slice(0, 1)
      ]),
      confidence: input.brief.health === 'unknown' ? 'low' : 'medium',
      source: 'current-state',
      readOnly: true
    });
  }

  return operatorAskResponseSchema.parse({
    question,
    intent,
    headline: UNSUPPORTED_ANSWER,
    bullets: [UNSUPPORTED_ANSWER],
    confidence: 'low',
    source: 'current-state',
    readOnly: true
  });
}

