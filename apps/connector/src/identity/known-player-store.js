import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { identityObservationSchema, identityConfidenceSchema, knownPlayerRecordSchema } from '@gameops/shared';
import { z } from 'zod';
const fileStoreSchema = z.object({
    players: z.array(knownPlayerRecordSchema).default([]),
    observations: z.array(identityObservationSchema).default([])
});
const MAX_OBSERVATIONS = 20_000;
function normalizePlayerKey(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}
function resolveStorePath() {
    const rawPath = process.env.KNOWN_PLAYER_STORE_PATH ?? '../known-players.json';
    return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}
function isCharacterId(value) {
    return /^\d+:\d+$/.test(value.trim());
}
function isPlatformId(value) {
    return /^(steam|xbox|psn|eos)[_:-]/i.test(value.trim());
}
function dedupe(values) {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
function normalizeKnownPlayerRecord(record) {
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
function loadStore(path) {
    try {
        const content = readFileSync(path, 'utf8');
        const parsed = JSON.parse(content);
        const validated = fileStoreSchema.parse(parsed);
        return {
            players: validated.players.map((player) => normalizeKnownPlayerRecord(player)),
            observations: validated.observations
        };
    }
    catch {
        return { players: [], observations: [] };
    }
}
function writeStore(path, store) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(store, null, 2), 'utf8');
}
function mergeUnique(base, maybeValue) {
    if (!maybeValue) {
        return base;
    }
    if (base.includes(maybeValue)) {
        return base;
    }
    return [...base, maybeValue];
}
function pickConfidence(a, b) {
    const rank = {
        low: 1,
        medium: 2,
        high: 3
    };
    return rank[a] >= rank[b] ? a : b;
}
function deriveConfidenceFromEvidence(params) {
    const platformCount = dedupe(params.knownPlatformIds).length;
    const playFabCount = dedupe(params.knownPlayFabIds).length;
    const characterCount = dedupe(params.knownCharacterIds).length;
    const sourceCount = dedupe(params.identitySources).length;
    const hasStrongId = platformCount > 0 || playFabCount > 0;
    const hasAnyId = hasStrongId || characterCount > 0;
    if (params.observationCount >= 12 && hasStrongId && sourceCount >= 2) {
        return 'high';
    }
    if (params.observationCount >= 5 && hasAnyId) {
        return 'medium';
    }
    return 'low';
}
function toIdentityObservation(input, normalizedPlayerKey) {
    return identityObservationSchema.parse({
        serverId: input.serverId,
        displayName: input.displayName,
        normalizedPlayerKey,
        observedAt: input.observedAt,
        ...(input.playFabId ? { playFabId: input.playFabId } : {}),
        ...(input.platformId ? { platformId: input.platformId } : {}),
        ...(input.characterId ? { characterId: input.characterId } : {}),
        source: input.source,
        confidence: input.confidence
    });
}
export function upsertKnownPlayerObservation(input) {
    const parsedConfidence = identityConfidenceSchema.parse(input.confidence);
    const path = resolveStorePath();
    const store = loadStore(path);
    const normalizedPlayerKey = normalizePlayerKey(input.displayName);
    const observation = toIdentityObservation(input, normalizedPlayerKey);
    store.observations.push(observation);
    if (store.observations.length > MAX_OBSERVATIONS) {
        store.observations.splice(0, store.observations.length - MAX_OBSERVATIONS);
    }
    const existingIndex = store.players.findIndex((record) => (record.serverId === input.serverId && record.normalizedPlayerKey === normalizedPlayerKey));
    if (existingIndex >= 0) {
        const existing = store.players[existingIndex];
        if (!existing) {
            return;
        }
        const nextRecordBase = {
            ...existing,
            displayName: input.displayName,
            knownPlatformIds: mergeUnique(existing.knownPlatformIds, input.platformId),
            knownPlayFabIds: mergeUnique(existing.knownPlayFabIds, input.playFabId),
            knownCharacterIds: mergeUnique(existing.knownCharacterIds, input.characterId),
            identitySources: mergeUnique(existing.identitySources, input.source),
            observationCount: existing.observationCount + 1,
            lastSeenAt: input.observedAt
        };
        const derivedConfidence = deriveConfidenceFromEvidence({
            observationCount: nextRecordBase.observationCount,
            knownPlatformIds: nextRecordBase.knownPlatformIds,
            knownPlayFabIds: nextRecordBase.knownPlayFabIds,
            knownCharacterIds: nextRecordBase.knownCharacterIds,
            identitySources: nextRecordBase.identitySources
        });
        store.players[existingIndex] = knownPlayerRecordSchema.parse({
            ...nextRecordBase,
            confidence: pickConfidence(pickConfidence(existing.confidence, parsedConfidence), derivedConfidence)
        });
        writeStore(path, store);
        return;
    }
    const initialRecord = {
        serverId: input.serverId,
        displayName: input.displayName,
        normalizedPlayerKey,
        knownPlatformIds: input.platformId ? [input.platformId] : [],
        knownPlayFabIds: input.playFabId ? [input.playFabId] : [],
        knownCharacterIds: input.characterId ? [input.characterId] : [],
        identitySources: [input.source],
        observationCount: 1,
        firstSeenAt: input.observedAt,
        lastSeenAt: input.observedAt
    };
    const derivedInitialConfidence = deriveConfidenceFromEvidence({
        observationCount: initialRecord.observationCount,
        knownPlatformIds: initialRecord.knownPlatformIds,
        knownPlayFabIds: initialRecord.knownPlayFabIds,
        knownCharacterIds: initialRecord.knownCharacterIds,
        identitySources: initialRecord.identitySources
    });
    store.players.push(knownPlayerRecordSchema.parse({
        ...initialRecord,
        confidence: pickConfidence(parsedConfidence, derivedInitialConfidence)
    }));
    writeStore(path, store);
}
export function findKnownPlayer(serverId, displayName) {
    const path = resolveStorePath();
    const store = loadStore(path);
    const normalizedPlayerKey = normalizePlayerKey(displayName);
    const match = store.players.find((record) => (record.serverId === serverId && record.normalizedPlayerKey === normalizedPlayerKey));
    return match ?? null;
}
//# sourceMappingURL=known-player-store.js.map