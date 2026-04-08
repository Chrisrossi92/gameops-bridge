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

function loadStore(): z.infer<typeof rawTelemetryStoreSchema> {
  const path = resolveStorePath();

  try {
    return rawTelemetryStoreSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch {
    return rawTelemetryStoreSchema.parse({});
  }
}

function toLatestPlayerTelemetry(raw: z.infer<typeof rawLatestPlayerStateSchema>): PalworldLatestPlayerTelemetry {
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
    isOnline: raw.is_online
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

function toMetricsSummary(raw: z.infer<typeof rawMetricsSnapshotSchema>): PalworldMetricsSummary {
  return palworldMetricsSummarySchema.parse({
    serverId: raw.server_id,
    observedAt: raw.observed_at,
    currentPlayerCount: getNumberMetric(raw.raw_json, ['currentplayernum', 'currentPlayerNum', 'current_player_num']),
    serverFps: getNumberMetric(raw.raw_json, ['serverfps', 'serverFps', 'fps']),
    uptimeSeconds: getNumberMetric(raw.raw_json, ['uptime', 'uptimeSeconds', 'uptime_seconds']),
    raw: raw.raw_json
  });
}

export function getLatestPalworldPlayersForServer(serverId: string, limit = 50): PalworldLatestPlayerTelemetry[] {
  return loadStore().latestPlayerStates
    .filter((player) => player.server_id === serverId)
    .map(toLatestPlayerTelemetry)
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
  return loadStore().metricsSnapshotHistory
    .filter((snapshot) => snapshot.server_id === serverId)
    .map(toMetricsSummary)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
    .slice(0, Math.max(1, limit));
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
