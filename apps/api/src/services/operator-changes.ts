import {
  operatorChangesSummarySchema,
  type OperatorBrief,
  type OperatorChangesSummary,
  type OperatorDailyBriefConfidence,
  type OperatorTimelineEvent,
  type OperatorTimelineEventType
} from '@gameops/shared';
import { redactSecrets } from './operator-redaction.js';
import {
  buildTimelineEventsFromOperatorState,
  OperatorTimelineStore,
  type OperatorTimelineEventInput
} from './operator-timeline.js';
import type { OperatorContext } from '@gameops/shared';

const DEFAULT_CHANGE_WINDOW_MS = 24 * 60 * 60 * 1_000;
const MAX_SECTION_ITEMS = 5;

function clean(value: string, maxLength = 220): string {
  const cleaned = redactSecrets(value).replace(/\s+/g, ' ').trim();
  return (cleaned || 'No detail available.').slice(0, maxLength);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => clean(value)).filter(Boolean)));
}

function isWarningSeverity(severity: OperatorTimelineEvent['severity'] | OperatorTimelineEventInput['severity']): boolean {
  return severity === 'warning' || severity === 'critical';
}

function eventInRange(event: OperatorTimelineEvent, from: Date, to: Date): boolean {
  const occurredAtMs = Date.parse(event.occurredAt);
  return Number.isFinite(occurredAtMs) && occurredAtMs >= from.getTime() && occurredAtMs <= to.getTime();
}

function signalLabel(type: OperatorTimelineEventType): string {
  switch (type) {
    case 'git':
      return 'Git';
    case 'disk':
      return 'Disk';
    case 'pm2':
      return 'PM2';
    case 'server':
      return 'Server resources';
    case 'deployment':
      return 'Deployment readiness';
    case 'operator':
      return 'Operator recommendations';
  }
}

function recommendationForActiveWarning(event: OperatorTimelineEventInput): string | null {
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
    return 'Review server resource pressure before changing services.';
  }

  if (event.type === 'operator') {
    return event.summary;
  }

  return null;
}

function confidenceFor(events: OperatorTimelineEvent[], currentEvents: OperatorTimelineEventInput[]): OperatorDailyBriefConfidence {
  if (events.length >= 3 && currentEvents.length > 0) {
    return 'high';
  }

  if (events.length > 0 || currentEvents.length > 0) {
    return 'medium';
  }

  return 'low';
}

function buildHeadline(input: {
  events: OperatorTimelineEvent[];
  newWarnings: string[];
  resolvedWarnings: string[];
  activeWarnings: OperatorTimelineEventInput[];
}): string {
  if (input.newWarnings.length > 0) {
    return `${input.newWarnings.length} active warning${input.newWarnings.length === 1 ? '' : 's'} changed in the last 24 hours.`;
  }

  if (input.resolvedWarnings.length > 0) {
    return `${input.resolvedWarnings.length} warning${input.resolvedWarnings.length === 1 ? '' : 's'} appear resolved.`;
  }

  if (input.activeWarnings.length > 0) {
    return `${input.activeWarnings.length} warning${input.activeWarnings.length === 1 ? '' : 's'} still active.`;
  }

  if (input.events.length === 0) {
    return 'No meaningful operator changes in the last 24 hours.';
  }

  return 'Timeline changed without active warnings.';
}

function buildStableSignals(currentEvents: OperatorTimelineEventInput[], currentBrief: OperatorBrief): string[] {
  const activeWarningTypes = new Set(
    currentEvents
      .filter((event) => isWarningSeverity(event.severity))
      .map((event) => event.type)
  );
  const stable = (['git', 'disk', 'pm2', 'server'] as OperatorTimelineEventType[])
    .filter((type) => !activeWarningTypes.has(type))
    .map((type) => `${signalLabel(type)} has no active warning in the current operator snapshot.`);

  if (currentBrief.risks.length === 0) {
    stable.unshift('Current operator brief reports no active risks.');
  }

  return stable.slice(0, MAX_SECTION_ITEMS);
}

export function buildOperatorChangesSummary(input: {
  events: OperatorTimelineEvent[];
  currentBrief: OperatorBrief;
  currentEvents: OperatorTimelineEventInput[];
  now?: Date;
  windowMs?: number;
}): OperatorChangesSummary {
  const now = input.now ?? new Date();
  const windowMs = input.windowMs ?? DEFAULT_CHANGE_WINDOW_MS;
  const from = new Date(now.getTime() - windowMs);
  const events = input.events
    .filter((event) => eventInRange(event, from, now))
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  const activeWarnings = input.currentEvents.filter((event) => isWarningSeverity(event.severity));
  const activeWarningFingerprints = new Set(activeWarnings.map((event) => event.fingerprint));
  const timelineWarnings = events.filter((event) => isWarningSeverity(event.severity));
  const newWarnings = unique(
    timelineWarnings
      .filter((event) => activeWarningFingerprints.has(event.fingerprint))
      .map((event) => event.summary)
  ).slice(0, MAX_SECTION_ITEMS);
  const resolvedWarnings = unique(
    timelineWarnings
      .filter((event) => !activeWarningFingerprints.has(event.fingerprint))
      .map((event) => event.summary)
  ).slice(0, MAX_SECTION_ITEMS);
  const meaningfulChanges = unique(
    events
      .filter((event) => event.type !== 'operator' || isWarningSeverity(event.severity))
      .map((event) => event.summary)
  ).slice(0, MAX_SECTION_ITEMS);
  const activeRecommendation = activeWarnings.map(recommendationForActiveWarning).find((value): value is string => Boolean(value));
  const recommendedNextAction = activeRecommendation
    ?? input.currentBrief.recommendations.find((recommendation) => !recommendation.toLowerCase().includes('no immediate'))
    ?? (resolvedWarnings.length > 0 ? 'Confirm the resolved warning remains stable on the next refresh.' : 'No immediate operator action is indicated from read-only signals.');

  return operatorChangesSummarySchema.parse({
    generatedAt: now.toISOString(),
    readOnly: true,
    range: {
      from: from.toISOString(),
      to: now.toISOString()
    },
    headline: buildHeadline({ events, newWarnings, resolvedWarnings, activeWarnings }),
    meaningfulChanges: meaningfulChanges.length > 0 ? meaningfulChanges : ['No meaningful timeline changes recorded.'],
    unchangedSignals: buildStableSignals(input.currentEvents, input.currentBrief),
    newWarnings,
    resolvedWarnings,
    recommendedNextAction,
    confidence: confidenceFor(events, input.currentEvents)
  });
}

export function buildOperatorChangesSummaryFromState(input: {
  context: OperatorContext;
  brief: OperatorBrief;
  store?: OperatorTimelineStore;
  now?: Date;
  windowMs?: number;
}): OperatorChangesSummary {
  const now = input.now ?? new Date();
  const windowMs = input.windowMs ?? DEFAULT_CHANGE_WINDOW_MS;
  const from = new Date(now.getTime() - windowMs).toISOString();
  const store = input.store ?? new OperatorTimelineStore();
  const events = store.queryEvents({ since: from, limit: 500 });
  const currentEvents = buildTimelineEventsFromOperatorState(input.context, input.brief);

  return buildOperatorChangesSummary({
    events,
    currentBrief: input.brief,
    currentEvents,
    now,
    windowMs
  });
}

