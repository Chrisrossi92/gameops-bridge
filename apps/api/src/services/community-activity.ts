import {
  communityActivityResponseSchema,
  type CommunityActivityComparisonMetric,
  type CommunityActivityPlayer,
  type CommunityActivityResponse,
  type CommunityActivitySnapshot,
  type PlayerIntelligenceRecord,
  type SessionTimelineItem
} from '@gameops/shared';
import { getPlayerIntelligenceForServer } from './player-intelligence.js';
import { getCachedResult } from './request-performance.js';
import { getSessionTimelineForServer } from './session-timeline.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MEANINGFUL_RETURN_GAP_DAYS = 2;
const QUIET_PLAYER_DAYS = 14;
const COMMUNITY_ACTIVITY_CACHE_TTL_MS = 15_000;

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

function getDurationSeconds(session: SessionTimelineItem, now: Date): number {
  if (!session.isActive) {
    return session.durationSeconds;
  }

  const startedAtMs = toMs(session.startedAt);

  if (startedAtMs === null || now.getTime() <= startedAtMs) {
    return 0;
  }

  return Math.floor((now.getTime() - startedAtMs) / 1000);
}

function getAgeDays(value: string | null | undefined, now: Date): number | null {
  const timestampMs = toMs(value);

  if (timestampMs === null) {
    return null;
  }

  return Math.max(0, Math.floor((now.getTime() - timestampMs) / DAY_MS));
}

function formatRecentLabel(value: string | null | undefined, now: Date): string {
  const ageDays = getAgeDays(value, now);

  if (ageDays === null) {
    return 'No recent activity time.';
  }

  if (ageDays === 0) {
    return 'Today';
  }

  if (ageDays === 1) {
    return 'Yesterday';
  }

  return `${ageDays} days ago`;
}

function formatReturnedLabel(gapDays: number): string {
  if (gapDays === 1) {
    return 'Returned after 1 day.';
  }

  return `Returned after ${gapDays} days.`;
}

function formatQuietLabel(lastSeenAt: string | null, now: Date): string {
  const ageDays = getAgeDays(lastSeenAt, now);

  if (ageDays === null) {
    return 'Last seen time unknown.';
  }

  if (ageDays === 1) {
    return 'Last seen yesterday.';
  }

  return `Last seen ${ageDays} days ago.`;
}

function toPlayerRow(input: {
  player: Pick<PlayerIntelligenceRecord, 'playerId' | 'displayName' | 'lastSeenAt' | 'sessionCount'>;
  label: string;
  gapDays?: number | null;
}): CommunityActivityPlayer {
  return {
    playerId: input.player.playerId,
    displayName: input.player.displayName,
    lastSeenAt: input.player.lastSeenAt,
    sessionCount: input.player.sessionCount,
    label: input.label,
    gapDays: input.gapDays ?? null
  };
}

function getReturningPlayers(
  players: PlayerIntelligenceRecord[],
  sessions: SessionTimelineItem[]
): CommunityActivityPlayer[] {
  const sessionsByPlayer = new Map<string, SessionTimelineItem[]>();

  for (const session of sessions) {
    const existing = sessionsByPlayer.get(session.playerId) ?? [];
    existing.push(session);
    sessionsByPlayer.set(session.playerId, existing);
  }

  return players
    .map((player) => {
      const playerSessions = (sessionsByPlayer.get(player.playerId) ?? [])
        .sort((left, right) => getActivityAt(right).localeCompare(getActivityAt(left)));
      const newest = playerSessions[0];
      const previous = playerSessions[1];

      if (!newest || !previous) {
        return null;
      }

      const newestStartMs = toMs(newest.startedAt);
      const previousActivityMs = toMs(getActivityAt(previous));

      if (newestStartMs === null || previousActivityMs === null || newestStartMs <= previousActivityMs) {
        return null;
      }

      const gapDays = Math.floor((newestStartMs - previousActivityMs) / DAY_MS);

      if (gapDays < MEANINGFUL_RETURN_GAP_DAYS) {
        return null;
      }

      return toPlayerRow({
        player,
        label: formatReturnedLabel(gapDays),
        gapDays
      });
    })
    .filter((player): player is CommunityActivityPlayer => player !== null)
    .sort((left, right) => (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? '') || (right.gapDays ?? 0) - (left.gapDays ?? 0))
    .slice(0, 6);
}

function getRecentlyActive(players: PlayerIntelligenceRecord[], now: Date): CommunityActivityPlayer[] {
  return players
    .filter((player) => Boolean(player.lastSeenAt))
    .sort((left, right) => (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? ''))
    .slice(0, 8)
    .map((player) => toPlayerRow({
      player,
      label: formatRecentLabel(player.lastSeenAt, now)
    }));
}

function getQuietPlayers(players: PlayerIntelligenceRecord[], now: Date): CommunityActivityPlayer[] {
  const playersWithHistory = players.filter((player) => Boolean(player.lastSeenAt));

  if (playersWithHistory.length < 2) {
    return [];
  }

  return playersWithHistory
    .filter((player) => {
      if (player.isOnline) {
        return false;
      }

      const ageDays = getAgeDays(player.lastSeenAt, now);
      return ageDays !== null && ageDays >= QUIET_PLAYER_DAYS;
    })
    .sort((left, right) => (left.lastSeenAt ?? '').localeCompare(right.lastSeenAt ?? ''))
    .slice(0, 6)
    .map((player) => toPlayerRow({
      player,
      label: formatQuietLabel(player.lastSeenAt, now)
    }));
}

