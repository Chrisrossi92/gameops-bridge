import {
  communityActivityResponseSchema,
  type CommunityActivityResponse
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { getCommunityActivityForServer } from '../services/community-activity.js';
import { measureSync } from '../services/request-performance.js';

export async function registerCommunityActivityRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string } }>('/servers/:serverId/community-activity', async (request, reply): Promise<CommunityActivityResponse | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    return measureSync('community-activity', () => communityActivityResponseSchema.parse(getCommunityActivityForServer(serverId)));
  });
}
