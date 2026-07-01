import {
  serverHealthSummarySchema,
  type ServerHealthSummary
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { getServerHealthSummary } from '../services/server-health.js';
import { measureSync } from '../services/request-performance.js';

export async function registerServerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string } }>('/servers/:serverId/server-health', async (request, reply): Promise<ServerHealthSummary | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    return measureSync('server-health', () => serverHealthSummarySchema.parse(getServerHealthSummary(serverId)));
  });
}
