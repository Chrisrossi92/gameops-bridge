import type { FastifyInstance } from 'fastify';
import { getMockServerStatus } from '../services/mock-server-status.js';

export async function registerServerStatusRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string } }>('/servers/:serverId/status', async (request, reply) => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return {
        error: 'Invalid serverId'
      };
    }

    return getMockServerStatus(serverId);
  });
}
