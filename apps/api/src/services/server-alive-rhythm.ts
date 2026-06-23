import {
  serverAliveRhythmSummarySchema,
  type ServerAliveRhythmDay,
  type ServerAliveRhythmDayPattern,
  type ServerAliveRhythmPeriod,
  type ServerAliveRhythmSummary
} from '@gameops/shared';
import {
  getDailyPlayerEngagementRollupsForServer,
  type DailyPlayerEngagementRollup
} from './player-engagement-rollup-store.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

interface DailyAggregate {
  date: string;
  dayOfWeek: string;
  sessions: number;
  trackedSeconds: number;
  playerIds: Set<string>;
  lowConfidenceSessions: number;
  inferredSessions: number;
}

interface HourlyAggregate {
  hourUtc: number;
  sessions: number;
  trackedSeconds: number;
  lowConfidenceSessions: number;
  inferredSessions: number;
}

function getDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function shiftUtcDate(date: string, dayDelta: number): string {
  const dateMs = Date.parse(`${date}T00:00:00.000Z`);

  if (!Number.isFinite(dateMs)) {
    return date;
  }

  return getDateString(new Date(dateMs + dayDelta * DAY_MS));
}

function getDayOfWeek(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (!Number.isFinite(parsed.getTime())) {
    return 'Unknown';
  }

  return DAY_NAMES[parsed.getUTCDay()] ?? 'Unknown';
}

function getWindowDates(now: Date, days: number): string[] {
  const endDate = getDateString(now);
  const startDate = shiftUtcDate(endDate, -(days - 1));
  const dates: string[] = [];
  let current = startDate;

  while (current <= endDate) {
    dates.push(current);
    current = shiftUtcDate(current, 1);
  }

  return dates;
}

function createEmptyAggregate(date: string): DailyAggregate {
  return {
    date,
    dayOfWeek: getDayOfWeek(date),
    sessions: 0,
    trackedSeconds: 0,
    playerIds: new Set<string>(),
    lowConfidenceSessions: 0,
    inferredSessions: 0
  };
}

function buildAggregates(rollups: DailyPlayerEngagementRollup[], dates: string[]): DailyAggregate[] {
  const aggregateByDate = new Map(dates.map((date) => [date, createEmptyAggregate(date)]));

  for (const rollup of rollups) {
    const aggregate = aggregateByDate.get(rollup.date);

    if (!aggregate) {
      continue;
    }

    aggregate.sessions += rollup.sessionCount;
    aggregate.trackedSeconds += rollup.trackedSeconds;
    aggregate.playerIds.add(rollup.playerId);
    aggregate.lowConfidenceSessions += rollup.lowConfidenceSessionCount;
    aggregate.inferredSessions += rollup.inferredSessionCount;
  }

  return dates.map((date) => aggregateByDate.get(date) ?? createEmptyAggregate(date));
}

function toDay(aggregate: DailyAggregate): ServerAliveRhythmDay {
  return {
    date: aggregate.date,
    dayOfWeek: aggregate.dayOfWeek,
    sessions: aggregate.sessions,
    trackedSeconds: aggregate.trackedSeconds,
    uniquePlayers: aggregate.playerIds.size
  };
}

function buildPeriod(aggregates: DailyAggregate[]): ServerAliveRhythmPeriod {
  const activeDays = aggregates.filter((day) => day.sessions > 0 || day.trackedSeconds > 0);
  const uniquePlayers = new Set(aggregates.flatMap((day) => Array.from(day.playerIds)));
  const busiestDays = [...activeDays]
    .sort((left, right) => (
      right.trackedSeconds - left.trackedSeconds
      || right.sessions - left.sessions
      || left.date.localeCompare(right.date)
    ))
    .slice(0, 5)
    .map(toDay);
  const quietDays = aggregates
    .filter((day) => day.sessions === 0 && day.trackedSeconds === 0)
    .map(toDay);

  return {
    totalSessions: aggregates.reduce((sum, day) => sum + day.sessions, 0),
    totalTrackedSeconds: aggregates.reduce((sum, day) => sum + day.trackedSeconds, 0),
    uniqueActivePlayers: uniquePlayers.size,
    busiestDays,
    quietDays
  };
}

