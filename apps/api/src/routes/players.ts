import {
  knownPlayerProfileResponseSchema,
  knownPlayersResponseSchema,
  type KnownPlayerProfileResponse,
  type KnownPlayersResponse
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { getActiveSessionsForServer, getRecentClosedSessionsForServer } from '../services/event-store.js';
import { getKnownPlayerForServer, getKnownPlayersForServer } from '../services/known-player-store.js';

function normalizePlayerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isSamePlayer(sessionPlayerName: string, normalizedPlayerKey: string, displayName: string): boolean {
  const normalizedSessionName = normalizePlayerKey(sessionPlayerName);
  return normalizedSessionName === normalizedPlayerKey || normalizedSessionName === normalizePlayerKey(displayName);
}

export async function registerPlayerRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>('/servers/:serverId/players/known', async (request, reply): Promise<KnownPlayersResponse | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    const parsedLimit = Number(request.query.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;

    return knownPlayersResponseSchema.parse({
      serverId,
      players: getKnownPlayersForServer(serverId, limit)
    });
  });

  app.get<{ Params: { serverId: string; playerKey: string } }>('/servers/:serverId/players/known/:playerKey', async (request, reply): Promise<KnownPlayerProfileResponse | { error: string }> => {
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

    const player = getKnownPlayerForServer(serverId, playerKey);

    if (!player) {
      return knownPlayerProfileResponseSchema.parse({
        serverId,
        player: null,
        isOnline: false,
        activeSession: null,
        recentSessions: []
      });
    }

    const activeSession = getActiveSessionsForServer(serverId).find((session) =>
      isSamePlayer(session.playerName, player.normalizedPlayerKey, player.displayName)
    ) ?? null;

    const recentSessions = getRecentClosedSessionsForServer(serverId, 50)
      .filter((session) => isSamePlayer(session.playerName, player.normalizedPlayerKey, player.displayName))
      .slice(0, 5);

    return knownPlayerProfileResponseSchema.parse({
      serverId,
      player,
      isOnline: activeSession !== null,
      activeSession,
      recentSessions
    });
  });
}
