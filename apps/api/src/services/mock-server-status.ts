import { serverStatusSchema, type ServerStatus } from '@gameops/shared';

const states: ServerStatus['state'][] = ['online', 'degraded', 'restarting', 'offline'];

export function getMockServerStatus(serverId: string): ServerStatus {
  const hash = Array.from(serverId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const state = states[hash % states.length];
  const maxPlayers = 20;
  const playerCount = state === 'offline' ? 0 : hash % maxPlayers;

  return serverStatusSchema.parse({
    serverId,
    game: 'valheim',
    state,
    playerCount,
    maxPlayers,
    lastCheckedAt: new Date().toISOString(),
    message: state === 'online' ? 'Server healthy' : 'Using mocked status data'
  });
}