function getBestDayOfWeekPattern(aggregates: DailyAggregate[]): ServerAliveRhythmDayPattern | null {
  const activeDays = aggregates.filter((day) => day.sessions > 0 || day.trackedSeconds > 0);

  if (activeDays.length < 3) {
    return null;
  }

  const patternByDay = new Map<string, {
    observedDays: number;
    totalSessions: number;
    totalTrackedSeconds: number;
  }>();

  for (const day of activeDays) {
    const current = patternByDay.get(day.dayOfWeek) ?? {
      observedDays: 0,
      totalSessions: 0,
      totalTrackedSeconds: 0
    };

    current.observedDays += 1;
    current.totalSessions += day.sessions;
    current.totalTrackedSeconds += day.trackedSeconds;
    patternByDay.set(day.dayOfWeek, current);
  }

  const [dayOfWeek, pattern] = Array.from(patternByDay.entries())
    .filter(([, value]) => value.observedDays >= 2)
    .sort((left, right) => (
      right[1].totalTrackedSeconds - left[1].totalTrackedSeconds
      || right[1].totalSessions - left[1].totalSessions
      || left[0].localeCompare(right[0])
    ))[0] ?? [];

  if (!dayOfWeek || !pattern) {
    return null;
  }

  return {
    dayOfWeek,
    observedDays: pattern.observedDays,
    totalSessions: pattern.totalSessions,
    totalTrackedSeconds: pattern.totalTrackedSeconds,
    averageSessions: pattern.totalSessions / pattern.observedDays,
    averageTrackedSeconds: pattern.totalTrackedSeconds / pattern.observedDays
  };
}

function getHourlyPattern(rollups: DailyPlayerEngagementRollup[], startDate: string, endDate: string): ServerAliveRhythmSummary['hourlyPattern'] {
  const hourlyByHour = new Map<number, HourlyAggregate>();

  for (const rollup of rollups) {
    if (rollup.date < startDate || rollup.date > endDate) {
      continue;
    }

    for (const bucket of rollup.hourlyBuckets) {
      const current = hourlyByHour.get(bucket.hourUtc) ?? {
        hourUtc: bucket.hourUtc,
        sessions: 0,
        trackedSeconds: 0,
        lowConfidenceSessions: 0,
        inferredSessions: 0
      };

      current.sessions += bucket.sessionStartCount;
      current.trackedSeconds += bucket.trackedSeconds;
      current.lowConfidenceSessions += bucket.lowConfidenceSessionCount;
      current.inferredSessions += bucket.inferredSessionCount;
      hourlyByHour.set(bucket.hourUtc, current);
    }
  }

  const busiestUtcHours = Array.from(hourlyByHour.values())
    .filter((hour) => hour.sessions > 0 || hour.trackedSeconds > 0)
    .sort((left, right) => (
      right.trackedSeconds - left.trackedSeconds
      || right.sessions - left.sessions
      || left.hourUtc - right.hourUtc
    ))
    .slice(0, 3)
    .map((hour) => ({
      hourUtc: hour.hourUtc,
      sessions: hour.sessions,
      trackedSeconds: hour.trackedSeconds
    }));

  if (busiestUtcHours.length === 0) {
    return {
      status: 'unknown',
      busiestUtcHours: [],
      explanation: 'Daily engagement rollups do not have hourly buckets yet.'
    };
  }

  return {
    status: 'available',
    busiestUtcHours,
    explanation: 'Hourly rhythm is based on UTC buckets recorded when sessions close.'
  };
}

function hasWeekdayQuietPattern(aggregates: DailyAggregate[]): boolean {
  const weekdays = aggregates.filter((day) => !['Saturday', 'Sunday'].includes(day.dayOfWeek));
  const weekend = aggregates.filter((day) => ['Saturday', 'Sunday'].includes(day.dayOfWeek));

  if (weekdays.length === 0 || weekend.length === 0) {
    return false;
  }

  const weekdaySessions = weekdays.reduce((sum, day) => sum + day.sessions, 0);
  const weekendSessions = weekend.reduce((sum, day) => sum + day.sessions, 0);

  return weekendSessions >= 3 && weekdaySessions <= Math.max(1, Math.floor(weekendSessions / 3));
}

