import {
  playerIntelligenceSummaryResponseSchema,
  type PlayerIntelligenceRecord,
  type PlayerIntelligenceSummaryResponse,
  type PlayerIntelligenceSummaryRow,
  type PlayerIntelligenceSummaryStatus,
  type SessionRecord
} from '@gameops/shared';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const AT_RISK_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

function timestampMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isWithin(value: string | null, now: Date, windowMs: number): boolean {
  const parsed = timestampMs(value);
  return parsed !== null && now.getTime() - parsed <= windowMs;
}

function minutes(seconds: number): number {
  return Math.max(0, Math.floor(seconds / 60));
}

function isAtRisk(player: PlayerIntelligenceRecord, now: Date): boolean {
  const lastSeenMs = timestampMs(player.lastSeenAt);
  return lastSeenMs !== null
    && now.getTime() - lastSeenMs > AT_RISK_AFTER_MS
    && player.sessionCount > 0
    && player.totalTrackedSeconds > 0;
}

function classifyPlayer(player: PlayerIntelligenceRecord, now: Date): PlayerIntelligenceSummaryStatus {
  const activeThisWeek = player.isOnline || isWithin(player.lastSeenAt, now, WEEK_MS);
  const firstSeenThisWeek = isWithin(player.firstSeenAt, now, WEEK_MS);

  if (isAtRisk(player, now)) {
    return 'at_risk';
  }

  if (firstSeenThisWeek) {
    return 'new';
  }

  if (activeThisWeek && player.firstSeenAt) {
    return 'returning';
  }

  if (activeThisWeek) {
    return 'active';
  }

  if (player.lastSeenAt) {
    return 'inactive';
  }

  return 'unknown';
}

function toRow(player: PlayerIntelligenceRecord, now: Date): PlayerIntelligenceSummaryRow {
  return {
    playerId: player.playerId,
    displayName: player.displayName,
    lastSeenAt: player.lastSeenAt,
    firstSeenAt: player.firstSeenAt,
    sessionCount: player.sessionCount,
    totalPlaytimeMinutes: minutes(player.totalTrackedSeconds),
    averageSessionMinutes: minutes(player.averageSessionSeconds),
    status: classifyPlayer(player, now),
    trend: 'unknown'
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findLongestSessionPlayer(
  rowsByNormalizedName: Map<string, PlayerIntelligenceSummaryRow>,
  sessions: SessionRecord[]
): PlayerIntelligenceSummaryRow | null {
  const longest = sessions
    .filter((session) => typeof session.durationSeconds === 'number' && session.durationSeconds > 0)
    .sort((left, right) => (right.durationSeconds ?? 0) - (left.durationSeconds ?? 0))[0] ?? null;

  if (!longest) {
    return null;
  }

  return rowsByNormalizedName.get(normalize(longest.playerName)) ?? null;
}

export function buildPlayerIntelligenceSummary(input: {
  serverId: string;
  now: Date;
  players: PlayerIntelligenceRecord[];
  recentClosedSessions: SessionRecord[];
}): PlayerIntelligenceSummaryResponse {
  const rows = input.players.map((player) => toRow(player, input.now));
  const rowsByNormalizedName = new Map(rows.map((row) => [normalize(row.displayName), row]));
  const activeRows = rows.filter((row) => row.status === 'active' || row.status === 'new' || row.status === 'returning');
  const newRows = rows.filter((row) => row.status === 'new');
  const returningRows = rows.filter((row) => row.status === 'returning');
  const atRiskRows = rows.filter((row) => row.status === 'at_risk')
    .sort((left, right) => right.totalPlaytimeMinutes - left.totalPlaytimeMinutes || (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? ''))
    .slice(0, 5);
  const mostRecentPlayer = [...rows]
    .sort((left, right) => (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? ''))[0] ?? null;
  const topPlayersByPlaytime = [...rows]
    .sort((left, right) => right.totalPlaytimeMinutes - left.totalPlaytimeMinutes || (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? ''))
    .slice(0, 5);

  return playerIntelligenceSummaryResponseSchema.parse({
    serverId: input.serverId,
    generatedAt: input.now.toISOString(),
    totalKnownPlayers: rows.length,
    activePlayersThisWeek: activeRows.length,
    inactivePlayers: rows.filter((row) => row.status === 'inactive' || row.status === 'at_risk').length,
    newPlayersThisWeek: newRows.length,
    returningPlayersThisWeek: returningRows.length,
    mostRecentPlayer,
    longestSessionPlayer: findLongestSessionPlayer(rowsByNormalizedName, input.recentClosedSessions),
    topPlayersByPlaytime,
    playersAtRisk: atRiskRows
  });
}
