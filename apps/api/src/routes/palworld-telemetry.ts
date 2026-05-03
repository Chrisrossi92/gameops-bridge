import {
  palworldLatestPlayersResponseSchema,
  palworldManualTransitionPostActionSchema,
  palworldManualTransitionPostResponseSchema,
  palworldMilestoneFeedResponseSchema,
  palworldPlayerSnapshotsResponseSchema,
  palworldPlayerProfileSessionSummariesResponseSchema,
  palworldTransitionMilestoneEventsResponseSchema,
  palworldMetricsSummariesResponseSchema,
  palworldPlayerTelemetryProfileResponseSchema,
  palworldHighlightsResponseSchema,
  palworldGuildActivityResponseSchema,
  palworldUnifiedPlayerProfileSchema,
  type PalworldLatestPlayersResponse,
  type PalworldGuildActivityEntry,
  type PalworldGuildActivityMember,
  type PalworldGuildActivityResponse,
  type PalworldGuildActivityRiskLevel,
  type PalworldHighlightsResponse,
  type PalworldManualTransitionPostAction,
  type PalworldManualTransitionPostResponse,
  type PalworldMilestoneFeedResponse,
  type PalworldPlayerProfileSessionSummary,
  type PalworldPlayerSnapshotsResponse,
  type PalworldPlayerProfileSessionSummariesResponse,
  type PalworldTransitionMilestoneEventsResponse,
  type PalworldMetricsSummariesResponse,
  type PalworldPlayerTelemetryProfileResponse,
  type PalworldUnifiedPlayerProfile
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  getLatestPalworldPlayerForServer,
  getLatestPalworldPlayersForServer,
  getRecentPalworldPlayerSnapshotsForPlayer,
  getRecentPalworldPlayerSnapshotsForServer,
  getRecentPalworldMetricsForServer
} from '../services/palworld-telemetry-store.js';
import {
  getPalworldMilestoneFeedForServer,
  getPalworldPlayerProfileSessionSummariesForServer,
  getPalworldUnifiedPlayerProfile,
  getPalworldUnifiedProfilesForServer
} from '../services/palworld-player-profile.js';
import { generatePalworldHighlights } from '../services/palworld-highlight-generator.js';
import {
  evaluatePalworldMilestoneTransitionsForServer,
  getRecentPalworldMilestoneTransitionEventsForServer
} from '../services/palworld-milestone-transition-store.js';
import { postPalworldDiscordMessage, postPalworldTransitionPreviewToDiscord } from '../services/palworld-manual-discord-post.js';

interface PalworldGuildSummary {
  guildName?: string | null;
  guildId?: string | null;
  memberCount?: number | null;
  members?: unknown[];
}

interface PalworldBaseSignalHistoryEntry {
  timestamp: string;
  baseSignal: number;
}

interface PalworldBaseAlertState {
  statusLabel: PalworldBaseAlertResponse['statusLabel'] | null;
  growthAlertMessage: string | null;
}

interface PalworldBaseSignalResponse {
  serverId: string;
  baseSignal: number;
  refinedEstimatedBases: number;
}

interface PalworldBaseAlertResponse {
  serverId: string;
  usagePercent: number;
  estimatedBases: number;
  remainingCapacity: number;
  statusLabel: 'critical' | 'high' | 'warning' | 'safe';
  alertMessage: string;
  growthAlertMessage: string | null;
}

const PALWORLD_GUILD_PLACEHOLDERS = new Set(['unknown', 'unknown guild', 'unnamed guild', 'none', 'null']);
const PALWORLD_GUILD_MEMBER_FALSE_POSITIVES = new Set([
  'epalgrouptype',
  'grouptype',
  'rawdata',
  'none',
  'groupid',
  'guildid',
  'guildname',
  'playeruid',
  'instanceid',
  'name',
  'members'
]);
const PALWORLD_GUILD_ENGINE_LABELS = [
  'epalgrouptype',
  'grouptype',
  'rawdata',
  'none',
  'save',
  'savedata',
  'property',
  'properties',
  'group',
  'basecamp',
  'world',
  'playeruid',
  'guid',
  'instanceid'
];
const PALWORLD_BASE_SIGNAL_HISTORY_PATH = '/var/backups/gameops/palworld-parse-output/latest/base-signal-history.json';
const PALWORLD_BASE_ALERT_STATE_PATH = '/var/backups/gameops/palworld-parse-output/latest/base-alert-state.json';
const PALWORLD_LEVEL_STRINGS_PATH = '/tmp/level.strings.txt';
const PALWORLD_GUID_PATTERN = /\b(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})\b/gi;
const PALWORLD_PALBOX_RISK_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeGuildText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isGuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    || /^[0-9a-f]{32}$/i.test(value);
}

function isEngineLikeGuildLabel(value: string): boolean {
  const normalized = value.toLowerCase();
  return PALWORLD_GUILD_ENGINE_LABELS.some((label) => normalized.includes(label));
}

