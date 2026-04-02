import {
  activeSessionsResponseSchema,
  recentSessionsResponseSchema,
  type ActiveSessionsResponse,
  type RecentSessionsResponse
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { getActiveSessionsForServer, getRecentClosedSessionsForServer } from '../services/event-store.js';

export async function registerSessionRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string } }>('/servers/:serverId/sessions/active', async (request, reply): Promise<ActiveSessionsResponse | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    return activeSessionsResponseSchema.parse({
      serverId,
      sessions: getActiveSessionsForServer(serverId)
    });
  });

  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>('/servers/:serverId/sessions/recent', async (request, reply): Promise<RecentSessionsResponse | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    const parsedLimit = Number(request.query.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 10;

    return recentSessionsResponseSchema.parse({
      serverId,
      sessions: getRecentClosedSessionsForServer(serverId, limit)
    });
  });
}
