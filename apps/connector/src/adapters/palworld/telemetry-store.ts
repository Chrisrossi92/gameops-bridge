import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import {
  deriveRegionName,
  getPlayerAccountName,
  getPlayerBuildingCount,
  getPlayerIp,
  getPlayerLevel,
  getPlayerLocationX,
  getPlayerLocationY,
  getPlayerName,
  getPlayerPing,
  getPlayerPlayerId,
  getPlayerUserId,
  type PalworldRestPlayer
} from './rest.js';

const playerSnapshotRecordSchema = z.object({
  server_id: z.string().min(1),
  observed_at: z.string().datetime(),
  lookup_key: z.string().min(1),
  player_name: z.string().optional(),
  account_name: z.string().optional(),
  player_id: z.string().optional(),
  user_id: z.string().optional(),
  ip: z.string().optional(),
  ping: z.number().optional(),
  level: z.number().int().optional(),
  building_count: z.number().int().optional(),
  location_x: z.number().optional(),
  location_y: z.number().optional(),
  region: z.string().optional(),
  raw_json: z.unknown()
});

const latestPlayerStateSchema = playerSnapshotRecordSchema.extend({
  first_seen_at: z.string().datetime(),
  last_seen_at: z.string().datetime(),
  max_level_seen: z.number().int().min(0).optional(),
  max_building_count_seen: z.number().int().min(0).optional(),
  last_region: z.string().optional(),
  total_sessions: z.number().int().min(0).default(0),
  is_online: z.boolean().default(true)
});

const metricsSnapshotRecordSchema = z.object({
  server_id: z.string().min(1),
  observed_at: z.string().datetime(),
  raw_json: z.unknown()
});

const settingsChangeRecordSchema = z.object({
  server_id: z.string().min(1),
  observed_at: z.string().datetime(),
  raw_json: z.unknown()
});

const latestSettingsRecordSchema = z.object({
  server_id: z.string().min(1),
  observed_at: z.string().datetime(),
  raw_json: z.unknown()
});

const telemetryStoreSchema = z.object({
  playerSnapshotHistory: z.array(playerSnapshotRecordSchema).default([]),
  latestPlayerStates: z.array(latestPlayerStateSchema).default([]),
  metricsSnapshotHistory: z.array(metricsSnapshotRecordSchema).default([]),
  settingsChangeHistory: z.array(settingsChangeRecordSchema).default([]),
  latestSettingsSnapshots: z.array(latestSettingsRecordSchema).default([])
});

type PlayerSnapshotRecord = z.infer<typeof playerSnapshotRecordSchema>;
type LatestPlayerState = z.infer<typeof latestPlayerStateSchema>;
type TelemetryStore = z.infer<typeof telemetryStoreSchema>;

const MAX_PLAYER_SNAPSHOT_HISTORY = 50_000;
const MAX_METRICS_SNAPSHOT_HISTORY = 10_000;
const MAX_SETTINGS_CHANGE_HISTORY = 2_000;