function isPlaceholderGuildLabel(value: string): boolean {
  return PALWORLD_GUILD_PLACEHOLDERS.has(value.trim().toLowerCase());
}

function hasEnoughLettersForGuildName(value: string): boolean {
  const letters = value.match(/[A-Za-z]/g) ?? [];
  const vowelish = value.match(/[AEIOUYaeiouy]/g) ?? [];
  return letters.length >= 4 && vowelish.length >= 1;
}

function isLikelyJunkGuildToken(value: string): boolean {
  const normalized = normalizeGuildText(value);
  const letterCount = (normalized.match(/[A-Za-z]/g) ?? []).length;
  const upperCount = (normalized.match(/[A-Z]/g) ?? []).length;
  const lowerCount = (normalized.match(/[a-z]/g) ?? []).length;

  if (!normalized || /^[^A-Za-z]*$/.test(normalized) || /(.)\1{3,}/.test(normalized)) {
    return true;
  }

  if (
    normalized.length <= 6
    && /[0-9]/.test(normalized)
    && !/[aeiouy]/i.test(normalized)
  ) {
    return true;
  }

  if (
    normalized.length <= 6
    && letterCount >= 3
    && upperCount >= 1
    && lowerCount >= 1
    && !/[aeiouy]/i.test(normalized)
  ) {
    return true;
  }

  return false;
}

function isReadableGuildNameCandidate(value: string): boolean {
  const normalized = normalizeGuildText(value);

  if (normalized.length < 4 || normalized.length > 28) {
    return false;
  }

  if (isGuidLike(normalized) || isPlaceholderGuildLabel(normalized) || isEngineLikeGuildLabel(normalized)) {
    return false;
  }

  if (!/[A-Za-z]/.test(normalized) || !hasEnoughLettersForGuildName(normalized)) {
    return false;
  }

  if (isLikelyJunkGuildToken(normalized)) {
    return false;
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9 '&._-]*$/.test(normalized)) {
    return false;
  }

  const nonLetterCount = (normalized.match(/[^A-Za-z\s]/g) ?? []).length;
  const lettersOnlyLength = (normalized.match(/[A-Za-z]/g) ?? []).length;

  if (nonLetterCount > Math.max(2, Math.floor(normalized.length / 4))) {
    return false;
  }

  if (lettersOnlyLength <= 4 && /[0-9]/.test(normalized)) {
    return false;
  }

  if (/^[A-Z]{4,}$/.test(normalized) || /^[A-Za-z0-9]{4,6}$/.test(normalized) && !/[aeiouy]/i.test(normalized)) {
    return false;
  }

  return true;
}

function scoreGuildNameCandidate(value: string): number {
  const normalized = normalizeGuildText(value);
  let score = 0;

  if (normalized.includes(' ')) {
    score += 3;
  }

  if (/[A-Z][a-z]/.test(normalized)) {
    score += 1;
  }

  if (normalized.length >= 8 && normalized.length <= 20) {
    score += 2;
  }

  if (/s$/i.test(normalized)) {
    score += 2;
  }

  if (/[&'-]/.test(normalized)) {
    score += 1;
  }

  if (/^[A-Z][a-z]+(?: [A-Z][a-z]+)*$/.test(normalized)) {
    score += 2;
  }

  if (/[0-9]/.test(normalized)) {
    score -= 2;
  }

  if (/^[a-z][A-Z]/.test(normalized)) {
    score -= 1;
  }

  if (isLikelyJunkGuildToken(normalized)) {
    score -= 4;
  }

  return score;
}

function isStrictMemberCandidate(value: string): boolean {
  const normalized = normalizeGuildText(value);

  if (!normalized || normalized.length < 2 || normalized.length > 32) {
    return false;
  }

  if (
    isGuidLike(normalized)
    || isPlaceholderGuildLabel(normalized)
    || isEngineLikeGuildLabel(normalized)
    || PALWORLD_GUILD_MEMBER_FALSE_POSITIVES.has(normalized.toLowerCase())
    || isLikelyJunkGuildToken(normalized)
  ) {
    return false;
  }

  if (!/[A-Za-z]/.test(normalized)) {
    return false;
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9 '_-]*$/.test(normalized)) {
    return false;
  }

  return true;
}

function looksMoreLikeGuildNameThanPlayer(value: string): boolean {
  const normalized = normalizeGuildText(value);
  return isReadableGuildNameCandidate(normalized)
    && (
      scoreGuildNameCandidate(normalized) >= 4
      || normalized.includes(' ')
      || /s$/i.test(normalized)
      || normalized.length >= 8
    );
}

function collectGuildStringCandidates(value: unknown, found = new Set<string>(), depth = 0): string[] {
  if (depth > 3) {
    return [...found];
  }

  if (typeof value === 'string') {
    const normalized = normalizeGuildText(value);
    if (normalized) {
      found.add(normalized);
    }
    return [...found];
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectGuildStringCandidates(item, found, depth + 1);
    }
    return [...found];
  }

  if (value && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectGuildStringCandidates(nested, found, depth + 1);
    }
  }

  return [...found];
}

