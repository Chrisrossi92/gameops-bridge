import {
  playerDetailSessionSchema,
  playerEngagementDetailSchema,
  playerEngagementPlayerSchema,
  playerEngagementSummarySchema,
  type PlayerDetailSession,
  type PlayerEngagementDetail,
  type PlayerEngagementPlayer,
  type PlayerEngagementStatus,
  type PlayerEngagementSummary,
  type PlayerEngagementTrendDirection,
  type PlayerEngagementWindow,
  type PlayerIntelligenceConfidence,
  type PlayerIntelligenceRecord,
  type SessionTimelineItem
} from '@gameops/shared';
import { getDataFreshnessForServer } from './data-freshness.js';
import {
  getDailyPlayerEngagementRollupsForServer,
  type DailyPlayerEngagementRollup
} from './player-engagement-rollup-store.js';
import { getPlayerIntelligenceForServer } from './player-intelligence.js';
import { getCachedResult } from './request-performance.js';
import { getSessionTimelineForServer } from './session-timeline.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY_EXPLANATION = 'No player engagement has been observed yet. Start the connector and wait for sessions to appear.';
const PLAYER_ENGAGEMENT_CACHE_TTL_MS = 15_000;

interface EngagementWindowEntry {
  id: string;
  playerId: string;
  activityAt: string;
  date: string;
  sessionCount: number;
  trackedSeconds: number;
  lowConfidenceCount: number;
  inferredCount: number;
  source: 'daily_rollup' | 'timeline';
}

interface PlayerEngagementTrend {
  trendDirection: PlayerEngagementTrendDirection;
  current7dSessions: number;
  previous7dSessions: number;
  current7dPlaySeconds: number;
  previous7dPlaySeconds: number;
  trendReasons: string[];
  trendConfidenceWarning: string | null;
}

function toMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getActivityAt(session: Pick<SessionTimelineItem, 'startedAt' | 'endedAt'>): string {
  return session.endedAt ?? session.startedAt;
}

function getSessionDurationForWindow(session: SessionTimelineItem, now: Date): number {
  if (!session.isActive) {
    return session.durationSeconds;
  }

  const startedAtMs = toMs(session.startedAt);

  if (startedAtMs === null || now.getTime() <= startedAtMs) {
    return 0;
  }

  return Math.floor((now.getTime() - startedAtMs) / 1000);
}

function isSameUtcDay(value: string, now: Date): boolean {
  const timestamp = new Date(value);

  return Number.isFinite(timestamp.getTime())
    && timestamp.getUTCFullYear() === now.getUTCFullYear()
    && timestamp.getUTCMonth() === now.getUTCMonth()
    && timestamp.getUTCDate() === now.getUTCDate();
}

function getUtcDate(value: string): string | null {
  const timestamp = new Date(value);

  if (!Number.isFinite(timestamp.getTime())) {
    return null;
  }

  return timestamp.toISOString().slice(0, 10);
}

function getCutoffDate(now: Date, windowDays: number): string {
  return new Date(now.getTime() - (windowDays - 1) * DAY_MS).toISOString().slice(0, 10);
}

function shiftUtcDate(date: string, dayDelta: number): string {
  const dateMs = Date.parse(`${date}T00:00:00.000Z`);

  if (!Number.isFinite(dateMs)) {
    return date;
  }

  return new Date(dateMs + dayDelta * DAY_MS).toISOString().slice(0, 10);
}

function getWindowSummary(
  entries: EngagementWindowEntry[],
  predicate: (entry: EngagementWindowEntry) => boolean
): PlayerEngagementWindow {
  const matchingEntries = entries.filter(predicate);
  const uniquePlayers = new Set(matchingEntries.map((entry) => entry.playerId));

  return {
    sessions: matchingEntries.reduce((sum, entry) => sum + entry.sessionCount, 0),
    trackedSeconds: matchingEntries.reduce((sum, entry) => sum + entry.trackedSeconds, 0),
    uniquePlayers: uniquePlayers.size
  };
}