function getWindowSnapshot(sessions: SessionTimelineItem[], now: Date, startMs: number, endMs: number): CommunityActivitySnapshot {
  const matchingSessions = sessions.filter((session) => {
    const activityMs = toMs(getActivityAt(session));
    return activityMs !== null && activityMs >= startMs && activityMs < endMs;
  });
  const totalPlaytimeSeconds = matchingSessions.reduce((sum, session) => sum + getDurationSeconds(session, now), 0);

  return {
    sessionCount: matchingSessions.length,
    uniquePlayers: new Set(matchingSessions.map((session) => session.playerId)).size,
    totalPlaytimeSeconds,
    averageSessionSeconds: matchingSessions.length > 0
      ? Math.floor(totalPlaytimeSeconds / matchingSessions.length)
      : 0
  };
}

function toComparisonMetric(current: number, previous: number): CommunityActivityComparisonMetric {
  return {
    current,
    previous,
    delta: current - previous
  };
}

function getPeakPlayHours(sessions: SessionTimelineItem[], now: Date): CommunityActivityResponse['peakPlayHours'] {
  const startMs = now.getTime() - 30 * DAY_MS;
  const hours = new Map<number, { sessionCount: number; totalPlaytimeSeconds: number }>();

  for (const session of sessions) {
    const startedAtMs = toMs(session.startedAt);

    if (startedAtMs === null || startedAtMs < startMs || startedAtMs > now.getTime()) {
      continue;
    }

    const hourUtc = new Date(session.startedAt).getUTCHours();
    const existing = hours.get(hourUtc) ?? { sessionCount: 0, totalPlaytimeSeconds: 0 };
    existing.sessionCount += 1;
    existing.totalPlaytimeSeconds += getDurationSeconds(session, now);
    hours.set(hourUtc, existing);
  }

  return Array.from(hours.entries())
    .map(([hourUtc, value]) => ({
      hourUtc,
      sessionCount: value.sessionCount,
      totalPlaytimeSeconds: value.totalPlaytimeSeconds
    }))
    .filter((hour) => hour.sessionCount > 0)
    .sort((left, right) => right.sessionCount - left.sessionCount || right.totalPlaytimeSeconds - left.totalPlaytimeSeconds || left.hourUtc - right.hourUtc)
    .slice(0, 4);
}

function buildWarnings(input: {
  players: PlayerIntelligenceRecord[];
  sessions: SessionTimelineItem[];
  returningPlayers: CommunityActivityPlayer[];
  peakPlayHours: CommunityActivityResponse['peakPlayHours'];
}): string[] {
  const warnings: string[] = [];

  if (input.sessions.length === 0) {
    warnings.push('No session history is available yet.');
  }

  if (input.players.length > 0 && input.sessions.length < 2) {
    warnings.push('Community history is limited; returning and quiet player lists may be empty.');
  }

  if (input.returningPlayers.length === 0 && input.sessions.length > 0) {
    warnings.push('No player has enough session spacing to count as returning yet.');
  }

  if (input.peakPlayHours.length === 0 && input.sessions.length > 0) {
    warnings.push('Peak play hours need sessions with valid start times.');
  }

  return warnings;
}

function computeCommunityActivityForServer(serverId: string, now = new Date()): CommunityActivityResponse {
  const players = getPlayerIntelligenceForServer(serverId).players;
  const sessions = getSessionTimelineForServer(serverId, 100).sessions;
  const currentEndMs = now.getTime();
  const currentStartMs = currentEndMs - 7 * DAY_MS;
  const previousStartMs = currentStartMs - 7 * DAY_MS;
  const currentSnapshot = getWindowSnapshot(sessions, now, currentStartMs, currentEndMs);
  const previousSnapshot = getWindowSnapshot(sessions, now, previousStartMs, currentStartMs);
  const returningPlayers = getReturningPlayers(players, sessions);
  const recentlyActive = getRecentlyActive(players, now);
  const quietPlayers = getQuietPlayers(players, now);
  const peakPlayHours = getPeakPlayHours(sessions, now);
  const dataWarnings = buildWarnings({ players, sessions, returningPlayers, peakPlayHours });

  return communityActivityResponseSchema.parse({
    serverId,
    generatedAt: now.toISOString(),
    returningPlayers,
    recentlyActive,
    quietPlayers,
    peakPlayHours,
    sevenDaySnapshot: currentSnapshot,
    sevenDayComparison: {
      sessions: toComparisonMetric(currentSnapshot.sessionCount, previousSnapshot.sessionCount),
      uniquePlayers: toComparisonMetric(currentSnapshot.uniquePlayers, previousSnapshot.uniquePlayers),
      totalPlaytimeSeconds: toComparisonMetric(currentSnapshot.totalPlaytimeSeconds, previousSnapshot.totalPlaytimeSeconds)
    },
    explanation: sessions.length === 0
      ? 'Community activity will appear after player sessions are captured.'
      : 'Community activity is derived from observed sessions and player intelligence.',
    dataWarnings
  });
}

export function getCommunityActivityForServer(serverId: string, now = new Date()): CommunityActivityResponse {
  return getCachedResult(`community-activity:${serverId}`, COMMUNITY_ACTIVITY_CACHE_TTL_MS, () => computeCommunityActivityForServer(serverId, now));
}
