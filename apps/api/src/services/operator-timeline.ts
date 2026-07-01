import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import {
  operatorTimelineEventSchema,
  type OperatorBrief,
  type OperatorContext,
  type OperatorTimelineEvent,
  type OperatorTimelineEventSeverity,
  type OperatorTimelineEventType
} from '@gameops/shared';
import { redactSecrets } from './operator-redaction.js';
import { resolveRuntimeDataPath } from './runtime-paths.js';

export const DEFAULT_OPERATOR_TIMELINE_LIMIT = 5_000;
export const DEFAULT_OPERATOR_TIMELINE_DEDUP_WINDOW_MS = 15 * 60 * 1_000;

export interface OperatorTimelineEventInput {
  type: OperatorTimelineEventType;
  severity: OperatorTimelineEventSeverity;
  title: string;
  summary: string;
  fingerprint: string;
  occurredAt?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface OperatorTimelineQuery {
  type?: OperatorTimelineEventType;
  severity?: OperatorTimelineEventSeverity;
  limit?: number;
  since?: string;
}

interface OperatorTimelineFile {
  events?: unknown[];
}

function resolveTimelinePath(path?: string): string {
  if (path) {
    return isAbsolute(path) ? path : resolve(process.cwd(), path);
  }

  return resolveRuntimeDataPath('GAMEOPS_OPERATOR_TIMELINE_PATH', 'operator.timeline.json');
}

function getDedupWindowMs(): number {
  const configured = Number(process.env.GAMEOPS_OPERATOR_TIMELINE_DEDUP_MS);
  return Number.isFinite(configured) && configured >= 0
    ? configured
    : DEFAULT_OPERATOR_TIMELINE_DEDUP_WINDOW_MS;
}

function cleanText(value: string, maxLength = 260): string {
  const cleaned = redactSecrets(value).replace(/\s+/g, ' ').trim();
  return (cleaned || 'Operator event').slice(0, maxLength);
}

function cleanMetadata(metadata: Record<string, string | number | boolean | null> = {}): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      cleanText(key, 80),
      typeof value === 'string' ? cleanText(value, 180) : value
    ])
  );
}

function parseTimelineFile(raw: string): OperatorTimelineEvent[] {
  const parsed = JSON.parse(raw) as OperatorTimelineFile;
  const events = Array.isArray(parsed.events) ? parsed.events : [];

  return events
    .map((event) => operatorTimelineEventSchema.safeParse(event))
    .filter((result): result is { success: true; data: OperatorTimelineEvent } => result.success)
    .map((result) => result.data)
    .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
}

export class OperatorTimelineStore {
  private readonly path: string;
  private readonly maxEvents: number;
  private readonly dedupWindowMs: number;

  constructor(options: {
    path?: string;
    maxEvents?: number;
    dedupWindowMs?: number;
  } = {}) {
    this.path = resolveTimelinePath(options.path);
    this.maxEvents = options.maxEvents ?? DEFAULT_OPERATOR_TIMELINE_LIMIT;
    this.dedupWindowMs = options.dedupWindowMs ?? getDedupWindowMs();
  }

  appendEvent(input: OperatorTimelineEventInput): OperatorTimelineEvent {
    const events = this.loadEvents();
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const event = operatorTimelineEventSchema.parse({
      id: randomUUID(),
      type: input.type,
      severity: input.severity,
      occurredAt,
      title: cleanText(input.title, 120),
      summary: cleanText(input.summary),
      fingerprint: cleanText(input.fingerprint, 180),
      metadata: cleanMetadata(input.metadata)
    });
    const eventMs = Date.parse(event.occurredAt);
    const duplicate = events.find((existing) => (
      existing.fingerprint === event.fingerprint
      && Math.abs(eventMs - Date.parse(existing.occurredAt)) <= this.dedupWindowMs
    ));

    if (duplicate) {
      return duplicate;
    }

    const nextEvents = [...events, event]
      .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))
      .slice(-this.maxEvents);

    this.persistEvents(nextEvents);
    return event;
  }

  recentEvents(limit = 50): OperatorTimelineEvent[] {
    return this.queryEvents({ limit });
  }

  queryEvents(query: OperatorTimelineQuery = {}): OperatorTimelineEvent[] {
    const limit = Math.max(1, Math.min(query.limit ?? 50, this.maxEvents));
    const sinceMs = query.since ? Date.parse(query.since) : null;

    return this.loadEvents()
      .filter((event) => !query.type || event.type === query.type)
      .filter((event) => !query.severity || event.severity === query.severity)
      .filter((event) => sinceMs === null || Date.parse(event.occurredAt) >= sinceMs)
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
      .slice(0, limit);
  }

  private loadEvents(): OperatorTimelineEvent[] {
    if (!existsSync(this.path)) {
      return [];
    }

    try {
      return parseTimelineFile(readFileSync(this.path, 'utf8')).slice(-this.maxEvents);
    } catch {
      return [];
    }
  }

  private persistEvents(events: OperatorTimelineEvent[]): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify({ events }, null, 2), 'utf8');
  }
}

