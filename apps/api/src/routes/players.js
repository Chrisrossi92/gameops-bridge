import { knownPlayerProfileResponseSchema, knownPlayersResponseSchema } from '@gameops/shared';
import { getKnownPlayerForServer, getKnownPlayersForServer } from '../services/known-player-store.js';
export async function registerPlayerRoutes(app) {
    app.get('/servers/:serverId/players/known', async (request, reply) => {
        const serverId = request.params.serverId.trim();
        if (!serverId) {
            reply.code(400);
            return { error: 'Invalid serverId' };
        }
        const parsedLimit = Number(request.query.limit);
        const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;
        return knownPlayersResponseSchema.parse({
            serverId,
            players: getKnownPlayersForServer(serverId, limit)
        });
    });
    app.get('/servers/:serverId/players/known/:playerKey', async (request, reply) => {
        const serverId = request.params.serverId.trim();
        const playerKey = decodeURIComponent(request.params.playerKey).trim();
        if (!serverId) {
            reply.code(400);
            return { error: 'Invalid serverId' };
        }
        if (!playerKey) {
            reply.code(400);
            return { error: 'Invalid playerKey' };
        }
        return knownPlayerProfileResponseSchema.parse({
            serverId,
            player: getKnownPlayerForServer(serverId, playerKey)
        });
    });
}
//# sourceMappingURL=players.js.map