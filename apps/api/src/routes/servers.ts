import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import {
  configuredServersResponseSchema,
  gameOpsConfigSchema,
  type ConfiguredServersResponse
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';

function resolveConfigPath(): string {
  const rawPath = process.env.GAMEOPS_CONFIG_PATH ?? './config/gameops.config.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

export async function registerServerCatalogRoutes(app: FastifyInstance): Promise<void> {
  app.get('/servers/catalog', async (request, reply): Promise<ConfiguredServersResponse | { error: string }> => {
    try {
      const configPath = resolveConfigPath();
      const raw = readFileSync(configPath, 'utf8');
      const config = gameOpsConfigSchema.parse(JSON.parse(raw) as unknown);

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
