import type { OperatorBriefResponse, OperatorSignalStatus } from '@gameops/shared';

export type OperatorSignalKey = 'pm2' | 'disk' | 'git' | 'logs' | 'health' | 'other';
export type OperatorSignalDisplayStatus = 'OK' | 'Warning' | 'Unavailable';

export interface OperatorEventGroup {
  key: OperatorSignalKey;
  label: string;
  events: string[];
}

export interface OperatorSignalSummary {
  key: Exclude<OperatorSignalKey, 'other'>;
  label: string;
  status: OperatorSignalDisplayStatus;
}

const signalLabels: Record<OperatorSignalKey, string> = {
  pm2: 'PM2',
  disk: 'Disk',
  git: 'Git',
  logs: 'Logs',
  health: 'Health',
  other: 'Other'
};

const signalOrder: OperatorSignalKey[] = ['pm2', 'disk', 'git', 'logs', 'health', 'other'];

function normalize(value: string): string {
  return value.toLowerCase();
}

export function classifyOperatorEvent(event: string): OperatorSignalKey {
  const normalized = normalize(event);

  if (normalized.includes('pm2')) {
    return 'pm2';
  }

  if (normalized.includes('disk') || normalized.includes('mount') || normalized.includes('volume')) {
    return 'disk';
  }

  if (
    normalized.includes('git')
    || normalized.includes('repo')
    || normalized.includes('branch')
    || normalized.includes('upstream')
    || normalized.includes('dirty on')
    || normalized.includes('clean on')
  ) {
    return 'git';
  }

  if (normalized.includes('log')) {
    return 'logs';
  }

  if (normalized.includes('health') || normalized.includes('caddy') || normalized.includes('api check')) {
    return 'health';
  }

  return 'other';
}

export function groupOperatorEvents(events: string[]): OperatorEventGroup[] {
  const grouped = new Map<OperatorSignalKey, string[]>();

  for (const event of events) {
    const key = classifyOperatorEvent(event);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  return signalOrder
    .map((key) => ({
      key,
      label: signalLabels[key],
      events: grouped.get(key) ?? []
    }))
    .filter((group) => group.events.length > 0);
}

function hasAny(values: string[], patterns: string[]): boolean {
  return values.some((value) => {
    const normalized = normalize(value);
    return patterns.some((pattern) => normalized.includes(pattern));
  });
}

function healthStatusLabel(status: OperatorSignalStatus): OperatorSignalDisplayStatus {
  if (status === 'ok') {
    return 'OK';
  }

  if (status === 'unknown') {
    return 'Unavailable';
  }

  return 'Warning';
}

export function deriveOperatorSignals(brief: OperatorBriefResponse): OperatorSignalSummary[] {
  const allText = [
    brief.summary,
    ...brief.risks,
    ...brief.recentEvents,
    ...brief.recommendations
  ];

  const signalStatuses: OperatorSignalSummary[] = [
    {
      key: 'pm2',
      label: 'PM2',
      status: hasAny(allText, ['pm2 status is unavailable', 'pm2 status is error', 'pm2 status is not available'])
        ? 'Unavailable'
        : hasAny(allText, ['non-online', 'stopped', 'errored', 'pm2 warning'])
          ? 'Warning'
          : 'OK'
    },
    {
      key: 'disk',
      label: 'Disk',
      status: hasAny(allText, ['disk check is unavailable', 'disk check is error'])
        ? 'Unavailable'
        : hasAny(allText, ['disk usage is high', 'disk warning', 'review disk'])
          ? 'Warning'
          : 'OK'
    },
    {
      key: 'git',
      label: 'Git',
      status: hasAny(allText, ['git status is unavailable', 'git status is error'])
        ? 'Unavailable'
        : hasAny(allText, ['dirty', 'behind', 'ahead', 'untracked', 'local repo change', 'repo change sets'])
          ? 'Warning'
          : 'OK'
    },
    {
      key: 'logs',
      label: 'Logs',
      status: hasAny(allText, ['log source', 'logs unavailable', 'log paths'])
        ? 'Unavailable'
        : 'OK'
    },
    {
      key: 'health',
      label: 'Health',
      status: healthStatusLabel(brief.health)
    }
  ];

  return signalStatuses;
}

export function isImportantOperatorRecommendation(recommendation: string): boolean {
  return hasAny([recommendation], [
    'before deploy',
    'before deploy or pull',
    'before cleanup',
    'pull only after',
    'pm2 process status',
    'health endpoints',
    'disk mounts'
  ]);
}
