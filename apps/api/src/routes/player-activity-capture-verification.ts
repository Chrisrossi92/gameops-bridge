import {
  playerActivityCaptureVerificationSchema,
  type PlayerActivityCaptureVerification
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { getPlayerActivityCaptureVerificationForServer } from '../services/player-activity-capture-verification.js';
import { measureSync } from '../services/request-performance.js';

export async function registerPlayerActivityCaptureVerificationRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string } }>('/servers/:serverId/player-activity-capture-verification', async (request, reply): Promise<PlayerActivityCaptureVerification | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    return measureSync('player-activity-capture-verification', () => (
      playerActivityCaptureVerificationSchema.parse(getPlayerActivityCaptureVerificationForServer(serverId))
    ));
  });
}
