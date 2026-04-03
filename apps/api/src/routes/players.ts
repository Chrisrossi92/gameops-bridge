import { knownPlayersResponseSchema, type KnownPlayersResponse } from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { getKnownPlayersForServer } from '../services/known-player-store.js';

export async function registerPlayerRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>('/servers/:serverId/players/known', async (request, reply): Promise<KnownPlayersResponse | { error: string }> => {
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
}
