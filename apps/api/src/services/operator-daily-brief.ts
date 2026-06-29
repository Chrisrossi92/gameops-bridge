import {
  operatorDailyBriefSchema,
  type OperatorDailyBrief,
  type OperatorDailyBriefConfidence,
  type OperatorTimelineEvent
} from '@gameops/shared';
import { redactSecrets } from './operator-redaction.js';
import { OperatorTimelineStore } from './operator-timeline.js';

const DEFAULT_DAILY_BRIEF_WINDOW_MS = 24 * 60 * 60 * 1_000;
const MAX_SECTION_ITEMS = 5;

function clean(value: string, maxLength = 220): string {
  const cleaned = redactSecrets(value).replace(/\s+/g, ' ').trim();
  return (cleaned || 'No detail available.').slice(0, maxLength);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => clean(value)).filter(Boolean)));
}

function countByType(events: OperatorTimelineEvent[]): Record<string, number> {
  return events.reduce<Record<string, number>>((counts, event) => {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
    return counts;
  }, {});
}

function confidenceFor(events: OperatorTimelineEvent[], rangeMs: number): OperatorDailyBriefConfidence {
  if (events.length >= 4) {
    return 'high';
  }

  if (events.length > 0) {
    return 'medium';
  }

  return rangeMs <= DEFAULT_DAILY_BRIEF_WINDOW_MS ? 'low' : 'medium';
}

function buildHeadline(events: OperatorTimelineEvent[], criticalCount: number, warningCount: number): string {
  if (events.length === 0) {
    return 'No operator timeline events in the last 24 hours.';
  }

  if (criticalCount > 0) {
    return `${criticalCount} critical operator signal${criticalCount === 1 ? '' : 's'} need review.`;
  }

  if (warningCount > 0) {
    return `${warningCount} warning signal${warningCount === 1 ? '' : 's'} observed in the last 24 hours.`;
  }

  return 'Operator timeline is quiet for the last 24 hours.';
}

function buildHealthSummary(events: OperatorTimelineEvent[], counts: Record<string, number>, criticalCount: number, warningCount: number): string {
  if (events.length === 0) {
    return 'No recent operational changes were recorded. Confidence is limited until timeline events accumulate.';
  }

  const parts = [
    `${events.length} event${events.length === 1 ? '' : 's'}`,
    `${warningCount} warning${warningCount === 1 ? '' : 's'}`,
    `${criticalCount} critical`
  ];
  const activeTypes = ['git', 'disk', 'pm2', 'server', 'deployment', 'operator']
    .filter((type) => (counts[type] ?? 0) > 0)
    .join(', ');

  return `Last 24 hours: ${parts.join(', ')}${activeTypes ? ` across ${activeTypes}.` : '.'}`;
}

function recommendationFor(event: OperatorTimelineEvent): string | null {
  const summary = event.summary.toLowerCase();

  if (event.type === 'git') {
    return 'Review local repository changes before deploy or pull.';
  }

  if (event.type === 'deployment') {
    return 'Review local changes before pulling upstream updates.';
  }

  if (event.type === 'disk') {
    return 'Review disk usage and safe cleanup options on the VPS.';
  }

  if (event.type === 'pm2') {
    return 'Review PM2 service state from the VPS before manual action.';
  }

  if (event.type === 'server') {
    return 'Review server resource pressure and recent application warnings.';
  }

  if (event.type === 'operator' && !summary.includes('no immediate')) {
    return event.summary;
  }

  return null;
}

function summarizeKeyChange(event: OperatorTimelineEvent): string {
  if (event.type === 'git' || event.type === 'deployment') {
    return clean(event.summary);
  }

  if (event.type === 'pm2') {
    return clean(event.summary);
  }

  if (event.type === 'disk') {
    return clean(event.summary);
  }

  return clean(`${event.title}: ${event.summary}`);
}

export function buildOperatorDailyBrief(input: {
  events: OperatorTimelineEvent[];
  now?: Date;
  windowMs?: number;
}): OperatorDailyBrief {
  const now = input.now ?? new Date();
  const windowMs = input.windowMs ?? DEFAULT_DAILY_BRIEF_WINDOW_MS;
  const from = new Date(now.getTime() - windowMs);
  const events = input.events
    .filter((event) => {
      const occurredAtMs = Date.parse(event.occurredAt);
      return Number.isFinite(occurredAtMs) && occurredAtMs >= from.getTime() && occurredAtMs <= now.getTime();
    })
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  const criticalCount = events.filter((event) => event.severity === 'critical').length;
  const warningCount = events.filter((event) => event.severity === 'warning').length;
  const counts = countByType(events);
  const warnings = unique(
    events
      .filter((event) => event.severity === 'warning' || event.severity === 'critical')
      .map((event) => clean(event.summary))
  ).slice(0, MAX_SECTION_ITEMS);
  const keyChanges = unique(
    events
      .filter((event) => event.type !== 'operator' || event.severity !== 'info')
      .map(summarizeKeyChange)
  ).slice(0, MAX_SECTION_ITEMS);
  const recommendations = unique(events.map(recommendationFor).filter((value): value is string => Boolean(value)))
    .slice(0, MAX_SECTION_ITEMS);

  if (recommendations.length === 0) {
    recommendations.push(events.length === 0
      ? 'Let the timeline collect more read-only observations.'
      : 'No immediate operator action is indicated from timeline events.');
  }

  return operatorDailyBriefSchema.parse({
    generatedAt: now.toISOString(),
    readOnly: true,
    range: {
      from: from.toISOString(),
      to: now.toISOString()
    },
    headline: buildHeadline(events, criticalCount, warningCount),
    healthSummary: buildHealthSummary(events, counts, criticalCount, warningCount),
    keyChanges: keyChanges.length > 0 ? keyChanges : ['No key operational changes recorded.'],
    warnings,
    recommendations,
    confidence: confidenceFor(events, windowMs)
  });
}

export function buildOperatorDailyBriefFromStore(
  store = new OperatorTimelineStore(),
  now = new Date(),
  windowMs = DEFAULT_DAILY_BRIEF_WINDOW_MS
): OperatorDailyBrief {
  const from = new Date(now.getTime() - windowMs).toISOString();
  const events = store.queryEvents({ since: from, limit: 500 });

  return buildOperatorDailyBrief({ events, now, windowMs });
}

