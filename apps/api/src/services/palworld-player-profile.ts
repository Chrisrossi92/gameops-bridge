import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import {
  type PalworldMilestoneFeedEntry,
  type PalworldMilestoneSignal,
  type PalworldPlayerClassification,
  type PalworldPlayerImpactLevel,
  palworldPlayerProfileSessionSummarySchema,
  palworldUnifiedPlayerProfileSchema,
  type PalworldApprovedIdentity,
  type PalworldLatestPlayerTelemetry,
  type PalworldLevelTier,
  type PalworldPlayerProfileSessionSummary,
  type PalworldRejectedIdentity,
  type PalworldSessionTier,
  type PalworldUnifiedPlayerProfile,
  type SessionRecord
} from '@gameops/shared';
import { z } from 'zod';
import { listPalworldIdentityApprovals } from './palworld-identity-approvals.js';
import { getLatestPalworldPlayerForServer, getLatestPalworldPlayersForServer } from './palworld-telemetry-store.js';
import { getActiveSessionsForServer, getRecentClosedSessionsForServer } from './event-store.js';

const rawPlayerFileSchema = z.object({
  path: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  modifiedAt: z.string().datetime(),
  exists: z.boolean(),
  playerFileName: z.string().min(1),
  playerSaveId: z.string().min(1),
  parseStatus: z.object({
    status: z.string().min(1)
  }).passthrough()
}).passthrough();

const rawPlayersSummarySchema = z.object({
  playerFiles: z.array(rawPlayerFileSchema).default([])
});

const rawGuildSummarySchema = z.object({
  guildName: z.string().nullable().optional(),
  guildId: z.string().nullable().optional(),
  memberCount: z.number().int().min(0).nullable().optional(),
  members: z.array(z.string()).default([])
});

const rawGuildsSummarySchema = z.array(rawGuildSummarySchema);
const GUILDS_SUMMARY_PATH = '/var/backups/gameops/palworld-parse-output/latest/guilds-summary.json';
const MIN_MEANINGFUL_SESSION_DURATION_SECONDS = 60;
const PLAYTIME_WINDOW_24H_MS = 24 * 60 * 60 * 1000;
const PLAYTIME_WINDOW_7D_MS = 7 * PLAYTIME_WINDOW_24H_MS;
const PLAYTIME_WINDOW_30D_MS = 30 * PLAYTIME_WINDOW_24H_MS;

function resolvePlayersSummaryPath(): string {
  const rawPath = process.env.PALWORLD_PLAYERS_SUMMARY_PATH ?? '../players-summary.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getProfileSessionMatchKeys(profile: PalworldUnifiedPlayerProfile): string[] {
  return [
    profile.lookupKey ?? '',
    profile.playerId,
    profile.userId ?? '',
    profile.accountName ?? '',
    profile.playerName ?? ''
  ].map(normalize).filter(Boolean);
}

function isSessionForProfile(sessionPlayerName: string, profile: PalworldUnifiedPlayerProfile): boolean {
  const normalizedSessionPlayerName = normalize(sessionPlayerName);

  if (!normalizedSessionPlayerName) {
    return false;
  }

  return getProfileSessionMatchKeys(profile).includes(normalizedSessionPlayerName);
}

function getDurationSecondsSince(startedAt: string): number | null {
  const startedAtMs = new Date(startedAt).getTime();

  if (!Number.isFinite(startedAtMs)) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
}

function getProfileIdentityKey(profile: PalworldPlayerProfileSessionSummary): string {
  return [
    profile.profile.userId,
    profile.accountName,
    profile.playerName,
    profile.playerId
  ].map((value) => normalize(value ?? '')).find(Boolean) ?? normalize(profile.playerId);
}

function compareProfileQuality(
  left: PalworldPlayerProfileSessionSummary,
  right: PalworldPlayerProfileSessionSummary
): number {
  const trackedDelta = right.recentTrackedSeconds - left.recentTrackedSeconds;

  if (trackedDelta !== 0) {
    return trackedDelta;
  }

  return (right.profile.level ?? -1) - (left.profile.level ?? -1);
}

function getSessionMergeKey(session: SessionRecord): string {
  return [
    session.serverId,
    normalize(session.playerName),
    session.startedAt,
    session.endedAt ?? '',
    String(session.durationSeconds ?? 0)
  ].join('::');
}

