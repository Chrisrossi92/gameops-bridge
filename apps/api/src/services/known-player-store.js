import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { identityObservationSchema, knownPlayerRecordSchema } from '@gameops/shared';
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
function normalizePlayerLookupKey(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
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
export function getKnownPlayersForServer(serverId, limit = 20) {
    const path = resolveStorePath();
    try {
        const content = readFileSync(path, 'utf8');
        const parsedRoot = JSON.parse(content);
        const rawPlayers = Array.isArray(parsedRoot.players) ? parsedRoot.players : [];
        const parsedPlayers = rawPlayers
            .map((rawPlayer) => knownPlayerRecordSchema.safeParse(rawPlayer))
            .filter((result) => result.success)
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
    }
    catch {
        return [];
    }
}
export function getKnownPlayerForServer(serverId, playerKeyOrName) {
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
export function getIdentityObservationsForPlayer(serverId, player, limit = 20) {
    const path = resolveStorePath();
    try {
        const content = readFileSync(path, 'utf8');
        const parsedRoot = JSON.parse(content);
        const rawObservations = Array.isArray(parsedRoot.observations) ? parsedRoot.observations : [];
        const parsedObservations = rawObservations
            .map((rawObservation) => identityObservationSchema.safeParse(rawObservation))
            .filter((result) => result.success)
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
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=known-player-store.js.map