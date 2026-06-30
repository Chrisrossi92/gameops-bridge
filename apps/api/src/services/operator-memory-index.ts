import {
  operatorMemoryIndexSchema,
  type OperatorMemoryIndex,
  type OperatorMemoryIndexSection,
  type OperatorMemoryIndexTrend,
  type OperatorTimelineEvent,
  type OperatorTimelineEventSeverity,
  type OperatorTimelineEventType
} from '@gameops/shared';
import { redactSecrets } from './operator-redaction.js';

const MAX_EXAMPLES = 5;

type MemorySectionKey = 'deployments' | 'services' | 'storage' | 'git' | 'recommendations' | 'warnings' | 'health';

function clean(value: string, maxLength = 240): string {
  const cleaned = redactSecrets(value).replace(/\s+/g, ' ').trim();
  return (cleaned || 'No detail available.').slice(0, maxLength);
}

function latestEvent(events: OperatorTimelineEvent[]): OperatorTimelineEvent | null {
  return events
    .slice()
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))[0] ?? null;
}

function countBy<T extends string>(values: T[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function warningCount(events: OperatorTimelineEvent[]): number {
  return events.filter((event) => event.severity === 'warning' || event.severity === 'critical').length;
}

function criticalCount(events: OperatorTimelineEvent[]): number {
  return events.filter((event) => event.severity === 'critical').length;
}

function hasActiveWarning(events: OperatorTimelineEvent[]): boolean {
  const latest = latestEvent(events);
  return latest?.severity === 'warning' || latest?.severity === 'critical';
}

function trendFor(events: OperatorTimelineEvent[]): OperatorMemoryIndexTrend {
  if (events.length === 0) {
    return 'quiet';
  }

  if (events.length < 3) {
    return 'recent';
  }

  const chronological = events
    .slice()
    .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
  const midpoint = Math.floor(chronological.length / 2);
  const earlyWarnings = warningCount(chronological.slice(0, midpoint));
  const lateWarnings = warningCount(chronological.slice(midpoint));

  if (lateWarnings > earlyWarnings) {
    return 'increasing';
  }

  return 'stable';
}

function sectionSummary(label: string, events: OperatorTimelineEvent[]): string {
  if (events.length === 0) {
    return `${label}: no timeline events recorded.`;
  }

  const warnings = warningCount(events);
  const critical = criticalCount(events);
  const latest = latestEvent(events);
  const latestText = latest ? ` Latest: ${latest.title}.` : '';

  return `${label}: ${events.length} event${events.length === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}, ${critical} critical.${latestText}`;
}

function activeStateFor(events: OperatorTimelineEvent[], quietLabel = 'quiet'): string {
  if (events.length === 0) {
    return quietLabel;
  }

  if (criticalCount(events) > 0 && latestEvent(events)?.severity === 'critical') {
    return 'critical';
  }

  return hasActiveWarning(events) ? 'attention' : 'observed';
}

function section(label: string, events: OperatorTimelineEvent[], quietLabel?: string): OperatorMemoryIndexSection {
  const latest = latestEvent(events);

  return {
    count: events.length,
    latestOccurrence: latest?.occurredAt ?? null,
    activeState: activeStateFor(events, quietLabel),
    historicalSummary: clean(sectionSummary(label, events)),
    trend: trendFor(events),
    examples: events
      .slice()
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
      .slice(0, MAX_EXAMPLES)
      .map((event) => clean(`${event.title}: ${event.summary}`))
  };
}

function eventsForSection(events: OperatorTimelineEvent[], key: MemorySectionKey): OperatorTimelineEvent[] {
  switch (key) {
    case 'deployments':
      return events.filter((event) => event.type === 'deployment');
    case 'services':
      return events.filter((event) => event.type === 'pm2');
    case 'storage':
      return events.filter((event) => event.type === 'disk');
    case 'git':
      return events.filter((event) => event.type === 'git');
    case 'recommendations':
      return events.filter((event) => event.type === 'operator' && /recommendation/i.test(`${event.title} ${event.summary}`));
    case 'warnings':
      return events.filter((event) => event.severity === 'warning' || event.severity === 'critical');
    case 'health':
      return events.filter((event) => event.type === 'server' || event.severity === 'critical');
  }
}

export function buildOperatorMemoryIndex(input: {
  events: OperatorTimelineEvent[];
  generatedAt?: string;
}): OperatorMemoryIndex {
  const events = input.events
    .slice()
    .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
  const first = events[0] ?? null;
  const last = events[events.length - 1] ?? null;
  const warningEvents = warningCount(events);
  const criticalEvents = criticalCount(events);

  return operatorMemoryIndexSchema.parse({
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    readOnly: true,
    range: {
      from: first?.occurredAt ?? null,
      to: last?.occurredAt ?? null
    },
    deployments: section('Deployments', eventsForSection(events, 'deployments')),
    services: section('Services', eventsForSection(events, 'services')),
    storage: section('Storage', eventsForSection(events, 'storage')),
    git: section('Git', eventsForSection(events, 'git')),
    recommendations: section('Recommendations', eventsForSection(events, 'recommendations'), 'none active'),
    warnings: section('Warnings', eventsForSection(events, 'warnings')),
    health: section('Health', eventsForSection(events, 'health')),
    timelineStatistics: {
      totalEvents: events.length,
      warningEvents,
      criticalEvents,
      byType: countBy(events.map((event) => event.type as OperatorTimelineEventType)),
      bySeverity: countBy(events.map((event) => event.severity as OperatorTimelineEventSeverity)),
      firstEventAt: first?.occurredAt ?? null,
      lastEventAt: last?.occurredAt ?? null,
      historicalSummary: events.length === 0
        ? 'Timeline memory is empty.'
        : `Timeline memory has ${events.length} event${events.length === 1 ? '' : 's'}, ${warningEvents} warning${warningEvents === 1 ? '' : 's'}, and ${criticalEvents} critical event${criticalEvents === 1 ? '' : 's'}.`,
      trend: trendFor(events)
    }
  });
}
