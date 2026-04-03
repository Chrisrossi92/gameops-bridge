import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import {
  identityObservationSchema,
  knownPlayerRecordSchema,
  type IdentityObservation,
  type KnownPlayerRecord
} from '@gameops/shared';

function resolveStorePath(): string {
  const rawPath = process.env.KNOWN_PLAYER_STORE_PATH ?? '../known-players.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
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
  const path = resolveStorePath();

  try {
    const content = readFileSync(path, 'utf8');
    const parsedRoot = JSON.parse(content) as { players?: unknown };
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
  const path = resolveStorePath();

  try {
    const content = readFileSync(path, 'utf8');
    const parsedRoot = JSON.parse(content) as { observations?: unknown };
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
