import {
  palworldLatestPlayersResponseSchema,
  palworldPlayerSnapshotsResponseSchema,
  palworldMetricsSummariesResponseSchema,
  palworldPlayerTelemetryProfileResponseSchema,
  type PalworldLatestPlayersResponse,
  type PalworldPlayerSnapshotsResponse,
  type PalworldMetricsSummariesResponse,
  type PalworldPlayerTelemetryProfileResponse
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import {
  getLatestPalworldPlayerForServer,
  getLatestPalworldPlayersForServer,
  getRecentPalworldPlayerSnapshotsForPlayer,
  getRecentPalworldPlayerSnapshotsForServer,
  getRecentPalworldMetricsForServer
} from '../services/palworld-telemetry-store.js';

export async function registerPalworldTelemetryRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>(
    '/servers/:serverId/palworld/players/latest',
    async (request, reply): Promise<PalworldLatestPlayersResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      const parsedLimit = Number(request.query.limit);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;

      return palworldLatestPlayersResponseSchema.parse({
        serverId,
        players: getLatestPalworldPlayersForServer(serverId, limit)
      });
    }
  );

  app.get<{ Params: { serverId: string; playerKey: string } }>(
    '/servers/:serverId/palworld/players/latest/:playerKey',
    async (request, reply): Promise<PalworldPlayerTelemetryProfileResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();
      const playerKey = decodeURIComponent(request.params.playerKey).trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      if (!playerKey) {
        reply.code(400);
        return { error: 'Invalid playerKey' };
      }

      return palworldPlayerTelemetryProfileResponseSchema.parse({
        serverId,
        player: getLatestPalworldPlayerForServer(serverId, playerKey)
      });
    }
  );

  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>(
    '/servers/:serverId/palworld/players/snapshots/recent',
    async (request, reply): Promise<PalworldPlayerSnapshotsResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      const parsedLimit = Number(request.query.limit);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 50;

      return palworldPlayerSnapshotsResponseSchema.parse({
        serverId,
        snapshots: getRecentPalworldPlayerSnapshotsForServer(serverId, limit)
      });
    }
  );

  app.get<{ Params: { serverId: string; playerKey: string }; Querystring: { limit?: string } }>(
    '/servers/:serverId/palworld/players/latest/:playerKey/history',
    async (request, reply): Promise<PalworldPlayerSnapshotsResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();
      const playerKey = decodeURIComponent(request.params.playerKey).trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      if (!playerKey) {
        reply.code(400);
        return { error: 'Invalid playerKey' };
      }

      const parsedLimit = Number(request.query.limit);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 20;

      return palworldPlayerSnapshotsResponseSchema.parse({
        serverId,
        snapshots: getRecentPalworldPlayerSnapshotsForPlayer(serverId, playerKey, limit)
      });
    }
  );

  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>(
    '/servers/:serverId/palworld/metrics/recent',
    async (request, reply): Promise<PalworldMetricsSummariesResponse | { error: string }> => {
      const serverId = request.params.serverId.trim();

      if (!serverId) {
        reply.code(400);
        return { error: 'Invalid serverId' };
      }

      const parsedLimit = Number(request.query.limit);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;

      return palworldMetricsSummariesResponseSchema.parse({
        serverId,
        metrics: getRecentPalworldMetricsForServer(serverId, limit)
      });
    }
  );
}
