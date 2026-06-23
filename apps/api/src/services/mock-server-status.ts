import { serverStatusSchema, type GameKey, type ServerStatus } from '@gameops/shared';

const states: ServerStatus['state'][] = ['online', 'degraded', 'restarting', 'offline'];

export function getMockServerStatus(serverId: string, game: GameKey = 'valheim'): ServerStatus {
  const hash = Array.from(serverId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const state = states[hash % states.length];
  const maxPlayers = 20;
  const playerCount = state === 'offline' ? 0 : hash % maxPlayers;
  const message = state === 'online'
    ? 'Server catalog is loaded, but no live connector heartbeat has been received yet.'
    : 'Using catalog-only status. Start the connector to begin live health and player tracking.';

  return serverStatusSchema.parse({
    serverId,
    game,
    state,
    playerCount,
    maxPlayers,
    lastCheckedAt: new Date().toISOString(),
    message
  });
}
