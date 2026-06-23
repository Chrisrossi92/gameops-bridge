import {
  dataFreshnessResponseSchema,
  type DataFreshnessResponse
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { getDataFreshnessForServer } from '../services/data-freshness.js';

export async function registerDataFreshnessRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string } }>('/servers/:serverId/data-freshness', async (request, reply): Promise<DataFreshnessResponse | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    return dataFreshnessResponseSchema.parse(getDataFreshnessForServer(serverId));
  });
}
