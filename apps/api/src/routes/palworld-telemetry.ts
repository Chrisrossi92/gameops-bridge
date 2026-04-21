import {
  palworldLatestPlayersResponseSchema,
  palworldManualTransitionPostActionSchema,
  palworldManualTransitionPostResponseSchema,
  palworldMilestoneFeedResponseSchema,
  palworldPlayerSnapshotsResponseSchema,
  palworldTransitionMilestoneEventsResponseSchema,
  palworldMetricsSummariesResponseSchema,
  palworldPlayerTelemetryProfileResponseSchema,
  palworldUnifiedPlayerProfileSchema,
  type PalworldLatestPlayersResponse,
  type PalworldManualTransitionPostAction,
  type PalworldManualTransitionPostResponse,
  type PalworldMilestoneFeedResponse,
  type PalworldPlayerSnapshotsResponse,
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
import { getPalworldMilestoneFeedForServer, getPalworldUnifiedPlayerProfile } from '../services/palworld-player-profile.js';
import {
  evaluatePalworldMilestoneTransitionsForServer,
  getRecentPalworldMilestoneTransitionEventsForServer
} from '../services/palworld-milestone-transition-store.js';
import { postPalworldTransitionPreviewToDiscord } from '../services/palworld-manual-discord-post.js';

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

  if (/[0-9]/.test(normalized)) {
    score -= 2;
  }

  if (/^[a-z][A-Z]/.test(normalized)) {
    score -= 1;
  }

  return score;
}

function isStrictMemberCandidate(value: string): boolean {
  const normalized = normalizeGuildText(value);

  if (!normalized || normalized.length < 2 || normalized.length > 32) {
    return false;
  }

  if (isGuidLike(normalized) || isPlaceholderGuildLabel(normalized) || isEngineLikeGuildLabel(normalized)) {
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
      && scoreGuildNameCandidate(preferredGuildName) >= 3
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
      memberCount: guild.memberCount ?? finalMembers.length
    };
  });
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

function readCurrentPalworldBaseSignal(): number {
  const result = execSync(
    "grep -c 'BaseCampSaveData' /tmp/level.strings.txt"
  ).toString().trim();

  return parseInt(result, 10) || 0;
}

function buildPalworldBaseAlertResponse(serverId: string, baseSignal: number, history: PalworldBaseSignalHistoryEntry[]): PalworldBaseAlertResponse {
  const estimatedBases = Math.round(baseSignal / 3);
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
  const growthDelta = recentHistory.length >= 2
    ? recentHistory[recentHistory.length - 1].baseSignal - recentHistory[0].baseSignal
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
    '/servers/:serverId/palworld/base-signal',
    async (request, reply): Promise<{ serverId: string; baseSignal: number } | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      try {
        const baseSignal = readCurrentPalworldBaseSignal();
        appendPalworldBaseSignalHistory(baseSignal);

        return { serverId, baseSignal };
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
        const baseSignal = readCurrentPalworldBaseSignal();
        const history = readPalworldBaseSignalHistory();

        return buildPalworldBaseAlertResponse(serverId, baseSignal, history);
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