function getSessionSortTimestamp(session: SessionRecord): string {
  return session.endedAt ?? session.startedAt;
}

function getSessionDurationSeconds(session: SessionRecord): number {
  if (typeof session.durationSeconds === 'number' && Number.isFinite(session.durationSeconds)) {
    return Math.max(0, Math.floor(session.durationSeconds));
  }

  const startedAtMs = Date.parse(session.startedAt);
  const endedAtMs = session.endedAt ? Date.parse(session.endedAt) : Number.NaN;

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs) || endedAtMs <= startedAtMs) {
    return 0;
  }

  return Math.floor((endedAtMs - startedAtMs) / 1000);
}

function getSessionWindowSeconds(session: SessionRecord, windowStartMs: number, nowMs: number): number {
  const durationSeconds = getSessionDurationSeconds(session);

  if (durationSeconds <= 0) {
    return 0;
  }

  const startedAtMs = Date.parse(session.startedAt);
  const endedAtMs = session.endedAt
    ? Date.parse(session.endedAt)
    : Number.isFinite(startedAtMs)
      ? startedAtMs + durationSeconds * 1000
      : Number.NaN;

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs) || endedAtMs <= windowStartMs) {
    return 0;
  }

  const overlapStartMs = Math.max(startedAtMs, windowStartMs);
  const overlapEndMs = Math.min(endedAtMs, nowMs);

  if (overlapEndMs <= overlapStartMs) {
    return 0;
  }

  return Math.min(durationSeconds, Math.floor((overlapEndMs - overlapStartMs) / 1000));
}

function getTrackedSecondsForWindow(sessions: SessionRecord[], nowMs: number, windowMs: number): number {
  const windowStartMs = nowMs - windowMs;
  return sessions.reduce((sum, session) => sum + getSessionWindowSeconds(session, windowStartMs, nowMs), 0);
}

function getLastSession(sessions: SessionRecord[]): SessionRecord | null {
  return [...sessions].sort((left, right) => getSessionSortTimestamp(right).localeCompare(getSessionSortTimestamp(left)))[0] ?? null;
}

function getSessionPlaytimeWindows(sessions: SessionRecord[], nowMs: number) {
  const lastSession = getLastSession(sessions);

  return {
    trackedSeconds24h: getTrackedSecondsForWindow(sessions, nowMs, PLAYTIME_WINDOW_24H_MS),
    trackedSeconds7d: getTrackedSecondsForWindow(sessions, nowMs, PLAYTIME_WINDOW_7D_MS),
    trackedSeconds30d: getTrackedSecondsForWindow(sessions, nowMs, PLAYTIME_WINDOW_30D_MS),
    lastSessionDurationSeconds: lastSession ? getSessionDurationSeconds(lastSession) : null,
    lastSessionEndedAt: lastSession?.endedAt ?? null
  };
}

function mergeRecentSessions(profiles: PalworldPlayerProfileSessionSummary[]): SessionRecord[] {
  const sessionsByKey = new Map<string, SessionRecord>();

  for (const profile of profiles) {
    for (const session of profile.recentSessions) {
      sessionsByKey.set(getSessionMergeKey(session), session);
    }
  }

  return Array.from(sessionsByKey.values())
    .sort((left, right) => getSessionSortTimestamp(right).localeCompare(getSessionSortTimestamp(left)));
}

function consolidateProfileSessionSummaries(
  profiles: PalworldPlayerProfileSessionSummary[]
): PalworldPlayerProfileSessionSummary[] {
  const profilesByIdentity = new Map<string, PalworldPlayerProfileSessionSummary[]>();

  for (const profile of profiles) {
    const identityKey = getProfileIdentityKey(profile);
    const existing = profilesByIdentity.get(identityKey) ?? [];
    existing.push(profile);
    profilesByIdentity.set(identityKey, existing);
  }

  return Array.from(profilesByIdentity.values()).map((group) => {
    const primary = [...group].sort(compareProfileQuality)[0]!;
    const mergedSessions = mergeRecentSessions(group);
    const playtimeWindows = getSessionPlaytimeWindows(mergedSessions, Date.now());
    const inferredGuildName = primary.inferredGuildName ?? group.find((profile) => profile.inferredGuildName)?.inferredGuildName ?? null;
    const currentSessionDurations = group
      .map((profile) => profile.currentSessionDurationSeconds)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    return palworldPlayerProfileSessionSummarySchema.parse({
      ...primary,
      isOnline: group.some((profile) => profile.isOnline),
      activeSessionStartedAt: primary.activeSessionStartedAt ?? group.find((profile) => profile.activeSessionStartedAt)?.activeSessionStartedAt ?? null,
      currentSessionDurationSeconds: currentSessionDurations.length > 0 ? Math.max(...currentSessionDurations) : null,
      recentTrackedSeconds: mergedSessions.reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0),
      ...playtimeWindows,
      recentSessions: mergedSessions.slice(0, 10),
      saveArtifact: primary.saveArtifact,
      inferredGuildName
    });
  });
}

