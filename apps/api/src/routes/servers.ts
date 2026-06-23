import {
  configuredServersResponseSchema,
  type ConfiguredServersResponse
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { loadGameOpsConfig } from '../services/server-config.js';

export async function registerServerCatalogRoutes(app: FastifyInstance): Promise<void> {
  app.get('/servers/catalog', async (request, reply): Promise<ConfiguredServersResponse | { error: string }> => {
    try {
      const config = loadGameOpsConfig();

      const servers = config.servers
        .filter((server) => server.enabled !== false)
        .map((server) => ({
          id: server.id,
          displayName: server.displayName,
          game: server.game
        }));

      return configuredServersResponseSchema.parse({ servers });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      request.log.warn(`[servers/catalog] failed-to-load-config reason=${message}`);
      reply.code(500);
      return { error: 'Unable to load configured servers' };
    }
  });
}
