import {
  activeSessionsResponseSchema,
  recentSessionsResponseSchema,
  sessionTimelineResponseSchema,
  type ActiveSessionsResponse,
  type RecentSessionsResponse,
  type SessionTimelineResponse
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { getActiveSessionsForServer, getRecentClosedSessionsForServer } from '../services/event-store.js';
import { measureSync } from '../services/request-performance.js';
import { getSessionTimelineForServer } from '../services/session-timeline.js';

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

  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>('/servers/:serverId/session-timeline', async (request, reply): Promise<SessionTimelineResponse | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    const parsedLimit = Number(request.query.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;

    return measureSync('session-timeline', () => sessionTimelineResponseSchema.parse(getSessionTimelineForServer(serverId, limit)));
  });
}