function toEntryFromRollup(rollup: DailyPlayerEngagementRollup): EngagementWindowEntry {
  return {
    id: `daily:${rollup.serverId}:${rollup.date}:${rollup.playerKey}`,
    playerId: rollup.playerId,
    activityAt: rollup.lastSeenAt,
    date: rollup.date,
    sessionCount: rollup.sessionCount,
    trackedSeconds: rollup.trackedSeconds,
    lowConfidenceCount: rollup.lowConfidenceSessionCount,
    inferredCount: rollup.inferredSessionCount,
    source: 'daily_rollup'
  };
}

function toEntryFromTimelineSession(session: SessionTimelineItem, now: Date): EngagementWindowEntry | null {
  const activityAt = getActivityAt(session);
  const date = getUtcDate(activityAt);

  if (!date) {
    return null;
  }

  return {
    id: `timeline:${session.sessionId}`,
    playerId: session.playerId,
    activityAt,
    date,
    sessionCount: 1,
    trackedSeconds: getSessionDurationForWindow(session, now),
    lowConfidenceCount: session.startConfidence === 'low' || session.endConfidence === 'low' ? 1 : 0,
    inferredCount: session.closeReason === 'occupancy_reconciliation' || session.endConfidence === 'low' ? 1 : 0,
    source: 'timeline'
  };
}

function buildWindowEntries(input: {
  dailyRollups: DailyPlayerEngagementRollup[];
  sessions: SessionTimelineItem[];
  now: Date;
}): EngagementWindowEntry[] {
  const processedSessionIds = new Set(input.dailyRollups.flatMap((rollup) => rollup.sourceSessionIds));
  const entries = input.dailyRollups.map(toEntryFromRollup);

  for (const session of input.sessions) {
    if (!session.isActive && processedSessionIds.has(session.sessionId)) {
      continue;
    }

    const entry = toEntryFromTimelineSession(session, input.now);

    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

function getPeakHour(sessions: SessionTimelineItem[]): { hour: number | null; count: number } {
  const counts = new Map<number, number>();

  for (const session of sessions) {
    const date = new Date(session.startedAt);

    if (!Number.isFinite(date.getTime())) {
      continue;
    }

    const hour = date.getUTCHours();
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }

  const [hour, count] = Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])[0] ?? [null, 0];

  return { hour, count };
}

function getReasonForPlayer(player: PlayerIntelligenceRecord, now: Date): string {
  if (player.isOnline) {
    return 'Online now.';
  }

  if (player.sessionCount >= 2) {
    return `${player.sessionCount} tracked sessions.`;
  }

  const lastSeenMs = toMs(player.lastSeenAt);
  if (lastSeenMs !== null) {
    const ageDays = Math.floor((now.getTime() - lastSeenMs) / DAY_MS);

    if (ageDays >= 14) {
      return `Last seen ${ageDays} days ago.`;
    }
  }

  if (player.totalTrackedSeconds > 0) {
    return 'Has tracked playtime.';
  }

  return 'Seen by connector activity.';
}

function toEngagementPlayer(player: PlayerIntelligenceRecord, now: Date): PlayerEngagementPlayer {
  return playerEngagementPlayerSchema.parse({
    playerId: player.playerId,
    displayName: player.displayName,
    isOnline: player.isOnline,
    lastSeenAt: player.lastSeenAt,
    firstSeenAt: player.firstSeenAt,
    sessionCount: player.sessionCount,
    totalTrackedSeconds: player.totalTrackedSeconds,
    averageSessionSeconds: player.averageSessionSeconds,
    confidence: player.identityConfidence,
    reason: getReasonForPlayer(player, now)
  });
}

function getRecentPlayers(players: PlayerIntelligenceRecord[], now: Date): PlayerEngagementPlayer[] {
  return players
    .filter((player) => Boolean(player.lastSeenAt))
    .sort((left, right) => (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? ''))
    .slice(0, 8)
    .map((player) => toEngagementPlayer(player, now));
}

function getReturningPlayers(players: PlayerIntelligenceRecord[], now: Date): PlayerEngagementPlayer[] {
  return players
    .filter((player) => player.sessionCount >= 2 || (player.totalTrackedSeconds > 0 && player.isOnline))
    .sort((left, right) => {
      if ((right.lastSeenAt ?? '') !== (left.lastSeenAt ?? '')) {
        return (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? '');
      }

      return right.sessionCount - left.sessionCount;
    })
    .slice(0, 8)
    .map((player) => toEngagementPlayer(player, now));
}