export function buildTimelineEventsFromOperatorState(
  context: OperatorContext,
  brief: OperatorBrief
): OperatorTimelineEventInput[] {
  const occurredAt = context.generatedAt;
  const events: OperatorTimelineEventInput[] = [];

  if (context.system.loadAverage[0] > context.system.cpuCount * 1.5) {
    events.push({
      type: 'server',
      severity: 'warning',
      occurredAt,
      title: 'Server load elevated',
      summary: `Load average is ${context.system.loadAverage[0].toFixed(2)} across ${context.system.cpuCount} CPUs.`,
      fingerprint: 'server:load-elevated',
      metadata: { load1m: context.system.loadAverage[0], cpuCount: context.system.cpuCount }
    });
  }

  if (context.system.memory.usedPercent >= 90) {
    events.push({
      type: 'server',
      severity: context.system.memory.usedPercent >= 97 ? 'critical' : 'warning',
      occurredAt,
      title: 'Memory usage high',
      summary: `Memory usage is ${context.system.memory.usedPercent.toFixed(1)}%.`,
      fingerprint: 'server:memory-high',
      metadata: { usedPercent: context.system.memory.usedPercent }
    });
  }

  if (context.pm2.status !== 'available') {
    events.push({
      type: 'pm2',
      severity: 'warning',
      occurredAt,
      title: 'PM2 unavailable',
      summary: `PM2 status is ${context.pm2.status}.`,
      fingerprint: `pm2:status:${context.pm2.status}`,
      metadata: { status: context.pm2.status }
    });
  }

  for (const process of context.pm2.processes.filter((process) => process.status !== 'online')) {
    events.push({
      type: 'pm2',
      severity: process.status === 'errored' ? 'critical' : 'warning',
      occurredAt,
      title: 'PM2 process state changed',
      summary: `${process.name} is ${process.status} in PM2.`,
      fingerprint: `pm2:process:${process.name}:${process.status}`,
      metadata: { process: process.name, status: process.status }
    });
  }

  for (const disk of context.disks) {
    if (disk.status !== 'available') {
      events.push({
        type: 'disk',
        severity: 'warning',
        occurredAt,
        title: 'Disk check unavailable',
        summary: `${disk.label} disk check is ${disk.status}.`,
        fingerprint: `disk:${disk.label}:status:${disk.status}`,
        metadata: { disk: disk.label, status: disk.status }
      });
      continue;
    }

    if ((disk.usedPercent ?? 0) >= 90) {
      events.push({
        type: 'disk',
        severity: (disk.usedPercent ?? 0) >= 97 ? 'critical' : 'warning',
        occurredAt,
        title: 'Disk usage high',
        summary: `${disk.label} disk usage is ${disk.usedPercent}%.`,
        fingerprint: `disk:${disk.label}:high`,
        metadata: { disk: disk.label, usedPercent: disk.usedPercent }
      });
    }
  }

  for (const repo of context.repos) {
    if (repo.status !== 'available') {
      events.push({
        type: 'git',
        severity: 'warning',
        occurredAt,
        title: 'Repository unavailable',
        summary: `${repo.label} git status is ${repo.status}.`,
        fingerprint: `git:${repo.label}:status:${repo.status}`,
        metadata: { repo: repo.label, status: repo.status }
      });
      continue;
    }

    if (repo.isDirty) {
      events.push({
        type: 'git',
        severity: 'warning',
        occurredAt,
        title: 'Repository has local changes',
        summary: `${repo.label} is dirty on ${repo.branch ?? 'unknown branch'} with ${repo.modifiedCount} modified and ${repo.untrackedCount} untracked files.`,
        fingerprint: `git:${repo.label}:dirty`,
        metadata: {
          repo: repo.label,
          branch: repo.branch,
          modifiedCount: repo.modifiedCount,
          stagedCount: repo.stagedCount,
          untrackedCount: repo.untrackedCount
        }
      });
    }

    if (repo.behind > 0) {
      events.push({
        type: 'deployment',
        severity: 'info',
        occurredAt,
        title: 'Repository behind upstream',
        summary: `${repo.label} is ${repo.behind} commit${repo.behind === 1 ? '' : 's'} behind ${repo.upstream ?? 'upstream'}.`,
        fingerprint: `deployment:${repo.label}:behind`,
        metadata: { repo: repo.label, behind: repo.behind, upstream: repo.upstream }
      });
    }
  }

  for (const recommendation of brief.recommendations) {
    events.push({
      type: 'operator',
      severity: recommendation.toLowerCase().includes('no immediate') ? 'info' : 'warning',
      occurredAt,
      title: 'Operator recommendation generated',
      summary: recommendation,
      fingerprint: `operator:recommendation:${recommendation.toLowerCase()}`
    });
  }

  return events;
}

export function appendOperatorTimelineEvents(
  context: OperatorContext,
  brief: OperatorBrief,
  store = new OperatorTimelineStore()
): OperatorTimelineEvent[] {
  return buildTimelineEventsFromOperatorState(context, brief).map((event) => store.appendEvent(event));
}