function resolveStorePath(): string {
  const rawPath = process.env.PALWORLD_TELEMETRY_STORE_PATH ?? '../palworld-telemetry.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function loadStore(path: string): TelemetryStore {
  try {
    return telemetryStoreSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch {
    return telemetryStoreSchema.parse({});
  }
}

function writeStore(path: string, store: TelemetryStore): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function trimHistory<T>(entries: T[], maxEntries: number): void {
  if (entries.length > maxEntries) {
    entries.splice(0, entries.length - maxEntries);
  }
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerialize(nested)}`);

    return `{${entries.join(',')}}`;
  }

  const serialized = JSON.stringify(value);
  return serialized ?? 'undefined';
}

function getLookupKey(player: PalworldRestPlayer): string | null {
  const playerId = getPlayerPlayerId(player);

  if (playerId) {
    return `player:${playerId}`;
  }

  const userId = getPlayerUserId(player);

  if (userId) {
    return `user:${userId}`;
  }

  const playerName = getPlayerName(player) ?? getPlayerAccountName(player);

  if (playerName) {
    return `name:${playerName.toLowerCase()}`;
  }

  return null;
}

function toPlayerSnapshotRecord(
  serverId: string,
  observedAt: string,
  player: PalworldRestPlayer
): PlayerSnapshotRecord | null {
  const lookupKey = getLookupKey(player);

  if (!lookupKey) {
    return null;
  }

  const locationX = getPlayerLocationX(player);
  const locationY = getPlayerLocationY(player);
  const region = deriveRegionName(locationX, locationY) ?? undefined;

  return playerSnapshotRecordSchema.parse({
    server_id: serverId,
    observed_at: observedAt,
    lookup_key: lookupKey,
    player_name: getPlayerName(player) ?? undefined,
    account_name: getPlayerAccountName(player) ?? undefined,
    player_id: getPlayerPlayerId(player) ?? undefined,
    user_id: getPlayerUserId(player) ?? undefined,
    ip: getPlayerIp(player) ?? undefined,
    ping: getPlayerPing(player) ?? undefined,
    level: getPlayerLevel(player) ?? undefined,
    building_count: getPlayerBuildingCount(player) ?? undefined,
    location_x: locationX ?? undefined,
    location_y: locationY ?? undefined,
    region,
    raw_json: player
  });
}

function upsertLatestPlayerState(
  latestPlayerStates: LatestPlayerState[],
  snapshot: PlayerSnapshotRecord,
  totalSessionsIncrement: number
): void {
  const index = latestPlayerStates.findIndex((entry) => (
    entry.server_id === snapshot.server_id && entry.lookup_key === snapshot.lookup_key
  ));

  if (index >= 0) {
    const existing = latestPlayerStates[index];

    if (!existing) {
      return;
    }

    latestPlayerStates[index] = latestPlayerStateSchema.parse({
      ...existing,
      ...snapshot,
      first_seen_at: existing.first_seen_at,
      last_seen_at: snapshot.observed_at,
      max_level_seen: Math.max(existing.max_level_seen ?? 0, snapshot.level ?? 0) || undefined,
      max_building_count_seen: Math.max(existing.max_building_count_seen ?? 0, snapshot.building_count ?? 0) || undefined,
      last_region: snapshot.region ?? existing.last_region,
      total_sessions: existing.total_sessions + totalSessionsIncrement,
      is_online: true
    });
    return;
  }

  latestPlayerStates.push(latestPlayerStateSchema.parse({
    ...snapshot,
    first_seen_at: snapshot.observed_at,
    last_seen_at: snapshot.observed_at,
    max_level_seen: snapshot.level ?? undefined,
    max_building_count_seen: snapshot.building_count ?? undefined,
    last_region: snapshot.region ?? undefined,
    total_sessions: totalSessionsIncrement,
    is_online: true
  }));
}

export interface PersistPalworldTelemetryInput {
  serverId: string;
  observedAt: string;
  players: PalworldRestPlayer[];
  previousPlayerLookupKeys: Set<string>;
  currentPlayerLookupKeys: Set<string>;
  metrics: unknown;
  settings: unknown;
}

export function persistPalworldTelemetry(input: PersistPalworldTelemetryInput): void {
  const path = resolveStorePath();
  const store = loadStore(path);

  for (const player of input.players) {
    const snapshot = toPlayerSnapshotRecord(input.serverId, input.observedAt, player);

    if (!snapshot) {
      continue;
    }

    store.playerSnapshotHistory.push(snapshot);
    upsertLatestPlayerState(
      store.latestPlayerStates,
      snapshot,
      input.previousPlayerLookupKeys.has(snapshot.lookup_key) ? 0 : 1
    );
  }

  for (const latestState of store.latestPlayerStates) {
    if (latestState.server_id !== input.serverId) {
      continue;
    }

    latestState.is_online = input.currentPlayerLookupKeys.has(latestState.lookup_key);
  }

  trimHistory(store.playerSnapshotHistory, MAX_PLAYER_SNAPSHOT_HISTORY);

  store.metricsSnapshotHistory.push(metricsSnapshotRecordSchema.parse({
    server_id: input.serverId,
    observed_at: input.observedAt,
    raw_json: input.metrics
  }));
  trimHistory(store.metricsSnapshotHistory, MAX_METRICS_SNAPSHOT_HISTORY);

  const latestSettingsIndex = store.latestSettingsSnapshots.findIndex((entry) => entry.server_id === input.serverId);
  const nextSettingsSerialized = stableSerialize(input.settings);
  const previousSettingsSerialized = latestSettingsIndex >= 0
    ? stableSerialize(store.latestSettingsSnapshots[latestSettingsIndex]?.raw_json)
    : null;

  if (previousSettingsSerialized !== nextSettingsSerialized) {
    store.settingsChangeHistory.push(settingsChangeRecordSchema.parse({
      server_id: input.serverId,
      observed_at: input.observedAt,
      raw_json: input.settings
    }));
    trimHistory(store.settingsChangeHistory, MAX_SETTINGS_CHANGE_HISTORY);
  }

  const latestSettingsRecord = latestSettingsRecordSchema.parse({
    server_id: input.serverId,
    observed_at: input.observedAt,
    raw_json: input.settings
  });

  if (latestSettingsIndex >= 0) {
    store.latestSettingsSnapshots[latestSettingsIndex] = latestSettingsRecord;
  } else {
    store.latestSettingsSnapshots.push(latestSettingsRecord);
  }

  writeStore(path, store);
}
