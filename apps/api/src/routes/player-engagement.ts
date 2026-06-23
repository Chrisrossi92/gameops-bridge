import {
  playerEngagementDetailSchema,
  playerEngagementSummarySchema,
  type PlayerEngagementDetail,
  type PlayerEngagementSummary
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { getPlayerEngagementDetailForServer, getPlayerEngagementSummaryForServer } from '../services/player-engagement.js';

export async function registerPlayerEngagementRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string } }>('/servers/:serverId/player-engagement', async (request, reply): Promise<PlayerEngagementSummary | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    return playerEngagementSummarySchema.parse(getPlayerEngagementSummaryForServer(serverId));
  });

  app.get<{ Params: { serverId: string; playerId: string } }>('/servers/:serverId/player-engagement/:playerId/detail', async (request, reply): Promise<PlayerEngagementDetail | { error: string; explanation?: string }> => {
    const serverId = request.params.serverId.trim();
    const playerId = decodeURIComponent(request.params.playerId).trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    if (!playerId) {
      reply.code(400);
      return { error: 'Invalid playerId' };
    }

    const detail = getPlayerEngagementDetailForServer(serverId, playerId);

    if (!detail) {
      reply.code(404);
      return {
        error: 'Player engagement not found',
        explanation: 'No engagement data has been observed for this player yet.'
      };
    }

    return playerEngagementDetailSchema.parse(detail);
  });
}
