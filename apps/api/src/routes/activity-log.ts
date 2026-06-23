import {
  activityLogResponseSchema,
  type ActivityLogResponse
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { getActivityLogForServer } from '../services/activity-log.js';

export async function registerActivityLogRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>(
    '/servers/:serverId/activity-log',
    async (request, reply): Promise<ActivityLogResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      const parsedLimit = Number(request.query.limit);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;

      return activityLogResponseSchema.parse({
        serverId,
        items: getActivityLogForServer(serverId, limit)
      });
    }
  );
}