function sanitizePalworldGuilds(guilds: unknown[]): PalworldGuildSummary[] {
  return guilds.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return entry as PalworldGuildSummary;
    }

    const guild = entry as PalworldGuildSummary;
    const rawGuildName = typeof guild.guildName === 'string' ? normalizeGuildText(guild.guildName) : '';
    const rawMembers = Array.isArray(guild.members)
      ? guild.members.filter((member): member is string => typeof member === 'string').map(normalizeGuildText)
      : [];

    const cleanedMembers = [...new Set(rawMembers.filter(isStrictMemberCandidate))];
    const embeddedCandidates = collectGuildStringCandidates(guild)
      .filter((candidate) => candidate !== (guild.guildId ?? ''))
      .filter((candidate) => !cleanedMembers.includes(candidate));
    const candidatePool = [rawGuildName, ...embeddedCandidates, ...cleanedMembers]
      .filter(Boolean)
      .filter(isReadableGuildNameCandidate)
      .sort((left, right) => scoreGuildNameCandidate(right) - scoreGuildNameCandidate(left));

    const preferredGuildName = candidatePool[0] ?? '';
    const shouldPromoteMemberName = cleanedMembers.includes(preferredGuildName)
      && looksMoreLikeGuildNameThanPlayer(preferredGuildName)
      && (!isReadableGuildNameCandidate(rawGuildName) || isPlaceholderGuildLabel(rawGuildName));
    const resolvedGuildName = isReadableGuildNameCandidate(rawGuildName)
      ? rawGuildName
      : (preferredGuildName || rawGuildName || null);
    const finalGuildName = resolvedGuildName && !isPlaceholderGuildLabel(resolvedGuildName)
      ? resolvedGuildName
      : (resolvedGuildName || guild.guildName || null);
    const finalMembers = cleanedMembers.filter((member) => member !== finalGuildName && (!shouldPromoteMemberName || member !== preferredGuildName));

    return {
      ...guild,
      guildName: finalGuildName,
      members: finalMembers,
      memberCount: finalMembers.length
    };
  });
}

function getGuildActivityRiskLevel(daysInactive: number | null): PalworldGuildActivityRiskLevel {
  if (daysInactive === null) {
    return 'unknown';
  }

  if (daysInactive >= PALWORLD_PALBOX_RISK_DAYS) {
    return 'expired';
  }

  if (daysInactive >= 27) {
    return 'risk';
  }

  if (daysInactive >= 21) {
    return 'watch';
  }

  return 'active';
}

function getDaysInactive(lastSeenAt: string | null): number | null {
  if (!lastSeenAt) {
    return null;
  }

  const lastSeenAtMs = new Date(lastSeenAt).getTime();

  if (!Number.isFinite(lastSeenAtMs)) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - lastSeenAtMs) / MS_PER_DAY));
}

function getGuildActivitySortRank(riskLevel: PalworldGuildActivityRiskLevel): number {
  switch (riskLevel) {
    case 'expired': return 0;
    case 'risk': return 1;
    case 'watch': return 2;
    case 'unknown': return 3;
    case 'active': return 4;
  }
}

function getNormalizedGuildKey(value: string | null | undefined): string {
  return normalizeGuildText(value ?? '').toLowerCase();
}

function getNormalizedPlayerMatchKey(value: string | null | undefined): string {
  return normalizeGuildText(value ?? '').toLowerCase();
}

function isTrackableGuildName(value: string | null | undefined): value is string {
  const normalized = normalizeGuildText(value ?? '');
  return Boolean(normalized) && !isPlaceholderGuildLabel(normalized);
}

