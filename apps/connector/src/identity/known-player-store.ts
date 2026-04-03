import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import {
  identityConfidenceSchema,
  knownPlayerRecordSchema,
  type IdentityConfidence,
  type KnownPlayerRecord
} from '@gameops/shared';
import { z } from 'zod';

const fileStoreSchema = z.object({
  players: z.array(knownPlayerRecordSchema).default([])
});

interface UpsertKnownPlayerObservationInput {
  serverId: string;
  displayName: string;
  observedAt: string;
  source: string;
  confidence: IdentityConfidence;
  platformId?: string;
  playFabId?: string;
  characterId?: string;
}

function normalizePlayerKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

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

function loadStore(path: string): z.infer<typeof fileStoreSchema> {
  try {
    const content = readFileSync(path, 'utf8');
    const parsed = JSON.parse(content) as unknown;
    const validated = fileStoreSchema.parse(parsed);

    return {
      players: validated.players.map((player) => normalizeKnownPlayerRecord(player))
    };
  } catch {
    return { players: [] };
  }
}

function writeStore(path: string, store: z.infer<typeof fileStoreSchema>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(store, null, 2), 'utf8');
}

function mergeUnique(base: string[], maybeValue: string | undefined): string[] {
  if (!maybeValue) {
    return base;
  }

  if (base.includes(maybeValue)) {
    return base;
  }

  return [...base, maybeValue];
}

function pickConfidence(a: IdentityConfidence, b: IdentityConfidence): IdentityConfidence {
  const rank: Record<IdentityConfidence, number> = {
    low: 1,
    medium: 2,
    high: 3
  };

  return rank[a] >= rank[b] ? a : b;
}

export function upsertKnownPlayerObservation(input: UpsertKnownPlayerObservationInput): void {
  const parsedConfidence = identityConfidenceSchema.parse(input.confidence);
  const path = resolveStorePath();
  const store = loadStore(path);
  const normalizedPlayerKey = normalizePlayerKey(input.displayName);

  const existingIndex = store.players.findIndex((record) => (
    record.serverId === input.serverId && record.normalizedPlayerKey === normalizedPlayerKey
  ));

  if (existingIndex >= 0) {
    const existing = store.players[existingIndex];
    if (!existing) {
      return;
    }

    store.players[existingIndex] = knownPlayerRecordSchema.parse({
      ...existing,
      displayName: input.displayName,
      knownPlatformIds: mergeUnique(existing.knownPlatformIds, input.platformId),
      knownPlayFabIds: mergeUnique(existing.knownPlayFabIds, input.playFabId),
      knownCharacterIds: mergeUnique(existing.knownCharacterIds, input.characterId),
      identitySources: mergeUnique(existing.identitySources, input.source),
      observationCount: existing.observationCount + 1,
      confidence: pickConfidence(existing.confidence, parsedConfidence),
      lastSeenAt: input.observedAt
    });

    writeStore(path, store);
    return;
  }

  store.players.push(knownPlayerRecordSchema.parse({
    serverId: input.serverId,
    displayName: input.displayName,
    normalizedPlayerKey,
    knownPlatformIds: input.platformId ? [input.platformId] : [],
    knownPlayFabIds: input.playFabId ? [input.playFabId] : [],
    knownCharacterIds: input.characterId ? [input.characterId] : [],
    identitySources: [input.source],
    observationCount: 1,
    confidence: parsedConfidence,
    firstSeenAt: input.observedAt,
    lastSeenAt: input.observedAt
  }));

  writeStore(path, store);
}

export function findKnownPlayer(serverId: string, displayName: string): KnownPlayerRecord | null {
  const path = resolveStorePath();
  const store = loadStore(path);
  const normalizedPlayerKey = normalizePlayerKey(displayName);

  const match = store.players.find((record) => (
    record.serverId === serverId && record.normalizedPlayerKey === normalizedPlayerKey
  ));

  return match ?? null;
}