function getHighEngagementPlayers(players: PlayerIntelligenceRecord[], now: Date): PlayerEngagementPlayer[] {
  return players
    .filter((player) => player.totalTrackedSeconds > 0 || player.sessionCount > 0 || player.isOnline)
    .sort((left, right) => {
      if (right.totalTrackedSeconds !== left.totalTrackedSeconds) {
        return right.totalTrackedSeconds - left.totalTrackedSeconds;
      }

      return right.sessionCount - left.sessionCount;
    })
    .slice(0, 8)
    .map((player) => toEngagementPlayer(player, now));
}

function getInactivePlayers(players: PlayerIntelligenceRecord[], now: Date): PlayerEngagementPlayer[] {
  const enoughData = players.filter((player) => player.lastSeenAt).length >= 2;

  if (!enoughData) {
    return [];
  }

  return players
    .filter((player) => {
      if (player.isOnline || !player.lastSeenAt) {
        return false;
      }

      const lastSeenMs = toMs(player.lastSeenAt);
      return lastSeenMs !== null
        && now.getTime() - lastSeenMs >= 14 * DAY_MS
        && (player.sessionCount > 0 || player.totalTrackedSeconds > 0);
    })
    .sort((left, right) => (left.lastSeenAt ?? '').localeCompare(right.lastSeenAt ?? ''))
    .slice(0, 8)
    .map((player) => toEngagementPlayer(player, now));
}

function pickConfidence(
  freshnessConfidence: PlayerIntelligenceConfidence,
  players: PlayerIntelligenceRecord[]
): PlayerIntelligenceConfidence {
  if (freshnessConfidence === 'unknown' || freshnessConfidence === 'low') {
    return 'low';
  }

  if (players.some((player) => player.identityConfidence === 'unknown' || player.identityConfidence === 'low')) {
    return 'low';
  }

  if (players.some((player) => player.identityConfidence === 'medium')) {
    return 'medium';
  }

  return freshnessConfidence;
}

function buildWarnings(input: {
  freshnessStatus: string;
  freshnessWarnings: string[];
  freshnessHeadline: string;
  players: PlayerIntelligenceRecord[];
  sessions: SessionTimelineItem[];
  windowEntries: EngagementWindowEntry[];
  dailyRollupCount: number;
}): string[] {
  const warnings = [...input.freshnessWarnings];

  if (input.freshnessStatus !== 'live') {
    warnings.push(input.freshnessHeadline);
  }

  if (input.players.some((player) => player.identityConfidence === 'unknown' || player.identityConfidence === 'low')) {
    warnings.push('Some player identities are low confidence.');
  }

  if (input.sessions.some((session) => session.startConfidence === 'low' || session.endConfidence === 'low')) {
    warnings.push('Some session starts or ends are inferred.');
  }

  if (input.windowEntries.some((entry) => entry.lowConfidenceCount > 0 || entry.inferredCount > 0)) {
    warnings.push('Some daily engagement totals include low-confidence or inferred sessions.');
  }

  if (input.dailyRollupCount > 0) {
    warnings.push('7d/30d engagement includes persisted daily rollups.');
  }

  if (input.sessions.length === 0 && input.players.length > 0) {
    warnings.push('Player history exists, but recent session detail is limited.');
  }

  return Array.from(new Set(warnings));
}

