import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { knownPlayerRecordSchema } from '@gameops/shared';
function resolveStorePath() {
    const rawPath = process.env.KNOWN_PLAYER_STORE_PATH ?? '../known-players.json';
    return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
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
            .map((result) => result.data);
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
//# sourceMappingURL=known-player-store.js.map