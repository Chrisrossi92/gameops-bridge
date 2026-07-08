import type { ServerSettingsCapabilitySummary } from '@gameops/shared';
import type { GameOpsTone } from '../gameops-v2.tsx';
import type { ServerOption, ServerSummary } from './types.ts';

export function getGameLabel(game: ServerOption['game']): string {
  return game === 'palworld' ? 'Palworld' : 'Valheim';
}

export function getGameSymbol(game: ServerOption['game']): string {
  return game === 'palworld' ? 'P' : 'V';
}

export function getGameOpsToneFromServerState(state: ServerSummary['state'] | undefined): GameOpsTone {
  if (state === 'online') {
    return 'healthy';
  }

  if (state === 'degraded' || state === 'starting' || state === 'stopping' || state === 'restarting') {
    return 'warning';
  }

  if (state === 'offline') {
    return 'offline';
  }

  return 'unknown';
}

export function getGameOpsToneFromOperationTone(tone: 'ok' | 'warning' | 'offline' | 'unknown'): GameOpsTone {
  if (tone === 'ok') {
    return 'healthy';
  }

  return tone;
}

export function normalizePlayerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function formatRelativeTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const elapsedMs = Date.now() - date.getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));

  if (elapsedMinutes < 1) {
    return 'just now';
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 14) {
    return `${elapsedDays}d ago`;
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export function formatDurationFromSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatDurationMaybe(totalSeconds: number | undefined): string {
  if (totalSeconds === undefined || !Number.isFinite(totalSeconds)) {
    return 'N/A';
  }

  return formatDurationFromSeconds(totalSeconds);
}

export function formatCapabilityState(state: ServerSettingsCapabilitySummary['canReadSettings']): string {
  if (state === 'yes') {
    return 'yes';
  }

  if (state === 'no') {
    return 'no';
  }

  return 'needs manual verification';
}

export function formatWritePathStatus(status: ServerSettingsCapabilitySummary['writePathStatus']): string {
  switch (status) {
    case 'not_supported':
      return 'not supported yet';
    case 'possible_needs_validation':
      return 'possible, needs validation';
    case 'blocked_missing_config':
      return 'blocked by missing config';
    case 'unknown':
      return 'needs manual verification';
  }
}

export function getLatestActivityLabel(summary: ServerSummary | undefined): string {
  if (!summary) {
    return 'Loading world activity';
  }

  const latestActivity = summary.activityLog[0]?.description
    ?? summary.recentEvents[0]?.eventType
    ?? summary.serverAliveRhythm.summary;

  return latestActivity || 'No recent activity yet';
}