function getHeadline(activeCount: number, todaySessions: number, playerCount: number): string {
  if (playerCount === 0) {
    return 'No engagement tracked yet';
  }

  if (activeCount > 0) {
    return `${activeCount} player${activeCount === 1 ? '' : 's'} online now`;
  }

  if (todaySessions > 0) {
    return `${todaySessions} session${todaySessions === 1 ? '' : 's'} tracked today`;
  }

  return 'Player history is available';
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isPlayerMatch(player: PlayerIntelligenceRecord, lookup: string): boolean {
  const normalizedLookup = normalize(lookup);

  return normalize(player.playerId) === normalizedLookup
    || normalize(player.displayName) === normalizedLookup
    || player.aliases.some((alias) => normalize(alias) === normalizedLookup);
}

function sessionMatchesPlayer(session: SessionTimelineItem, player: PlayerIntelligenceRecord): boolean {
  const observedName = normalize(session.observedName);

  return session.playerId === player.playerId
    || observedName === normalize(player.displayName)
    || player.aliases.some((alias) => normalize(alias) === observedName);
}

function rollupMatchesPlayer(rollup: DailyPlayerEngagementRollup, player: PlayerIntelligenceRecord): boolean {
  const playerNames = [player.displayName, ...player.aliases].map(normalize);

  return rollup.playerId === player.playerId
    || playerNames.includes(rollup.playerKey)
    || playerNames.includes(normalize(rollup.displayName));
}

function getWindowSummaryForPlayer(input: {
  entries: EngagementWindowEntry[];
  playerId: string;
  playerNames: string[];
  predicate: (entry: EngagementWindowEntry) => boolean;
}): PlayerEngagementWindow {
  const names = new Set(input.playerNames.map(normalize));
  const matchingEntries = input.entries.filter((entry) => (
    input.predicate(entry)
    && (entry.playerId === input.playerId || names.has(normalize(entry.playerId)))
  ));

  return {
    sessions: matchingEntries.reduce((sum, entry) => sum + entry.sessionCount, 0),
    trackedSeconds: matchingEntries.reduce((sum, entry) => sum + entry.trackedSeconds, 0),
    uniquePlayers: matchingEntries.length > 0 ? 1 : 0
  };
}

function getRollupWindowSummary(
  rollups: DailyPlayerEngagementRollup[],
  startDate: string,
  endDate: string
): { sessions: number; trackedSeconds: number; hasLowConfidence: boolean } {
  const matchingRollups = rollups.filter((rollup) => rollup.date >= startDate && rollup.date <= endDate);

  return {
    sessions: matchingRollups.reduce((sum, rollup) => sum + rollup.sessionCount, 0),
    trackedSeconds: matchingRollups.reduce((sum, rollup) => sum + rollup.trackedSeconds, 0),
    hasLowConfidence: matchingRollups.some((rollup) => rollup.lowConfidenceSessionCount > 0 || rollup.inferredSessionCount > 0)
  };
}

function getRelativeDelta(current: number, previous: number): number {
  if (previous <= 0) {
    return current > 0 ? Number.POSITIVE_INFINITY : 0;
  }

  return (current - previous) / previous;
}

function getPlayerEngagementTrend(rollups: DailyPlayerEngagementRollup[], now: Date): PlayerEngagementTrend {
  const currentStartDate = getCutoffDate(now, 7);
  const currentEndDate = now.toISOString().slice(0, 10);
  const previousEndDate = shiftUtcDate(currentStartDate, -1);
  const previousStartDate = shiftUtcDate(previousEndDate, -6);
  const current = getRollupWindowSummary(rollups, currentStartDate, currentEndDate);
  const previous = getRollupWindowSummary(rollups, previousStartDate, previousEndDate);
  const hasPreviousData = previous.sessions > 0 || previous.trackedSeconds > 0;

  if (!hasPreviousData) {
    return {
      trendDirection: 'unknown',
      current7dSessions: current.sessions,
      previous7dSessions: previous.sessions,
      current7dPlaySeconds: current.trackedSeconds,
      previous7dPlaySeconds: previous.trackedSeconds,
      trendReasons: ['Unknown - not enough tracked history yet.'],
      trendConfidenceWarning: 'Not enough daily rollup history exists to compare this week with the previous 7 days.'
    };
  }

  const playtimeDelta = getRelativeDelta(current.trackedSeconds, previous.trackedSeconds);
  const sessionDelta = current.sessions - previous.sessions;
  const steady = Math.abs(playtimeDelta) <= 0.2 && Math.abs(sessionDelta) <= 1;
  const reasons: string[] = [];
  let trendDirection: PlayerEngagementTrendDirection = 'steady';

  if (steady) {
    reasons.push('Steady - similar activity across both weeks.');
  } else if (playtimeDelta > 0.2 || sessionDelta >= 2) {
    trendDirection = 'up';

    if (playtimeDelta > 0.2) {
      reasons.push('Up this week - more tracked playtime than the previous 7 days.');
    }

    if (sessionDelta >= 2) {
      reasons.push('More tracked sessions than the previous 7 days.');
    }
  } else if (playtimeDelta < -0.2 || sessionDelta <= -2) {
    trendDirection = 'down';

    if (sessionDelta <= -2) {
      reasons.push('Down this week - fewer sessions than the previous 7 days.');
    }

    if (playtimeDelta < -0.2) {
      reasons.push('Less tracked playtime than the previous 7 days.');
    }
  }

  if (reasons.length === 0) {
    reasons.push('Steady - similar activity across both weeks.');
  }

  return {
    trendDirection,
    current7dSessions: current.sessions,
    previous7dSessions: previous.sessions,
    current7dPlaySeconds: current.trackedSeconds,
    previous7dPlaySeconds: previous.trackedSeconds,
    trendReasons: reasons,
    trendConfidenceWarning: current.hasLowConfidence || previous.hasLowConfidence
      ? 'Trend includes low-confidence or inferred daily rollup sessions.'
      : null
  };
}

function getStatus(player: PlayerIntelligenceRecord, now: Date): PlayerEngagementStatus {
  if (player.isOnline) {
    return 'active_now';
  }

  const lastSeenMs = toMs(player.lastSeenAt);

  if (lastSeenMs === null) {
    return 'unknown';
  }

  const ageDays = Math.floor((now.getTime() - lastSeenMs) / DAY_MS);

  if (ageDays <= 7) {
    return 'recently_active';
  }

  if (ageDays <= 14) {
    return 'fading';
  }

  return 'inactive';
}

function getStatusLabel(status: PlayerEngagementStatus): string {
  switch (status) {
    case 'active_now':
      return 'Active now';
    case 'recently_active':
      return 'Recently active';
    case 'fading':
      return 'Fading';
    case 'inactive':
      return 'Inactive';
    case 'unknown':
      return 'Unknown';
  }
}

function toDetailSession(session: SessionTimelineItem): PlayerDetailSession {
  return playerDetailSessionSchema.parse({
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSeconds: session.durationSeconds,
    closeReason: session.closeReason,
    startConfidence: session.startConfidence,
    endConfidence: session.endConfidence,
    observedName: session.observedName,
    explanation: session.explanation
  });
}

function buildWhyTheyMatter(input: {
  player: PlayerIntelligenceRecord;
  status: PlayerEngagementStatus;
  sevenDays: PlayerEngagementWindow;
  thirtyDays: PlayerEngagementWindow;
}): string[] {
  const notes: string[] = [];

  if (input.status === 'active_now') {
    notes.push('They are online right now, so their session may affect current server activity.');
  }

  if (input.player.sessionCount >= 2) {
    notes.push(`They came back across ${input.player.sessionCount} tracked sessions.`);
  }

  if (input.sevenDays.trackedSeconds > 0) {
    notes.push(`They have ${input.sevenDays.sessions} tracked session${input.sevenDays.sessions === 1 ? '' : 's'} in the last 7 days.`);
  }

  if (input.thirtyDays.trackedSeconds > 0 && input.sevenDays.trackedSeconds === 0) {
    notes.push('They have tracked playtime in the last 30 days, but not in the last 7 days.');
  }

  if (input.status === 'fading') {
    notes.push('They were active recently, but have not been seen this week.');
  }

  if (input.status === 'inactive') {
    notes.push('They have not been seen for at least two weeks.');
  }

  if (input.player.totalTrackedSeconds > 0) {
    notes.push(`GameOps has tracked ${Math.floor(input.player.totalTrackedSeconds / 60)} minutes of playtime for them.`);
  }

  return notes.length > 0 ? notes : ['GameOps has limited engagement evidence for this player so far.'];
}

function buildConfidenceWarnings(input: {
  player: PlayerIntelligenceRecord;
  sessions: SessionTimelineItem[];
  rollups: DailyPlayerEngagementRollup[];
}): string[] {
  const warnings: string[] = [];

  if (input.player.identityConfidence === 'unknown' || input.player.identityConfidence === 'low') {
    warnings.push('Player identity is low confidence.');
  }

  if (input.sessions.some((session) => session.startConfidence === 'low' || session.endConfidence === 'low')) {
    warnings.push('Some recent sessions are low confidence or inferred.');
  }

  if (input.rollups.some((rollup) => rollup.lowConfidenceSessionCount > 0 || rollup.inferredSessionCount > 0)) {
    warnings.push('Some daily rollup totals include low-confidence or inferred sessions.');
  }

  if (input.sessions.length === 0 && input.rollups.length > 0) {
    warnings.push('Recent session detail is limited; daily rollups preserve the totals.');
  }

  return Array.from(new Set(warnings));
}

function buildEvidenceNotes(input: {
  player: PlayerIntelligenceRecord;
  sessions: SessionTimelineItem[];
  rollups: DailyPlayerEngagementRollup[];
}): string[] {
  const notes = new Set<string>();

  for (const source of input.player.sourceSummary) {
    notes.add(`Seen from ${source}.`);
  }

  if (input.sessions.length > 0) {
    notes.add(`${input.sessions.length} recent session${input.sessions.length === 1 ? '' : 's'} are available for review.`);
  }

  if (input.rollups.length > 0) {
    notes.add(`${input.rollups.length} daily engagement rollup${input.rollups.length === 1 ? '' : 's'} contribute to 7d/30d totals.`);
  }

  if (input.player.aliases.length > 0) {
    notes.add(`Also seen as ${input.player.aliases.slice(0, 4).join(', ')}.`);
  }

  return Array.from(notes).slice(0, 8);
}

export function getPlayerEngagementDetailForServer(serverId: string, playerId: string, now = new Date()): PlayerEngagementDetail | null {
  const lookup = decodeURIComponent(playerId).trim();

  if (!lookup) {
    return null;
  }

  const intelligence = getPlayerIntelligenceForServer(serverId);
  const player = intelligence.players.find((candidate) => isPlayerMatch(candidate, lookup)) ?? null;

  if (!player) {
    return null;
  }

  const timeline = getSessionTimelineForServer(serverId, 100);
  const dailyRollups = getDailyPlayerEngagementRollupsForServer(serverId);
  const playerSessions = timeline.sessions
    .filter((session) => sessionMatchesPlayer(session, player))
    .sort((left, right) => getActivityAt(right).localeCompare(getActivityAt(left)));
  const playerRollups = dailyRollups.filter((rollup) => rollupMatchesPlayer(rollup, player));
  const windowEntries = buildWindowEntries({
    dailyRollups: playerRollups,
    sessions: playerSessions,
    now
  });
  const playerNames = [player.displayName, ...player.aliases, player.playerId];
  const sevenDayCutoff = getCutoffDate(now, 7);
  const thirtyDayCutoff = getCutoffDate(now, 30);
  const currentDate = now.toISOString().slice(0, 10);
  const sevenDays = getWindowSummaryForPlayer({
    entries: windowEntries,
    playerId: player.playerId,
    playerNames,
    predicate: (entry) => entry.date >= sevenDayCutoff && entry.date <= currentDate
  });
  const thirtyDays = getWindowSummaryForPlayer({
    entries: windowEntries,
    playerId: player.playerId,
    playerNames,
    predicate: (entry) => entry.date >= thirtyDayCutoff && entry.date <= currentDate
  });
  const trend = getPlayerEngagementTrend(playerRollups, now);
  const status = getStatus(player, now);
  const confidenceWarnings = buildConfidenceWarnings({
    player,
    sessions: playerSessions,
    rollups: playerRollups
  });

  return playerEngagementDetailSchema.parse({
    serverId,
    playerId: player.playerId,
    displayName: player.displayName,
    status,
    statusLabel: getStatusLabel(status),
    whyTheyMatter: buildWhyTheyMatter({
      player,
      status,
      sevenDays,
      thirtyDays
    }),
    firstSeenAt: player.firstSeenAt,
    lastSeenAt: player.lastSeenAt,
    totalSessions: player.sessionCount,
    totalTrackedSeconds: player.totalTrackedSeconds,
    averageSessionSeconds: player.averageSessionSeconds,
    sevenDays,
    thirtyDays,
    trendDirection: trend.trendDirection,
    current7dSessions: trend.current7dSessions,
    previous7dSessions: trend.previous7dSessions,
    current7dPlaySeconds: trend.current7dPlaySeconds,
    previous7dPlaySeconds: trend.previous7dPlaySeconds,
    trendReasons: trend.trendReasons,
    trendConfidenceWarning: trend.trendConfidenceWarning,
    recentSessions: playerSessions.slice(0, 8).map(toDetailSession),
    confidence: confidenceWarnings.length > 0
      ? (player.identityConfidence === 'high' ? 'medium' : player.identityConfidence)
      : player.identityConfidence,
    confidenceWarnings,
    evidenceNotes: buildEvidenceNotes({
      player,
      sessions: playerSessions,
      rollups: playerRollups
    })
  });
}

function computePlayerEngagementSummaryForServer(serverId: string, now = new Date()): PlayerEngagementSummary {
  const generatedAt = now.toISOString();
  const intelligence = getPlayerIntelligenceForServer(serverId);
  const timeline = getSessionTimelineForServer(serverId, 100);
  const dailyRollups = getDailyPlayerEngagementRollupsForServer(serverId);
  const freshness = getDataFreshnessForServer(serverId, now);
  const players = intelligence.players;
  const activePlayers = players.filter((player) => player.isOnline);
  const windowEntries = buildWindowEntries({
    dailyRollups,
    sessions: timeline.sessions,
    now
  });
  const peakHour = getPeakHour(timeline.sessions);
  const today = getWindowSummary(windowEntries, (entry) => isSameUtcDay(entry.activityAt, now));
  const sevenDayCutoff = getCutoffDate(now, 7);
  const thirtyDayCutoff = getCutoffDate(now, 30);
  const currentDate = now.toISOString().slice(0, 10);
  const sevenDays = getWindowSummary(windowEntries, (entry) => entry.date >= sevenDayCutoff && entry.date <= currentDate);
  const thirtyDays = getWindowSummary(windowEntries, (entry) => entry.date >= thirtyDayCutoff && entry.date <= currentDate);
  const confidence = pickConfidence(freshness.confidence, players);
  const lastRollupActivityAt = dailyRollups
    .map((rollup) => rollup.lastSeenAt)
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
  const lastActivityAt = [timeline.summary.lastActivityAt, lastRollupActivityAt]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;

  return playerEngagementSummarySchema.parse({
    serverId,
    generatedAt,
    headline: getHeadline(activePlayers.length, today.sessions, Math.max(players.length, thirtyDays.uniquePlayers)),
    explanation: players.length === 0 && dailyRollups.length === 0
      ? EMPTY_EXPLANATION
      : 'Engagement is calculated from active connector state, recent sessions, stored player rollups, and persisted daily rollups.',
    activity: {
      activeNowCount: activePlayers.length,
      activeNow: activePlayers
        .sort((left, right) => (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? ''))
        .slice(0, 12)
        .map((player) => toEngagementPlayer(player, now)),
      today,
      sevenDays,
      thirtyDays,
      lastActivityAt,
      peakHourUtc: peakHour.hour,
      peakHourSessionCount: peakHour.count
    },
    returningPlayers: getReturningPlayers(players, now),
    mostRecentPlayers: getRecentPlayers(players, now),
    highEngagementPlayers: getHighEngagementPlayers(players, now),
    inactivePlayers: getInactivePlayers(players, now),
    confidence,
    dataWarnings: buildWarnings({
      freshnessStatus: freshness.status,
      freshnessWarnings: freshness.trustWarnings,
      freshnessHeadline: freshness.headline,
      players,
      sessions: timeline.sessions,
      windowEntries,
      dailyRollupCount: dailyRollups.length
    })
  });
}

export function getPlayerEngagementSummaryForServer(serverId: string, now = new Date()): PlayerEngagementSummary {
  return getCachedResult(`player-engagement:${serverId}`, PLAYER_ENGAGEMENT_CACHE_TTL_MS, () => computePlayerEngagementSummaryForServer(serverId, now));
}