function isPlaceholderGuildName(value: string | null | undefined): boolean {
  const normalized = value ? normalize(value) : '';
  return !normalized || normalized === 'unknown' || normalized === 'unknown guild' || normalized === 'unnamed guild';
}

function isSamePlayer(left: PalworldLatestPlayerTelemetry, right: PalworldLatestPlayerTelemetry): boolean {
  const leftKeys = [
    left.lookupKey,
    left.playerId ?? '',
    left.userId ?? '',
    left.accountName ?? '',
    left.playerName ?? ''
  ].map(normalize).filter(Boolean);
  const rightKeys = [
    right.lookupKey,
    right.playerId ?? '',
    right.userId ?? '',
    right.accountName ?? '',
    right.playerName ?? ''
  ].map(normalize).filter(Boolean);

  return leftKeys.some((key) => rightKeys.includes(key));
}

function getSessionTier(currentSessionDurationSeconds: number | null | undefined): PalworldSessionTier | null {
  if (typeof currentSessionDurationSeconds !== 'number' || !Number.isFinite(currentSessionDurationSeconds)) {
    return null;
  }

  if (currentSessionDurationSeconds < 30 * 60) {
    return 'short';
  }

  if (currentSessionDurationSeconds < 2 * 60 * 60) {
    return 'active';
  }

  if (currentSessionDurationSeconds < 4 * 60 * 60) {
    return 'grinding';
  }

  return 'marathon';
}

function getLevelTier(level: number | null | undefined): PalworldLevelTier | null {
  if (typeof level !== 'number' || !Number.isFinite(level)) {
    return null;
  }

  if (level < 10) {
    return 'new';
  }

  if (level < 40) {
    return 'mid';
  }

  if (level < 60) {
    return 'high';
  }

  return 'elite';
}

function getOnlineRank(
  telemetry: PalworldLatestPlayerTelemetry,
  onlinePlayers: PalworldLatestPlayerTelemetry[],
  getMetric: (player: PalworldLatestPlayerTelemetry) => number
): number | null {
  if (!telemetry.isOnline) {
    return null;
  }

  const rankedPlayers = onlinePlayers
    .slice()
    .sort((left, right) => {
      const metricDelta = getMetric(right) - getMetric(left);
      if (metricDelta !== 0) {
        return metricDelta;
      }

      return right.lastSeenAt.localeCompare(left.lastSeenAt);
    });
  const index = rankedPlayers.findIndex((player) => isSamePlayer(player, telemetry));

  return index >= 0 ? index + 1 : null;
}

