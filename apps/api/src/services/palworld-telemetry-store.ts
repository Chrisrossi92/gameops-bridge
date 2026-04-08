import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import {
  palworldLatestPlayerTelemetrySchema,
  palworldPlayerSnapshotSchema,
  palworldMetricsSummarySchema,
  type PalworldLatestPlayerTelemetry,
  type PalworldPlayerSnapshot,
  type PalworldMetricsSummary
} from '@gameops/shared';
import { z } from 'zod';
import { getActiveSessionsForServer } from './event-store.js';

const rawLatestPlayerStateSchema = z.object({
  server_id: z.string().min(1),
  lookup_key: z.string().min(1),
  player_name: z.string().optional(),
  account_name: z.string().optional(),
  player_id: z.string().optional(),
  user_id: z.string().optional(),
  level: z.number().int().optional(),
  ping: z.number().optional(),
  location_x: z.number().optional(),
  location_y: z.number().optional(),
  region: z.string().optional(),
  first_seen_at: z.string().datetime(),
  last_seen_at: z.string().datetime(),
  max_level_seen: z.number().int().min(0).optional(),
  total_sessions: z.number().int().min(0).default(0),
  is_online: z.boolean().default(false)
}).catchall(z.unknown());

const rawMetricsSnapshotSchema = z.object({
  server_id: z.string().min(1),
  observed_at: z.string().datetime(),
  raw_json: z.record(z.string(), z.unknown())
});

const rawPlayerSnapshotSchema = z.object({
  server_id: z.string().min(1),
  observed_at: z.string().datetime(),
  lookup_key: z.string().min(1),
  player_name: z.string().optional(),
  account_name: z.string().optional(),
  player_id: z.string().optional(),
  user_id: z.string().optional(),
  level: z.number().int().optional(),
  ping: z.number().optional(),
  location_x: z.number().optional(),
  location_y: z.number().optional(),
  region: z.string().optional(),
  raw_json: z.unknown()
});

const rawTelemetryStoreSchema = z.object({
  playerSnapshotHistory: z.array(rawPlayerSnapshotSchema).default([]),
  latestPlayerStates: z.array(rawLatestPlayerStateSchema).default([]),
  metricsSnapshotHistory: z.array(rawMetricsSnapshotSchema).default([])
});

const PLAYER_PING_WINDOW = 20;
const METRICS_WINDOW = 20;

function resolveStorePath(): string {
  const rawPath = process.env.PALWORLD_TELEMETRY_STORE_PATH ?? '../palworld-telemetry.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getNumberMetric(raw: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function getAverage(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getMax(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return Math.max(...values);
}

function getStandardDeviation(values: number[]): number | undefined {
  const average = getAverage(values);

  if (average === undefined || values.length === 0) {
    return undefined;
  }

  const variance = values
    .map((value) => ((value - average) ** 2))
    .reduce((sum, value) => sum + value, 0) / values.length;

  return Math.sqrt(variance);
}

