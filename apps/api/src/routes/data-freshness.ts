import {
  dataFreshnessResponseSchema,
  type DataFreshnessResponse
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { getDataFreshnessForServer } from '../services/data-freshness.js';
import { measureSync } from '../services/request-performance.js';

export async function registerDataFreshnessRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string } }>('/servers/:serverId/data-freshness', async (request, reply): Promise<DataFreshnessResponse | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    return measureSync('data-freshness', () => dataFreshnessResponseSchema.parse(getDataFreshnessForServer(serverId)));
  });
}