function buildSummary(input: {
  sevenDays: ServerAliveRhythmPeriod;
  thirtyDays: ServerAliveRhythmPeriod;
  bestPattern: ServerAliveRhythmDayPattern | null;
  thirtyDayAggregates: DailyAggregate[];
}): string {
  if (input.thirtyDays.totalSessions === 0) {
    return 'Not enough history yet.';
  }

  if (input.bestPattern) {
    return `Server is most alive on ${input.bestPattern.dayOfWeek}s.`;
  }

  if (hasWeekdayQuietPattern(input.thirtyDayAggregates)) {
    return 'Weekdays are quiet.';
  }

  const bestDay = input.sevenDays.busiestDays[0] ?? input.thirtyDays.busiestDays[0];

  if (bestDay) {
    return `Most recent activity clustered on ${bestDay.dayOfWeek}.`;
  }

  return 'Not enough history yet.';
}

function buildWarnings(input: {
  rollups: DailyPlayerEngagementRollup[];
  thirtyDayAggregates: DailyAggregate[];
  thirtyDays: ServerAliveRhythmPeriod;
  bestPattern: ServerAliveRhythmDayPattern | null;
  hourlyPattern: ServerAliveRhythmSummary['hourlyPattern'];
}): string[] {
  const warnings: string[] = [];
  const activeDays = input.thirtyDayAggregates.filter((day) => day.sessions > 0 || day.trackedSeconds > 0).length;

  if (input.rollups.length === 0) {
    warnings.push('No daily engagement rollups exist yet.');
  }

  if (activeDays > 0 && activeDays < 3) {
    warnings.push('Engagement history is sparse; rhythm may change as more sessions close.');
  }

  if (input.thirtyDays.totalSessions > 0 && !input.bestPattern) {
    warnings.push('Not enough recurring day-of-week history to identify a reliable pattern.');
  }

  if (input.thirtyDayAggregates.some((day) => day.lowConfidenceSessions > 0 || day.inferredSessions > 0)) {
    warnings.push('Some rhythm totals include low-confidence or inferred sessions.');
  }

  if (input.hourlyPattern.status === 'unknown') {
    warnings.push('Hourly rhythm is unknown because daily engagement rollups do not have per-hour buckets yet.');
  }

  return Array.from(new Set(warnings));
}

export function getServerAliveRhythmSummary(serverId: string, now = new Date()): ServerAliveRhythmSummary {
  const dailyRollups = getDailyPlayerEngagementRollupsForServer(serverId);
  const sevenDayDates = getWindowDates(now, 7);
  const thirtyDayDates = getWindowDates(now, 30);
  const sevenDayAggregates = buildAggregates(dailyRollups, sevenDayDates);
  const thirtyDayAggregates = buildAggregates(dailyRollups, thirtyDayDates);
  const sevenDays = buildPeriod(sevenDayAggregates);
  const thirtyDays = buildPeriod(thirtyDayAggregates);
  const bestPattern = getBestDayOfWeekPattern(thirtyDayAggregates);
  const thirtyDayStartDate = thirtyDayDates[0] ?? getDateString(now);
  const thirtyDayEndDate = thirtyDayDates[thirtyDayDates.length - 1] ?? getDateString(now);
  const hourlyPattern = getHourlyPattern(dailyRollups, thirtyDayStartDate, thirtyDayEndDate);
  const confidenceWarnings = buildWarnings({
    rollups: dailyRollups,
    thirtyDayAggregates,
    thirtyDays,
    bestPattern,
    hourlyPattern
  });

  return serverAliveRhythmSummarySchema.parse({
    serverId,
    generatedAt: now.toISOString(),
    summary: buildSummary({
      sevenDays,
      thirtyDays,
      bestPattern,
      thirtyDayAggregates
    }),
    sevenDays,
    thirtyDays,
    bestDayOfWeekPattern: bestPattern,
    hourlyPattern,
    confidence: confidenceWarnings.length === 0 ? 'high' : thirtyDays.totalSessions === 0 ? 'unknown' : 'medium',
    confidenceWarnings
  });
}