function buildPalworldGuildActivityResponse(
  serverId: string,
  guilds: PalworldGuildSummary[],
  profiles: PalworldPlayerProfileSessionSummary[]
): PalworldGuildActivityResponse {
  const guildsByKey = new Map<string, { guildName: string; memberCount: number; members: string[] }>();
  const profilesByGuildKey = new Map<string, PalworldPlayerProfileSessionSummary[]>();
  const profilesByMemberKey = new Map<string, PalworldPlayerProfileSessionSummary>();

  for (const profile of profiles) {
    const candidateNames = [profile.playerName, profile.accountName]
      .map(getNormalizedPlayerMatchKey)
      .filter(Boolean);

    for (const candidateName of candidateNames) {
      const existingProfile = profilesByMemberKey.get(candidateName);

      if (!existingProfile || (profile.profile.lastSeenAt ?? '').localeCompare(existingProfile.profile.lastSeenAt ?? '') > 0) {
        profilesByMemberKey.set(candidateName, profile);
      }
    }
  }

  for (const guild of guilds) {
    const normalizedGuildName = normalizeGuildText(guild.guildName ?? '');

    if (!normalizedGuildName) {
      continue;
    }

    const guildName = normalizedGuildName;
    const guildKey = getNormalizedGuildKey(guildName);
    const members = Array.isArray(guild.members)
      ? [...new Set(guild.members.filter((member): member is string => typeof member === 'string').map(normalizeGuildText).filter(Boolean))]
      : [];
    const memberCount = Math.max(
      guild.memberCount ?? 0,
      members.length
    );

    guildsByKey.set(guildKey, {
      guildName,
      memberCount,
      members
    });
  }

  for (const profile of profiles) {
    if (!isTrackableGuildName(profile.inferredGuildName)) {
      continue;
    }

    const guildName = normalizeGuildText(profile.inferredGuildName);
    const guildKey = getNormalizedGuildKey(guildName);
    const existingProfiles = profilesByGuildKey.get(guildKey) ?? [];
    existingProfiles.push(profile);
    profilesByGuildKey.set(guildKey, existingProfiles);

    if (!guildsByKey.has(guildKey)) {
      guildsByKey.set(guildKey, {
        guildName,
        memberCount: 0,
        members: []
      });
    }
  }

  const activity = Array.from(guildsByKey.entries()).map(([guildKey, guild]) => {
    const matchedProfiles = profilesByGuildKey.get(guildKey) ?? [];
    const memberEntries = guild.members.map((memberName): PalworldGuildActivityMember => {
      const matchedProfile = profilesByMemberKey.get(getNormalizedPlayerMatchKey(memberName)) ?? null;

      if (!matchedProfile) {
        return {
          memberName,
          matched: false,
          matchedPlayerName: null,
          lastSeenAt: null,
          daysSinceSeen: null,
          level: null,
          saveLinked: null
        };
      }

      return {
        memberName,
        matched: true,
        matchedPlayerName: matchedProfile.playerName ?? matchedProfile.accountName ?? memberName,
        lastSeenAt: matchedProfile.profile.lastSeenAt,
        daysSinceSeen: getDaysInactive(matchedProfile.profile.lastSeenAt),
        level: matchedProfile.profile.level,
        saveLinked: matchedProfile.saveArtifact.present
      };
    });
    const matchedMemberKeys = new Set(memberEntries.filter((member) => member.matched).map((member) => getNormalizedPlayerMatchKey(member.matchedPlayerName)));
    const inferredMemberEntries = matchedProfiles
      .filter((profile) => {
        const displayName = profile.playerName ?? profile.accountName;
        return Boolean(displayName) && !matchedMemberKeys.has(getNormalizedPlayerMatchKey(displayName));
      })
      .map((profile): PalworldGuildActivityMember => ({
        memberName: profile.playerName ?? profile.accountName ?? 'Unknown member',
        matched: true,
        matchedPlayerName: profile.playerName ?? profile.accountName ?? 'Unknown member',
        lastSeenAt: profile.profile.lastSeenAt,
        daysSinceSeen: getDaysInactive(profile.profile.lastSeenAt),
        level: profile.profile.level,
        saveLinked: profile.saveArtifact.present
      }));
    const members = [...memberEntries, ...inferredMemberEntries].sort((left, right) => {
      if (Number(right.matched) !== Number(left.matched)) {
        return Number(right.matched) - Number(left.matched);
      }

      return (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? '');
    });
    const mostRecentMember = members
      .filter((member) => member.lastSeenAt)
      .sort((left, right) => (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? ''))[0] ?? null;
    const lastMemberSeenAt = mostRecentMember?.lastSeenAt ?? null;
    const lastSeenMemberName = mostRecentMember?.matchedPlayerName ?? mostRecentMember?.memberName ?? null;
    const daysInactive = getDaysInactive(lastMemberSeenAt);

    return {
      guildName: guild.guildName,
      memberCount: Math.max(guild.memberCount, matchedProfiles.length, members.length),
      members,
      lastMemberSeenAt,
      lastSeenMemberName,
      daysInactive,
      daysUntilPalboxRisk: daysInactive === null ? null : Math.max(0, PALWORLD_PALBOX_RISK_DAYS - daysInactive),
      riskLevel: getGuildActivityRiskLevel(daysInactive)
    } satisfies PalworldGuildActivityEntry;
  });

  return {
    serverId,
    guilds: activity.sort((left, right) => {
      const riskDelta = getGuildActivitySortRank(left.riskLevel) - getGuildActivitySortRank(right.riskLevel);

      if (riskDelta !== 0) {
        return riskDelta;
      }

      if ((right.daysInactive ?? -1) !== (left.daysInactive ?? -1)) {
        return (right.daysInactive ?? -1) - (left.daysInactive ?? -1);
      }

      return left.guildName.localeCompare(right.guildName);
    })
  };
}

