import {
  knownPlayerProfileResponseSchema,
  knownPlayersResponseSchema,
  playerCharacterAuditResponseSchema,
  type KnownPlayerProfileResponse,
  type KnownPlayersResponse,
  type PlayerCharacterAuditAssessment,
  type PlayerCharacterAuditResponse
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { getActiveSessionsForServer, getRecentClosedSessionsForServer } from '../services/event-store.js';
import { getIdentityObservationsForPlayer, getKnownPlayerForServer, getKnownPlayersForServer } from '../services/known-player-store.js';

function normalizePlayerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isSamePlayer(sessionPlayerName: string, normalizedPlayerKey: string, displayName: string): boolean {
  const normalizedSessionName = normalizePlayerKey(sessionPlayerName);
  return normalizedSessionName === normalizedPlayerKey || normalizedSessionName === normalizePlayerKey(displayName);
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => (value ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function getAuditAssessment(params: {
  totalObservations: number;
  platformCount: number;
  playFabCount: number;
  characterCount: number;
}): PlayerCharacterAuditAssessment {
  if (params.characterCount === 0 || params.totalObservations < 2) {
    return 'insufficient_evidence';
  }

  if (params.characterCount === 1) {
    return 'single_character_observed';
  }

  const hasStrongAccountId = params.platformCount > 0 || params.playFabCount > 0;

  if (hasStrongAccountId && params.totalObservations >= 3) {
    return 'multiple_characters_observed';
  }

  return 'possible_multiple_characters';
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

  app.get<{ Params: { serverId: string; playerKey: string } }>('/servers/:serverId/players/known/:playerKey/audit', async (request, reply): Promise<PlayerCharacterAuditResponse | { error: string }> => {
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
      return playerCharacterAuditResponseSchema.parse({
        serverId,
        player: null,
        distinctPlatformIds: [],
        distinctPlayFabIds: [],
        distinctCharacterIds: [],
        recentObservations: [],
        totalObservations: 0,
        assessment: 'insufficient_evidence'
      });
    }

    const observations = getIdentityObservationsForPlayer(serverId, player, 25);
    const distinctPlatformIds = uniqueSorted(observations.map((observation) => observation.platformId));
    const distinctPlayFabIds = uniqueSorted(observations.map((observation) => observation.playFabId));
    const distinctCharacterIds = uniqueSorted(observations.map((observation) => observation.characterId));

    return playerCharacterAuditResponseSchema.parse({
      serverId,
      player,
      distinctPlatformIds,
      distinctPlayFabIds,
      distinctCharacterIds,
      recentObservations: observations,
      totalObservations: observations.length,
      assessment: getAuditAssessment({
        totalObservations: observations.length,
        platformCount: distinctPlatformIds.length,
        playFabCount: distinctPlayFabIds.length,
        characterCount: distinctCharacterIds.length
      })
    });
  });
}