function loadPlayersSummary(): z.infer<typeof rawPlayersSummarySchema> {
  const path = resolvePlayersSummaryPath();

  try {
    return rawPlayersSummarySchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch {
    return rawPlayersSummarySchema.parse({});
  }
}

function loadGuildsSummary(): z.infer<typeof rawGuildsSummarySchema> {
  try {
    return rawGuildsSummarySchema.parse(JSON.parse(readFileSync(GUILDS_SUMMARY_PATH, 'utf8')) as unknown);
  } catch {
    return [];
  }
}

function getGuildMemberKeys(guild: z.infer<typeof rawGuildSummarySchema>): string[] {
  return Array.from(new Set(guild.members.map(normalize).filter(Boolean)));
}

function getGuildMatchKey(guild: z.infer<typeof rawGuildSummarySchema>): string {
  const guildName = normalize(guild.guildName ?? '');
  const guildId = normalize(guild.guildId ?? '');
  return guildId || guildName || getGuildMemberKeys(guild).join('|');
}

function selectBestGuildMatch(
  guilds: Array<z.infer<typeof rawGuildSummarySchema>>
): z.infer<typeof rawGuildSummarySchema> | null {
  const uniqueGuilds = Array.from(
    new Map(guilds.map((guild) => [getGuildMatchKey(guild), guild])).values()
  );

  return uniqueGuilds
    .sort((left, right) => {
      const memberDelta = (right.memberCount ?? right.members.length) - (left.memberCount ?? left.members.length);

      if (memberDelta !== 0) {
        return memberDelta;
      }

      return (left.guildName ?? '').localeCompare(right.guildName ?? '');
    })[0] ?? null;
}

function toGuildIntelligence(guild: z.infer<typeof rawGuildSummarySchema> | null): {
  likelyGuildName: string | null;
  guildMemberCount: number | null;
} {
  if (!guild) {
    return {
      likelyGuildName: null,
      guildMemberCount: null
    };
  }

  return {
    likelyGuildName: isPlaceholderGuildName(guild.guildName ?? null) ? null : (guild.guildName ?? null),
    guildMemberCount: guild.memberCount ?? guild.members.length
  };
}

function getTelemetryGuildMatchKeys(telemetry: PalworldLatestPlayerTelemetry): string[] {
  return [
    telemetry.playerName ?? '',
    telemetry.accountName ?? '',
    telemetry.playerId ?? '',
    telemetry.lookupKey,
    telemetry.userId ?? ''
  ].map(normalize).filter(Boolean);
}

function isGuildMemberMatch(memberKey: string, playerKeys: string[]): boolean {
  return playerKeys.some((playerKey) => memberKey.includes(playerKey) || playerKey.includes(memberKey));
}

function findMatchingReviewRecord(
  serverId: string,
  telemetry: PalworldLatestPlayerTelemetry
): PalworldApprovedIdentity | PalworldRejectedIdentity | null {
  const approvals = listPalworldIdentityApprovals();
  const matchTargets = [
    telemetry.lookupKey,
    telemetry.playerId ?? '',
    telemetry.userId ?? '',
    telemetry.accountName ?? '',
    telemetry.playerName ?? ''
  ].map(normalize).filter(Boolean);

  const reviewRecords = [
    ...approvals.approvals.filter((entry) => entry.serverId === serverId),
    ...approvals.rejections.filter((entry) => entry.serverId === serverId || entry.serverId === null)
  ];

  return reviewRecords.find((entry) => {
    const entryTargets = [
      entry.telemetryLookupKey ?? '',
      entry.playerId ?? '',
      entry.userId ?? '',
      entry.accountName ?? '',
      entry.playerName ?? ''
    ].map(normalize).filter(Boolean);

    return entryTargets.some((target) => matchTargets.includes(target));
  }) ?? null;
}

function findSaveArtifact(
  telemetry: PalworldLatestPlayerTelemetry,
  reviewRecord: PalworldApprovedIdentity | PalworldRejectedIdentity | null
): {
  present: boolean;
  path: string | null;
  modifiedAt: string | null;
  sizeBytes: number | null;
  parseStatus: string | null;
  savePlayerSaveId: string | null;
  savePlayerFileName: string | null;
} {
  const summary = loadPlayersSummary();
  const preferredKeys = [
    reviewRecord?.savePlayerSaveId ?? '',
    reviewRecord?.savePlayerFileName ?? '',
    telemetry.playerId ?? ''
  ].map(normalize).filter(Boolean);

  const matched = summary.playerFiles.find((entry) => {
    const entryKeys = [entry.playerSaveId, entry.playerFileName].map(normalize);
    return entryKeys.some((key) => preferredKeys.includes(key));
  }) ?? null;

  if (!matched) {
    return {
      present: false,
      path: null,
      modifiedAt: null,
      sizeBytes: null,
      parseStatus: null,
      savePlayerSaveId: reviewRecord?.savePlayerSaveId ?? null,
      savePlayerFileName: reviewRecord?.savePlayerFileName ?? null
    };
  }

  return {
    present: matched.exists,
    path: matched.path,
    modifiedAt: matched.modifiedAt,
    sizeBytes: matched.sizeBytes,
    parseStatus: matched.parseStatus.status,
    savePlayerSaveId: matched.playerSaveId,
    savePlayerFileName: matched.playerFileName
  };
}

function toReviewMetadata(reviewRecord: PalworldApprovedIdentity | PalworldRejectedIdentity | null): {
  state: 'approved' | 'rejected' | 'unresolved';
  savePlayerSaveId: string | null;
  savePlayerFileName: string | null;
  telemetryLookupKey: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  notes: string;
} {
  if (!reviewRecord) {
    return {
      state: 'unresolved',
      savePlayerSaveId: null,
      savePlayerFileName: null,
      telemetryLookupKey: null,
      reviewedAt: null,
      reviewedBy: null,
      notes: ''
    };
  }

  if (reviewRecord.state === 'approved') {
    return {
      state: 'approved',
      savePlayerSaveId: reviewRecord.savePlayerSaveId,
      savePlayerFileName: reviewRecord.savePlayerFileName,
      telemetryLookupKey: reviewRecord.telemetryLookupKey,
      reviewedAt: reviewRecord.approvedAt,
      reviewedBy: reviewRecord.approvedBy,
      notes: reviewRecord.notes
    };
  }

  return {
    state: 'rejected',
    savePlayerSaveId: reviewRecord.savePlayerSaveId,
    savePlayerFileName: reviewRecord.savePlayerFileName,
    telemetryLookupKey: reviewRecord.telemetryLookupKey,
    reviewedAt: reviewRecord.rejectedAt,
    reviewedBy: reviewRecord.rejectedBy,
    notes: reviewRecord.notes
  };
}

function getMilestoneSignals(input: {
  level: number | null;
  levelTier: PalworldLevelTier | null;
  sessionTier: PalworldSessionTier | null;
  onlineRankByLevel: number | null;
  onlineRankBySessionDuration: number | null;
  identityState: 'approved' | 'rejected' | 'unresolved';
}): PalworldMilestoneSignal[] {
  const strength = input.identityState === 'approved' ? 'verified' : 'provisional';
  const signals: PalworldMilestoneSignal[] = [];

  if (input.levelTier === 'elite') {
    signals.push({
      key: 'entered_elite_level_tier',
      label: 'Entered Elite Level Tier',
      reason: `Current level ${input.level ?? 'unknown'} is in the elite tier.`,
      strength
    });
  }

  if (input.sessionTier === 'marathon') {
    signals.push({
      key: 'reached_marathon_session_tier',
      label: 'Reached Marathon Session Tier',
      reason: 'Current session duration is at least four hours.',
      strength
    });
  }

  if (input.onlineRankByLevel === 1) {
    signals.push({
      key: 'top_online_level',
      label: 'Currently #1 By Online Level',
      reason: 'This player currently has the highest level among online players.',
      strength
    });
  }

  if (input.onlineRankBySessionDuration === 1) {
    signals.push({
      key: 'top_online_session_duration',
      label: 'Currently #1 By Online Session Duration',
      reason: 'This player currently has the longest active session among online players.',
      strength
    });
  }

  return signals;
}

function findLikelyGuildForPlayer(telemetry: PalworldLatestPlayerTelemetry): {
  likelyGuildName: string | null;
  guildMemberCount: number | null;
} {
  const guilds = loadGuildsSummary();
  const playerKeys = getTelemetryGuildMatchKeys(telemetry);

  if (playerKeys.length > 0) {
    const matchingGuild = selectBestGuildMatch(guilds.filter((guild) => {
      const memberKeys = getGuildMemberKeys(guild);
      return memberKeys.some((memberKey) => isGuildMemberMatch(memberKey, playerKeys));
    }));

    if (matchingGuild) {
      return toGuildIntelligence(matchingGuild);
    }
  }

  return toGuildIntelligence(null);
}

function classifyPalworldPlayer(input: {
  identityState: 'approved' | 'rejected' | 'unresolved';
  levelTier: PalworldLevelTier | null;
  sessionTier: PalworldSessionTier | null;
  milestoneSignals: PalworldMilestoneSignal[];
  guildMemberCount: number | null;
}): { engagementScore: number; classification: PalworldPlayerClassification } {
  let engagementScore = 0;

  if (input.levelTier === 'elite') {
    engagementScore += 3;
  } else if (input.levelTier === 'high') {
    engagementScore += 2;
  } else if (input.levelTier === 'mid') {
    engagementScore += 1;
  }

  if (input.sessionTier === 'marathon') {
    engagementScore += 3;
  } else if (input.sessionTier === 'grinding') {
    engagementScore += 2;
  } else if (input.sessionTier === 'active') {
    engagementScore += 1;
  }

  engagementScore += Math.min(3, input.milestoneSignals.length);

  if ((input.guildMemberCount ?? 0) >= 4) {
    engagementScore += 2;
  } else if ((input.guildMemberCount ?? 0) >= 2) {
    engagementScore += 1;
  }

  if (input.identityState === 'approved') {
    engagementScore += 1;
  }

  let classification: PalworldPlayerClassification = 'New / Light Player';

  if (engagementScore >= 7) {
    classification = 'Core Player';
  } else if (engagementScore >= 4) {
    classification = 'Active Player';
  }

  return {
    engagementScore,
    classification
  };
}

function getPalworldPlayerImpactLevel(input: {
  classification: PalworldPlayerClassification;
  guildMemberCount: number | null;
  level: number | null | undefined;
  sessionTier: PalworldSessionTier | null;
}): PalworldPlayerImpactLevel {
  if (
    input.classification === 'Core Player'
    && (input.guildMemberCount ?? 0) >= 3
    && (input.level ?? 0) >= 50
  ) {
    return 'High Impact';
  }

  if (input.classification === 'Core Player') {
    return 'Core';
  }

  if (input.classification === 'Active Player') {
    return 'Active';
  }

  return 'Low';
}

export function getPalworldUnifiedPlayerProfile(serverId: string, playerId: string): PalworldUnifiedPlayerProfile | null {
  const telemetry = getLatestPalworldPlayerForServer(serverId, playerId);

  if (!telemetry) {
    return null;
  }

  const onlinePlayers = getLatestPalworldPlayersForServer(serverId, 10_000).filter((player) => player.isOnline);
  const reviewRecord = findMatchingReviewRecord(serverId, telemetry);
  const review = toReviewMetadata(reviewRecord);
  const saveArtifact = findSaveArtifact(telemetry, reviewRecord);
  const sessionTier = getSessionTier(telemetry.currentSessionDurationSeconds);
  const levelTier = getLevelTier(telemetry.level);
  const onlineRankByLevel = getOnlineRank(telemetry, onlinePlayers, (player) => player.level ?? -1);
  const onlineRankBySessionDuration = getOnlineRank(
    telemetry,
    onlinePlayers,
    (player) => player.currentSessionDurationSeconds ?? -1
  );
  const milestoneSignals = getMilestoneSignals({
    level: telemetry.level ?? null,
    levelTier,
    sessionTier,
    onlineRankByLevel,
    onlineRankBySessionDuration,
    identityState: review.state
  });
  const guildIntelligence = findLikelyGuildForPlayer(telemetry);
  const playerEngagement = classifyPalworldPlayer({
    identityState: review.state,
    levelTier,
    sessionTier,
    milestoneSignals,
    guildMemberCount: guildIntelligence.guildMemberCount
  });
  const impactLevel = getPalworldPlayerImpactLevel({
    classification: playerEngagement.classification,
    guildMemberCount: guildIntelligence.guildMemberCount,
    level: telemetry.level,
    sessionTier
  });

  return palworldUnifiedPlayerProfileSchema.parse({
    serverId,
    playerId: telemetry.playerId ?? playerId,
    lookupKey: telemetry.lookupKey,
    playerName: telemetry.playerName ?? null,
    accountName: telemetry.accountName ?? null,
    userId: telemetry.userId ?? null,
    level: telemetry.level ?? null,
    ping: telemetry.ping ?? null,
    locationX: telemetry.locationX ?? null,
    locationY: telemetry.locationY ?? null,
    region: telemetry.region ?? null,
    firstSeenAt: telemetry.firstSeenAt ?? null,
    lastSeenAt: telemetry.lastSeenAt ?? null,
    maxLevelSeen: telemetry.maxLevelSeen ?? null,
    totalSessions: telemetry.totalSessions ?? null,
    isOnline: telemetry.isOnline,
    avgPing: telemetry.avgPing ?? null,
    maxPing: telemetry.maxPing ?? null,
    pingStdDev: telemetry.pingStdDev ?? null,
    currentSessionDurationSeconds: telemetry.currentSessionDurationSeconds ?? null,
    sessionTier,
    levelTier,
    onlineRankByLevel,
    onlineRankBySessionDuration,
    milestoneSignals,
    identityState: review.state,
    review,
    saveArtifact,
    playerIntelligence: {
      likelyGuildName: guildIntelligence.likelyGuildName,
      guildMemberCount: guildIntelligence.guildMemberCount,
      identityState: review.state,
      levelTier,
      sessionTier,
      engagementScore: playerEngagement.engagementScore,
      classification: playerEngagement.classification,
      impactLevel
    }
  });
}

export function getPalworldUnifiedProfilesForServer(serverId: string, limit = 10_000): PalworldUnifiedPlayerProfile[] {
  return getLatestPalworldPlayersForServer(serverId, limit)
    .map((player) => getPalworldUnifiedPlayerProfile(serverId, player.playerId ?? player.lookupKey))
    .filter((profile): profile is PalworldUnifiedPlayerProfile => Boolean(profile));
}

export function getPalworldMilestoneFeedForServer(serverId: string, limit = 50): PalworldMilestoneFeedEntry[] {
  return getPalworldUnifiedProfilesForServer(serverId, 10_000)
    .filter((profile) => profile.isOnline)
    .flatMap((profile) => profile.milestoneSignals.map((signal) => ({
      serverId: profile.serverId,
      playerId: profile.playerId,
      playerName: profile.playerName,
      accountName: profile.accountName,
      identityState: profile.identityState,
      signalKey: signal.key,
      signalLabel: signal.label,
      signalReason: signal.reason,
      signalStrength: signal.strength,
      level: profile.level,
      sessionTier: profile.sessionTier,
      levelTier: profile.levelTier
    } satisfies PalworldMilestoneFeedEntry)))
    .sort((left, right) => {
      if (left.signalStrength !== right.signalStrength) {
        return left.signalStrength === 'verified' ? -1 : 1;
      }

      if ((right.level ?? -1) !== (left.level ?? -1)) {
        return (right.level ?? -1) - (left.level ?? -1);
      }

      return (left.playerName ?? left.accountName ?? left.playerId)
        .localeCompare(right.playerName ?? right.accountName ?? right.playerId);
    })
    .slice(0, Math.max(1, limit));
}

export function getPalworldPlayerProfileSessionSummariesForServer(
  serverId: string,
  limit = 100
): PalworldPlayerProfileSessionSummary[] {
  const activeSessions = getActiveSessionsForServer(serverId);
  const recentClosedSessions = getRecentClosedSessionsForServer(serverId, 500);
  const nowMs = Date.now();

  const profileSummaries = getPalworldUnifiedProfilesForServer(serverId, limit)
    .map((profile) => {
      const activeSession = activeSessions.find((session) => isSessionForProfile(session.playerName, profile)) ?? null;
      const meaningfulSessions = recentClosedSessions
        .filter((session) => (
          isSessionForProfile(session.playerName, profile)
          && (session.durationSeconds ?? 0) >= MIN_MEANINGFUL_SESSION_DURATION_SECONDS
        ));
      const recentSessions = meaningfulSessions.slice(0, 10);
      const playtimeWindows = getSessionPlaytimeWindows(meaningfulSessions, nowMs);
      const currentSessionDurationSeconds = activeSession
        ? getDurationSecondsSince(activeSession.startedAt)
        : profile.currentSessionDurationSeconds;

      return palworldPlayerProfileSessionSummarySchema.parse({
        serverId: profile.serverId,
        playerId: profile.playerId,
        lookupKey: profile.lookupKey,
        playerName: profile.playerName,
        accountName: profile.accountName,
        isOnline: profile.isOnline,
        activeSessionStartedAt: activeSession?.startedAt ?? null,
        currentSessionDurationSeconds,
        recentTrackedSeconds: recentSessions.reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0),
        ...playtimeWindows,
        recentSessions,
        saveArtifact: profile.saveArtifact,
        inferredGuildName: profile.playerIntelligence.likelyGuildName,
        profile
      });
    });

  return consolidateProfileSessionSummaries(profileSummaries);
}