function readPalworldBaseSignalHistory(): PalworldBaseSignalHistoryEntry[] {
  try {
    const parsed = JSON.parse(readFileSync(PALWORLD_BASE_SIGNAL_HISTORY_PATH, 'utf8')) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is PalworldBaseSignalHistoryEntry => (
      Boolean(entry)
      && typeof entry === 'object'
      && typeof (entry as PalworldBaseSignalHistoryEntry).timestamp === 'string'
      && typeof (entry as PalworldBaseSignalHistoryEntry).baseSignal === 'number'
    ));
  } catch {
    return [];
  }
}

function appendPalworldBaseSignalHistory(baseSignal: number): void {
  const nextHistory = [
    ...readPalworldBaseSignalHistory(),
    {
      timestamp: new Date().toISOString(),
      baseSignal
    }
  ].slice(-100);

  writeFileSync(PALWORLD_BASE_SIGNAL_HISTORY_PATH, `${JSON.stringify(nextHistory, null, 2)}\n`, 'utf8');
}

function readPalworldBaseAlertStateByServer(): Record<string, PalworldBaseAlertState> {
  try {
    const parsed = JSON.parse(readFileSync(PALWORLD_BASE_ALERT_STATE_PATH, 'utf8')) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const entries = Object.entries(parsed as Record<string, unknown>)
      .filter(([, value]) => Boolean(value) && typeof value === 'object' && !Array.isArray(value))
      .map(([serverId, value]) => {
        const candidate = value as Partial<PalworldBaseAlertState>;
        const statusLabel = candidate.statusLabel;

        return [
          serverId,
          {
            statusLabel: statusLabel === 'safe' || statusLabel === 'warning' || statusLabel === 'high' || statusLabel === 'critical'
              ? statusLabel
              : null,
            growthAlertMessage: typeof candidate.growthAlertMessage === 'string' ? candidate.growthAlertMessage : null
          }
        ] satisfies [string, PalworldBaseAlertState];
      });

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function writePalworldBaseAlertStateByServer(value: Record<string, PalworldBaseAlertState>): void {
  writeFileSync(PALWORLD_BASE_ALERT_STATE_PATH, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function computePalworldBaseSignalTrend(history: PalworldBaseSignalHistoryEntry[]): {
  direction: 'increasing' | 'stable' | 'decreasing';
  indicator: '▲' | '→' | '▼';
} {
  const recentHistory = history.slice(-5);

  if (recentHistory.length < 2) {
    return {
      direction: 'stable',
      indicator: '→'
    };
  }

  const oldestHistoryEntry = recentHistory[0];
  const newestHistoryEntry = recentHistory[recentHistory.length - 1];

  if (!oldestHistoryEntry || !newestHistoryEntry) {
    return {
      direction: 'stable',
      indicator: '→'
    };
  }

  const delta = newestHistoryEntry.baseSignal - oldestHistoryEntry.baseSignal;

  if (delta > 0) {
    return {
      direction: 'increasing',
      indicator: '▲'
    };
  }

  if (delta < 0) {
    return {
      direction: 'decreasing',
      indicator: '▼'
    };
  }

  return {
    direction: 'stable',
    indicator: '→'
  };
}

function countBaseSignalOccurrences(content: string): number {
  return content.match(/BaseCampSaveData/g)?.length ?? 0;
}

function estimateRefinedBaseCountFromStrings(content: string, rawBaseSignal: number): number {
  const fallbackEstimate = Math.round(rawBaseSignal / 3);

  if (rawBaseSignal <= 0) {
    return 0;
  }

  const lines = content.split(/\r?\n/);
  const baseMarkerIndexes = lines
    .map((line, index) => (line.includes('BaseCampSaveData') ? index : -1))
    .filter((index) => index >= 0);
  const nearbyUniqueIds = new Set<string>();

  for (const index of baseMarkerIndexes) {
    const windowText = lines.slice(Math.max(0, index - 2), index + 25).join('\n');
    const matches = [...windowText.matchAll(PALWORLD_GUID_PATTERN)]
      .map((match) => match[0].toLowerCase())
      .filter((value) => !/^0+$/.test(value.replace(/-/g, '')));
    const candidateId = matches[0];

    if (candidateId) {
      nearbyUniqueIds.add(candidateId);
    }
  }

  const uniqueIdEstimate = nearbyUniqueIds.size;

  if (
    uniqueIdEstimate > 0
    && uniqueIdEstimate <= rawBaseSignal
    && uniqueIdEstimate >= Math.max(1, Math.floor(fallbackEstimate / 2))
  ) {
    return uniqueIdEstimate;
  }

  return fallbackEstimate;
}

function readCurrentPalworldBaseSignal(): {
  baseSignal: number;
  refinedEstimatedBases: number;
} {
  try {
    const content = readFileSync(PALWORLD_LEVEL_STRINGS_PATH, 'utf8');
    const baseSignal = countBaseSignalOccurrences(content);

    return {
      baseSignal,
      refinedEstimatedBases: estimateRefinedBaseCountFromStrings(content, baseSignal)
    };
  } catch {
    const result = execSync(
      "grep -c 'BaseCampSaveData' /tmp/level.strings.txt"
    ).toString().trim();
    const baseSignal = parseInt(result, 10) || 0;

    return {
      baseSignal,
      refinedEstimatedBases: Math.round(baseSignal / 3)
    };
  }
}

function buildPalworldBaseAlertResponse(
  serverId: string,
  baseSignal: number,
  refinedEstimatedBases: number,
  history: PalworldBaseSignalHistoryEntry[]
): PalworldBaseAlertResponse {
  const estimatedBases = refinedEstimatedBases;
  const usagePercent = Math.round((estimatedBases / 240) * 100);
  const remainingCapacity = Math.max(0, 240 - estimatedBases);

  let statusLabel: PalworldBaseAlertResponse['statusLabel'] = 'safe';
  let alertMessage = 'No immediate base pressure';

  if (usagePercent >= 95) {
    statusLabel = 'critical';
    alertMessage = 'Base cap is near full';
  } else if (usagePercent >= 80) {
    statusLabel = 'high';
    alertMessage = 'High base pressure';
  } else if (usagePercent >= 60) {
    statusLabel = 'warning';
    alertMessage = 'Base usage is climbing';
  }

  const recentHistory = history.slice(-5);
  const oldestHistoryEntry = recentHistory[0];
  const newestHistoryEntry = recentHistory[recentHistory.length - 1];
  const growthDelta = recentHistory.length >= 2 && oldestHistoryEntry && newestHistoryEntry
    ? newestHistoryEntry.baseSignal - oldestHistoryEntry.baseSignal
    : 0;

  let growthAlertMessage: string | null = null;

  if (growthDelta >= 20) {
    growthAlertMessage = 'Rapid base growth detected';
  } else if (growthDelta >= 10) {
    growthAlertMessage = 'Base growth is accelerating';
  }

  return {
    serverId,
    usagePercent,
    estimatedBases,
    remainingCapacity,
    statusLabel,
    alertMessage,
    growthAlertMessage
  };
}

function buildPalworldBasePressureDiscordMessage(input: {
  alert: PalworldBaseAlertResponse;
  trend: ReturnType<typeof computePalworldBaseSignalTrend>;
}): string {
  const title = input.alert.statusLabel === 'critical'
    ? '🚨 Base Pressure Critical'
    : input.alert.statusLabel === 'high'
      ? '⚠️ Base Pressure High'
      : '⚠️ Base Pressure Warning';

  return [
    title,
    `Usage: ${input.alert.usagePercent}%`,
    `Estimated Bases: ${input.alert.estimatedBases} / 240`,
    `Remaining Slots: ${input.alert.remainingCapacity}`,
    '',
    `Status: ${input.alert.statusLabel[0]!.toUpperCase()}${input.alert.statusLabel.slice(1)}`,
    `Trend: ${input.trend.indicator} ${input.trend.direction}`
  ].join('\n');
}

function buildPalworldBaseGrowthDiscordMessage(input: {
  alert: PalworldBaseAlertResponse;
  trend: ReturnType<typeof computePalworldBaseSignalTrend>;
}): string {
  return [
    '📈 Base Growth Alert',
    input.alert.growthAlertMessage ?? 'Base growth detected',
    '',
    `Usage: ${input.alert.usagePercent}%`,
    `Estimated Bases: ${input.alert.estimatedBases} / 240`,
    `Remaining Slots: ${input.alert.remainingCapacity}`,
    '',
    `Status: ${input.alert.statusLabel[0]!.toUpperCase()}${input.alert.statusLabel.slice(1)}`,
    `Trend: ${input.trend.indicator} ${input.trend.direction}`
  ].join('\n');
}

async function evaluatePalworldBasePressureAlerts(input: {
  serverId: string;
  alert: PalworldBaseAlertResponse;
  history: PalworldBaseSignalHistoryEntry[];
}): Promise<void> {
  const stateByServer = readPalworldBaseAlertStateByServer();
  const previousState = stateByServer[input.serverId] ?? {
    statusLabel: null,
    growthAlertMessage: null
  };
  const trend = computePalworldBaseSignalTrend(input.history);
  const shouldSendStatusAlert = input.alert.statusLabel !== previousState.statusLabel
    && (input.alert.statusLabel === 'warning' || input.alert.statusLabel === 'high' || input.alert.statusLabel === 'critical');
  const shouldSendGrowthAlert = input.alert.growthAlertMessage !== null
    && input.alert.growthAlertMessage !== previousState.growthAlertMessage;

  if (shouldSendStatusAlert) {
    await postPalworldDiscordMessage(
      input.serverId,
      buildPalworldBasePressureDiscordMessage({
        alert: input.alert,
        trend
      })
    );
  }

  if (shouldSendGrowthAlert) {
    await postPalworldDiscordMessage(
      input.serverId,
      buildPalworldBaseGrowthDiscordMessage({
        alert: input.alert,
        trend
      })
    );
  }

  if (shouldSendStatusAlert || shouldSendGrowthAlert || previousState.statusLabel !== input.alert.statusLabel || previousState.growthAlertMessage !== input.alert.growthAlertMessage) {
    stateByServer[input.serverId] = {
      statusLabel: input.alert.statusLabel,
      growthAlertMessage: input.alert.growthAlertMessage
    };
    writePalworldBaseAlertStateByServer(stateByServer);
  }
}

export async function registerPalworldTelemetryRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>(
    '/servers/:serverId/palworld/players/latest',
    async (request, reply): Promise<PalworldLatestPlayersResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      const parsedLimit = Number(request.query.limit);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;

      return palworldLatestPlayersResponseSchema.parse({
        serverId,
        players: getLatestPalworldPlayersForServer(serverId, limit)
      });
    }
  );

  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>(
    '/servers/:serverId/palworld/players/profiles',
    async (request, reply): Promise<PalworldPlayerProfileSessionSummariesResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      const parsedLimit = Number(request.query.limit);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 100;

      return palworldPlayerProfileSessionSummariesResponseSchema.parse({
        serverId,
        profiles: getPalworldPlayerProfileSessionSummariesForServer(serverId, limit)
      });
    }
  );

  app.get<{ Params: { serverId: string; playerKey: string } }>(
    '/servers/:serverId/palworld/players/latest/:playerKey',
    async (request, reply): Promise<PalworldPlayerTelemetryProfileResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();
      const playerKey = decodeURIComponent(request.params.playerKey).trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      if (!playerKey) {
        reply.code(400);
        return { error: 'Invalid playerKey' };
      }

      return palworldPlayerTelemetryProfileResponseSchema.parse({
        serverId,
        player: getLatestPalworldPlayerForServer(serverId, playerKey)
      });
    }
  );

  app.get<{ Params: { serverId: string; playerId: string } }>(
    '/servers/:serverId/palworld/player-profile/:playerId',
    async (request, reply): Promise<PalworldUnifiedPlayerProfile | { error: string }> => {
      const serverId = request.params.serverId.trim();
      const playerId = decodeURIComponent(request.params.playerId).trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      if (!playerId) {
        reply.code(400);
        return { error: 'Invalid playerId' };
      }

      const profile = getPalworldUnifiedPlayerProfile(serverId, playerId);

      if (!profile) {
        reply.code(404);
        return { error: 'Player profile not found' };
      }

      return palworldUnifiedPlayerProfileSchema.parse(profile);
    }
  );

  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>(
    '/servers/:serverId/palworld/milestones/current',
    async (request, reply): Promise<PalworldMilestoneFeedResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      const parsedLimit = Number(request.query.limit);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;

      return palworldMilestoneFeedResponseSchema.parse({
        serverId,
        milestones: getPalworldMilestoneFeedForServer(serverId, limit)
      });
    }
  );

  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>(
    '/servers/:serverId/palworld/milestones/transitions/recent',
    async (request, reply): Promise<PalworldTransitionMilestoneEventsResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      const parsedLimit = Number(request.query.limit);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;

      evaluatePalworldMilestoneTransitionsForServer(serverId);

      return palworldTransitionMilestoneEventsResponseSchema.parse({
        serverId,
        events: getRecentPalworldMilestoneTransitionEventsForServer(serverId, limit)
      });
    }
  );

  app.get<{ Params: { serverId: string } }>(
    '/servers/:serverId/palworld/guilds',
    async (request, reply): Promise<{ serverId: string; guilds: unknown[] } | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      try {
        const path = '/var/backups/gameops/palworld-parse-output/latest/guilds-summary.json';
        const guilds = sanitizePalworldGuilds(JSON.parse(readFileSync(path, 'utf8')) as unknown[]);
        return { serverId, guilds };
      } catch (error) {
        reply.code(500);
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  app.get<{ Params: { serverId: string } }>(
    '/servers/:serverId/palworld/guild-activity',
    async (request, reply): Promise<PalworldGuildActivityResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      try {
        const path = '/var/backups/gameops/palworld-parse-output/latest/guilds-summary.json';
        const guilds = sanitizePalworldGuilds(JSON.parse(readFileSync(path, 'utf8')) as unknown[]);
        const profiles = getPalworldPlayerProfileSessionSummariesForServer(serverId, 10_000);

        return palworldGuildActivityResponseSchema.parse(buildPalworldGuildActivityResponse(serverId, guilds, profiles));
      } catch (error) {
        reply.code(500);
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  app.get<{ Params: { serverId: string } }>(
    '/servers/:serverId/palworld/base-signal',
    async (request, reply): Promise<PalworldBaseSignalResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      try {
        const { baseSignal, refinedEstimatedBases } = readCurrentPalworldBaseSignal();
        appendPalworldBaseSignalHistory(baseSignal);
        const history = readPalworldBaseSignalHistory();
        const alert = buildPalworldBaseAlertResponse(serverId, baseSignal, refinedEstimatedBases, history);
        try {
          await evaluatePalworldBasePressureAlerts({
            serverId,
            alert,
            history
          });
        } catch {
          // Keep the route readable even if Discord is temporarily unavailable.
        }

        return { serverId, baseSignal, refinedEstimatedBases };
      } catch (error) {
        reply.code(500);
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  app.get<{ Params: { serverId: string } }>(
    '/servers/:serverId/palworld/base-alerts',
    async (request, reply): Promise<PalworldBaseAlertResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      try {
        const { baseSignal, refinedEstimatedBases } = readCurrentPalworldBaseSignal();
        const history = [
          ...readPalworldBaseSignalHistory(),
          {
            timestamp: new Date().toISOString(),
            baseSignal
          }
        ].slice(-100);
        const alert = buildPalworldBaseAlertResponse(serverId, baseSignal, refinedEstimatedBases, history);
        try {
          await evaluatePalworldBasePressureAlerts({
            serverId,
            alert,
            history
          });
        } catch {
          // Keep the route readable even if Discord is temporarily unavailable.
        }

        return alert;
      } catch (error) {
        reply.code(500);
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  app.get<{ Params: { serverId: string } }>(
    '/servers/:serverId/palworld/base-signal/history',
    async (request, reply): Promise<{ serverId: string; history: PalworldBaseSignalHistoryEntry[] } | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      try {
        return {
          serverId,
          history: readPalworldBaseSignalHistory()
        };
      } catch (error) {
        reply.code(500);
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  app.get<{ Params: { serverId: string } }>(
    '/servers/:serverId/palworld/highlights',
    async (request, reply): Promise<PalworldHighlightsResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      try {
        const path = '/var/backups/gameops/palworld-parse-output/latest/guilds-summary.json';
        const guilds = sanitizePalworldGuilds(JSON.parse(readFileSync(path, 'utf8')) as unknown[]);
        const { baseSignal, refinedEstimatedBases } = readCurrentPalworldBaseSignal();
        const history = [
          ...readPalworldBaseSignalHistory(),
          {
            timestamp: new Date().toISOString(),
            baseSignal
          }
        ].slice(-100);
        const baseAlert = buildPalworldBaseAlertResponse(serverId, baseSignal, refinedEstimatedBases, history);

        return palworldHighlightsResponseSchema.parse(
          generatePalworldHighlights({
            serverId,
            milestoneFeed: getPalworldMilestoneFeedForServer(serverId, 50),
            guilds,
            profiles: getPalworldUnifiedProfilesForServer(serverId, 10_000),
            baseAlert
          })
        );
      } catch (error) {
        reply.code(500);
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  app.post<{ Params: { serverId: string }; Body: PalworldManualTransitionPostAction }>(
    '/servers/:serverId/palworld/milestones/transitions/post',
    async (request, reply): Promise<PalworldManualTransitionPostResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();
      const parsed = palworldManualTransitionPostActionSchema.safeParse(request.body);

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      if (!parsed.success || parsed.data.serverId !== serverId) {
        reply.code(400);
        return { error: 'Invalid manual transition post payload' };
      }

      try {
        return palworldManualTransitionPostResponseSchema.parse(
          await postPalworldTransitionPreviewToDiscord(parsed.data)
        );
      } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>(
    '/servers/:serverId/palworld/players/snapshots/recent',
    async (request, reply): Promise<PalworldPlayerSnapshotsResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      const parsedLimit = Number(request.query.limit);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 50;

      return palworldPlayerSnapshotsResponseSchema.parse({
        serverId,
        snapshots: getRecentPalworldPlayerSnapshotsForServer(serverId, limit)
      });
    }
  );

  app.get<{ Params: { serverId: string; playerKey: string }; Querystring: { limit?: string } }>(
    '/servers/:serverId/palworld/players/latest/:playerKey/history',
    async (request, reply): Promise<PalworldPlayerSnapshotsResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();
      const playerKey = decodeURIComponent(request.params.playerKey).trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      if (!playerKey) {
        reply.code(400);
        return { error: 'Invalid playerKey' };
      }

      const parsedLimit = Number(request.query.limit);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 20;

      return palworldPlayerSnapshotsResponseSchema.parse({
        serverId,
        snapshots: getRecentPalworldPlayerSnapshotsForPlayer(serverId, playerKey, limit)
      });
    }
  );

  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>(
    '/servers/:serverId/palworld/metrics/recent',
    async (request, reply): Promise<PalworldMetricsSummariesResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      const parsedLimit = Number(request.query.limit);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;

      return palworldMetricsSummariesResponseSchema.parse({
        serverId,
        metrics: getRecentPalworldMetricsForServer(serverId, limit)
      });
    }
  );
}
