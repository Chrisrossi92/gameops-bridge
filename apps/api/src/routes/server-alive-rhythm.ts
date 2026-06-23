import {
  serverAliveRhythmSummarySchema,
  type ServerAliveRhythmSummary
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { getServerAliveRhythmSummary } from '../services/server-alive-rhythm.js';

export async function registerServerAliveRhythmRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string } }>('/servers/:serverId/server-alive-rhythm', async (request, reply): Promise<ServerAliveRhythmSummary | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    return serverAliveRhythmSummarySchema.parse(getServerAliveRhythmSummary(serverId));
  });
}
