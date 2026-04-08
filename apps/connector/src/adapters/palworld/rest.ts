import { z } from 'zod';
import { normalizedEventSchema, type NormalizedEvent } from '@gameops/shared';

export interface PalworldRestConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  path?: string;
}

const palworldPlayerSchema = z.object({
  name: z.string().optional(),
  accountName: z.string().optional(),
  playerId: z.string().optional(),
  userId: z.string().optional(),
  ip: z.string().optional(),
  ping: z.number().optional(),
  location_x: z.number().optional(),
  location_y: z.number().optional(),
  level: z.number().int().optional(),
  building_count: z.number().int().optional()
}).catchall(z.unknown());

const palworldPlayersResponseSchema = z.object({
  players: z.array(palworldPlayerSchema)
});

export type PalworldRestPlayer = z.infer<typeof palworldPlayerSchema>;

export interface PalworldPlayerIdentity {
  lookupKey: string;
  playerName: string;
  playerId?: string;
  userId?: string;
  accountName?: string;
}

function normalizePlayerName(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildLookupKey(player: PalworldRestPlayer): string | null {
  const playerId = player.playerId?.trim();

  if (playerId) {
    return `player:${playerId}`;
  }

  const userId = player.userId?.trim();

  if (userId) {
    return `user:${userId}`;
  }

  const name = normalizePlayerName(player.name) ?? normalizePlayerName(player.accountName);

  if (name) {
    return `name:${name.toLowerCase()}`;
  }

  return null;
}

function toPlayerIdentity(player: PalworldRestPlayer): PalworldPlayerIdentity | null {
  const lookupKey = buildLookupKey(player);
  const playerName = normalizePlayerName(player.name) ?? normalizePlayerName(player.accountName);

  if (!lookupKey || !playerName) {
    return null;
  }

  return {
    lookupKey,
    playerName,
    ...(player.playerId?.trim() ? { playerId: player.playerId.trim() } : {}),
    ...(player.userId?.trim() ? { userId: player.userId.trim() } : {}),
    ...(player.accountName?.trim() ? { accountName: player.accountName.trim() } : {})
  };
}

export function parsePlayersResponse(payload: unknown): PalworldRestPlayer[] {
  return palworldPlayersResponseSchema.parse(payload).players;
}

export function buildPlayerSnapshot(players: PalworldRestPlayer[]): Map<string, PalworldPlayerIdentity> {
  const snapshot = new Map<string, PalworldPlayerIdentity>();

  for (const player of players) {
    const identity = toPlayerIdentity(player);

    if (!identity) {
      continue;
    }

    snapshot.set(identity.lookupKey, identity);
  }

  return snapshot;
}

function createEvent(input: Omit<NormalizedEvent, 'game'>): NormalizedEvent {
  return normalizedEventSchema.parse({
    ...input,
    game: 'palworld'
  });
}

export function buildServerOnlineEvent(serverId: string, occurredAt: string, playerCount: number): NormalizedEvent {
  return createEvent({
    serverId,
    eventType: 'SERVER_ONLINE',
    occurredAt,
    message: `Palworld REST API poll succeeded with ${playerCount} player(s) online.`,
    raw: {
      palworldEventSource: 'rest_players',
      palworldCurrentPlayerCount: playerCount
    }
  });
}

export function buildHealthWarnEvent(serverId: string, occurredAt: string, failureCount: number, message: string): NormalizedEvent {
  return createEvent({
    serverId,
    eventType: 'HEALTH_WARN',
    occurredAt,
    message,
    raw: {
      palworldEventSource: 'rest_players',
      palworldFailureCount: failureCount
    }
  });
}

export function diffPlayerSnapshots(
  previousSnapshot: Map<string, PalworldPlayerIdentity>,
  currentSnapshot: Map<string, PalworldPlayerIdentity>,
  serverId: string,
  occurredAt: string
): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const currentPlayerCount = currentSnapshot.size;

  for (const [lookupKey, player] of currentSnapshot.entries()) {
    if (previousSnapshot.has(lookupKey)) {
      continue;
    }

    events.push(createEvent({
      serverId,
      eventType: 'PLAYER_JOIN',
      playerName: player.playerName,
      platformId: player.userId,
      occurredAt,
      message: `${player.playerName} joined Palworld`,
      raw: {
        palworldEventSource: 'rest_players',
        palworldLookupKey: lookupKey,
        palworldCurrentPlayerCount: currentPlayerCount,
        palworldPlayerId: player.playerId,
        palworldUserId: player.userId,
        palworldAccountName: player.accountName
      }
    }));
  }

  for (const [lookupKey, player] of previousSnapshot.entries()) {
    if (currentSnapshot.has(lookupKey)) {
      continue;
    }

    events.push(createEvent({
      serverId,
      eventType: 'PLAYER_LEAVE',
      playerName: player.playerName,
      platformId: player.userId,
      occurredAt,
      message: `${player.playerName} left Palworld`,
      raw: {
        palworldEventSource: 'rest_players',
        palworldLookupKey: lookupKey,
        palworldCurrentPlayerCount: currentPlayerCount,
        palworldPlayerId: player.playerId,
        palworldUserId: player.userId,
        palworldAccountName: player.accountName
      }
    }));
  }

  return events;
}

function normalizePath(path: string | undefined): string {
  const trimmed = path?.trim();

  if (!trimmed) {
    return '/v1/api';
  }

  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/+$/, '');
}

function buildCandidateUrls(config: PalworldRestConfig): string[] {
  const normalizedPath = normalizePath(config.path);
  const baseUrl = `http://${config.host}:${config.port}`;
  const preferred = `${baseUrl}${normalizedPath}/players`;
  const fallback = `${baseUrl}/players`;

  return preferred === fallback ? [preferred] : [preferred, fallback];
}

async function fetchJson(url: string, authHeader: string): Promise<Response> {
  return fetch(url, {
    headers: {
      authorization: authHeader,
      accept: 'application/json'
    }
  });
}

export async function fetchPlayers(config: PalworldRestConfig): Promise<PalworldRestPlayer[]> {
  const authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  const candidateUrls = buildCandidateUrls(config);
  let lastError: Error | null = null;

  for (const url of candidateUrls) {
    let response: Response;

    try {
      response = await fetchJson(url, authHeader);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }

    if (response.status === 404) {
      lastError = new Error(`Palworld REST endpoint not found at ${url}`);
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Palworld REST /players failed (${response.status}) at ${url}: ${body.slice(0, 200)}`);
    }

    return parsePlayersResponse(await response.json());
  }

  throw lastError ?? new Error('Palworld REST /players request failed');
}
