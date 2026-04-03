import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { knownPlayerRecordSchema, type KnownPlayerRecord } from '@gameops/shared';

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
