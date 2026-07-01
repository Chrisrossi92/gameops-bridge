import { readFileSync } from 'node:fs';
import {
  identityObservationSchema,
  knownPlayerRecordSchema,
  type IdentityObservation,
  type KnownPlayerRecord
} from '@gameops/shared';
import { resolveRuntimeDataPath } from './runtime-paths.js';

const STORE_CACHE_TTL_MS = 5_000;

interface KnownPlayerStore {
  players?: unknown;
  observations?: unknown;
}

let storeCache: { path: string; expiresAt: number; store: KnownPlayerStore } | null = null;

function resolveStorePath(): string {
  return resolveRuntimeDataPath('KNOWN_PLAYER_STORE_PATH', 'known-players.json');
}

function loadStore(): KnownPlayerStore {
  const path = resolveStorePath();
  const now = Date.now();

  if (storeCache && storeCache.path === path && storeCache.expiresAt > now) {
    return storeCache.store;
  }

  try {
    const store = JSON.parse(readFileSync(path, 'utf8')) as KnownPlayerStore;
    storeCache = { path, expiresAt: now + STORE_CACHE_TTL_MS, store };
    return store;
  } catch {
    const store: KnownPlayerStore = {};
    storeCache = { path, expiresAt: now + STORE_CACHE_TTL_MS, store };
    return store;
  }
}

function isCharacterId(value: string): boolean {
  return /^\d+:\d+$/.test(value.trim());
}

function isPlatformId(value: string): boolean {
  return /^(steam|xbox|psn|eos)[_:-]/i.test(value.trim());
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizePlayerLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeKnownPlayerRecord(record: KnownPlayerRecord): KnownPlayerRecord {
  const migratedCharacterIdsFromPlatform = record.knownPlatformIds.filter((id) => isCharacterId(id));
  const cleanedPlatformIds = record.knownPlatformIds.filter((id) => !isCharacterId(id) && isPlatformId(id));

  return knownPlayerRecordSchema.parse({
    ...record,
    knownPlatformIds: dedupe(cleanedPlatformIds),
    knownPlayFabIds: dedupe(record.knownPlayFabIds),
    knownCharacterIds: dedupe([
      ...record.knownCharacterIds,
      ...migratedCharacterIdsFromPlatform
    ])
  });
}

export function getKnownPlayersForServer(serverId: string, limit = 20): KnownPlayerRecord[] {
  try {
    const parsedRoot = loadStore();
    const rawPlayers = Array.isArray(parsedRoot.players) ? parsedRoot.players : [];
    const parsedPlayers = rawPlayers
      .map((rawPlayer) => knownPlayerRecordSchema.safeParse(rawPlayer))
      .filter((result): result is { success: true; data: KnownPlayerRecord } => result.success)
      .map((result) => normalizeKnownPlayerRecord(result.data));

    return parsedPlayers
      .filter((player) => player.serverId === serverId)
      .sort((a, b) => {
        if (b.observationCount !== a.observationCount) {
          return b.observationCount - a.observationCount;
        }

        return b.lastSeenAt.localeCompare(a.lastSeenAt);
      })
      .slice(0, Math.max(1, limit));
  } catch {
    return [];
  }
}

export function getKnownPlayerForServer(serverId: string, playerKeyOrName: string): KnownPlayerRecord | null {
  const normalizedLookup = normalizePlayerLookupKey(playerKeyOrName);

  if (!normalizedLookup) {
    return null;
  }

  const players = getKnownPlayersForServer(serverId, 10_000);

  const match = players.find((player) => {
    return player.normalizedPlayerKey === normalizedLookup
      || normalizePlayerLookupKey(player.displayName) === normalizedLookup;
  });

  return match ?? null;
}

export function getIdentityObservationsForPlayer(
  serverId: string,
  player: Pick<KnownPlayerRecord, 'normalizedPlayerKey' | 'displayName'>,
  limit = 20
): IdentityObservation[] {
  try {
    const parsedRoot = loadStore();
    const rawObservations = Array.isArray(parsedRoot.observations) ? parsedRoot.observations : [];
    const parsedObservations = rawObservations
      .map((rawObservation) => identityObservationSchema.safeParse(rawObservation))
      .filter((result): result is { success: true; data: IdentityObservation } => result.success)
      .map((result) => result.data);

    const playerLookup = normalizePlayerLookupKey(player.normalizedPlayerKey);
    const displayLookup = normalizePlayerLookupKey(player.displayName);

    return parsedObservations
      .filter((observation) => {
        if (observation.serverId !== serverId) {
          return false;
        }

        const normalizedKey = normalizePlayerLookupKey(observation.normalizedPlayerKey);
        const normalizedName = normalizePlayerLookupKey(observation.displayName);
        return normalizedKey === playerLookup || normalizedName === displayLookup;
      })
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
      .slice(0, Math.max(1, limit));
  } catch {
    return [];
  }
}
