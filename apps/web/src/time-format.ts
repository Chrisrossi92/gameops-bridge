export const OPERATOR_TIME_ZONE = 'America/New_York';
export const OPERATOR_TIME_ZONE_LABEL = 'Eastern';

export function formatEasternTimestamp(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATOR_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(date);
}

export function formatEasternShortTimestamp(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATOR_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(date);
}

export function formatEasternClockHourFromUtc(hourUtc: number): string {
  const normalizedHour = Number.isFinite(hourUtc) ? Math.max(0, Math.min(23, Math.floor(hourUtc))) : 0;
  const date = new Date(Date.UTC(2026, 0, 1, normalizedHour, 0, 0));

  return new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATOR_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(date);
}