function roundTo(value: number | undefined, places: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function loadStore(): z.infer<typeof rawTelemetryStoreSchema> {
  const path = resolveStorePath();

  try {
    return rawTelemetryStoreSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch {
    return rawTelemetryStoreSchema.parse({});
  }
}

function toCurrentSessionDurationSeconds(serverId: string, playerName: string | undefined): number | undefined {
  const normalizedName = normalizeLookup(playerName ?? '');

  if (!normalizedName) {
    return undefined;
  }

  const activeSession = getActiveSessionsForServer(serverId).find((session) => (
    normalizeLookup(session.playerName) === normalizedName
  )) ?? null;

  if (!activeSession) {
    return undefined;
  }

  const startedAtMs = new Date(activeSession.startedAt).getTime();

  if (!Number.isFinite(startedAtMs)) {
    return undefined;
  }

  return Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
}

function toLatestPlayerTelemetry(
  raw: z.infer<typeof rawLatestPlayerStateSchema>,
  playerSnapshotHistory: Array<z.infer<typeof rawPlayerSnapshotSchema>>
): PalworldLatestPlayerTelemetry {
  const recentSnapshots = playerSnapshotHistory
    .filter((snapshot) => snapshot.server_id === raw.server_id && snapshot.lookup_key === raw.lookup_key)
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
    .slice(0, PLAYER_PING_WINDOW);
  const pings = recentSnapshots
    .map((snapshot) => snapshot.ping)
    .filter((ping): ping is number => typeof ping === 'number' && Number.isFinite(ping));

  return palworldLatestPlayerTelemetrySchema.parse({
    serverId: raw.server_id,
    lookupKey: raw.lookup_key,
    playerName: raw.player_name,
    accountName: raw.account_name,
    playerId: raw.player_id,
    userId: raw.user_id,
    level: raw.level,
    ping: raw.ping,
    locationX: raw.location_x,
    locationY: raw.location_y,
    region: raw.region,
    firstSeenAt: raw.first_seen_at,
    lastSeenAt: raw.last_seen_at,
    maxLevelSeen: raw.max_level_seen,
    totalSessions: raw.total_sessions,
    isOnline: raw.is_online,
    avgPing: roundTo(getAverage(pings), 2),
    maxPing: getMax(pings),
    pingStdDev: roundTo(getStandardDeviation(pings), 2),
    currentSessionDurationSeconds: toCurrentSessionDurationSeconds(raw.server_id, raw.player_name)
  });
}

function toPlayerSnapshot(raw: z.infer<typeof rawPlayerSnapshotSchema>): PalworldPlayerSnapshot {
  return palworldPlayerSnapshotSchema.parse({
    serverId: raw.server_id,
    observedAt: raw.observed_at,
    lookupKey: raw.lookup_key,
    playerName: raw.player_name,
    accountName: raw.account_name,
    playerId: raw.player_id,
    userId: raw.user_id,
    level: raw.level,
    ping: raw.ping,
    locationX: raw.location_x,
    locationY: raw.location_y,
    region: raw.region,
    raw: raw.raw_json
  });
}

function toMetricsSummary(
  raw: z.infer<typeof rawMetricsSnapshotSchema>,
  windowSnapshots: Array<z.infer<typeof rawMetricsSnapshotSchema>>
): PalworldMetricsSummary {
  const fpsValues = windowSnapshots
    .map((snapshot) => getNumberMetric(snapshot.raw_json, ['serverfps', 'serverFps', 'fps']))
    .filter((fps): fps is number => typeof fps === 'number' && Number.isFinite(fps) && fps > 0);
  const worstFrameTimeMs = fpsValues.length > 0
    ? Math.max(...fpsValues.map((fps) => 1000 / fps))
    : undefined;
  const uptimeSeconds = getNumberMetric(raw.raw_json, ['uptime', 'uptimeSeconds', 'uptime_seconds']);

  return palworldMetricsSummarySchema.parse({
    serverId: raw.server_id,
    observedAt: raw.observed_at,
    currentPlayerCount: getNumberMetric(raw.raw_json, ['currentplayernum', 'currentPlayerNum', 'current_player_num']),
    serverFps: getNumberMetric(raw.raw_json, ['serverfps', 'serverFps', 'fps']),
    uptimeSeconds,
    averageFps: roundTo(getAverage(fpsValues), 2),
    worstFrameTimeMs: roundTo(worstFrameTimeMs, 2),
    currentUptimeHours: roundTo(uptimeSeconds !== undefined ? uptimeSeconds / 3600 : undefined, 2),
    raw: raw.raw_json
  });
}

export function getLatestPalworldPlayersForServer(serverId: string, limit = 50): PalworldLatestPlayerTelemetry[] {
  const store = loadStore();

  return store.latestPlayerStates
    .filter((player) => player.server_id === serverId)
    .map((player) => toLatestPlayerTelemetry(player, store.playerSnapshotHistory))
    .sort((a, b) => {
      if (Number(b.isOnline) !== Number(a.isOnline)) {
        return Number(b.isOnline) - Number(a.isOnline);
      }

      return b.lastSeenAt.localeCompare(a.lastSeenAt);
    })
    .slice(0, Math.max(1, limit));
}

export function getLatestPalworldPlayerForServer(serverId: string, playerKeyOrName: string): PalworldLatestPlayerTelemetry | null {
  const normalizedLookup = normalizeLookup(playerKeyOrName);

  if (!normalizedLookup) {
    return null;
  }

  const players = getLatestPalworldPlayersForServer(serverId, 10_000);
  return players.find((player) => (
    normalizeLookup(player.lookupKey) === normalizedLookup
    || normalizeLookup(player.playerName ?? '') === normalizedLookup
    || normalizeLookup(player.accountName ?? '') === normalizedLookup
    || normalizeLookup(player.playerId ?? '') === normalizedLookup
    || normalizeLookup(player.userId ?? '') === normalizedLookup
  )) ?? null;
}

export function getRecentPalworldMetricsForServer(serverId: string, limit = 20): PalworldMetricsSummary[] {
  const snapshots = loadStore().metricsSnapshotHistory
    .filter((snapshot) => snapshot.server_id === serverId)
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at));

  return snapshots
    .slice(0, Math.max(1, limit))
    .map((snapshot, index) => toMetricsSummary(snapshot, snapshots.slice(index, index + METRICS_WINDOW)));
}

export function getRecentPalworldPlayerSnapshotsForServer(serverId: string, limit = 50): PalworldPlayerSnapshot[] {
  return loadStore().playerSnapshotHistory
    .filter((snapshot) => snapshot.server_id === serverId)
    .map(toPlayerSnapshot)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
    .slice(0, Math.max(1, limit));
}

export function getRecentPalworldPlayerSnapshotsForPlayer(
  serverId: string,
  playerKeyOrName: string,
  limit = 20
): PalworldPlayerSnapshot[] {
  const normalizedLookup = normalizeLookup(playerKeyOrName);

  if (!normalizedLookup) {
    return [];
  }

  return getRecentPalworldPlayerSnapshotsForServer(serverId, 50_000)
    .filter((snapshot) => (
      normalizeLookup(snapshot.lookupKey) === normalizedLookup
      || normalizeLookup(snapshot.playerName ?? '') === normalizedLookup
      || normalizeLookup(snapshot.accountName ?? '') === normalizedLookup
      || normalizeLookup(snapshot.playerId ?? '') === normalizedLookup
      || normalizeLookup(snapshot.userId ?? '') === normalizedLookup
    ))
    .slice(0, Math.max(1, limit));
}
