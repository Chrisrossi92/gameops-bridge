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
  player_name: z.string().optional(),
  accountName: z.string().optional(),
  account_name: z.string().optional(),
  playerId: z.string().optional(),
  player_id: z.string().optional(),
  userId: z.string().optional(),
  user_id: z.string().optional(),
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
export type PalworldMetricsResponse = Record<string, unknown>;
export type PalworldSettingsResponse = Record<string, unknown>;

export interface PalworldPlayerIdentity {
  lookupKey: string;
  playerName: string;
  playerId?: string;
  userId?: string;
  accountName?: string;
}

function normalizeString(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeNumber(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeInteger(value: number | undefined): number | null {
  return Number.isInteger(value) ? value : null;
}

function normalizePlayerName(value: string | undefined): string | null {
  return normalizeString(value);
}

export function getPlayerName(player: PalworldRestPlayer): string | null {
  return normalizePlayerName(player.name) ?? normalizePlayerName(player.player_name);
}

export function getPlayerAccountName(player: PalworldRestPlayer): string | null {
  return normalizeString(player.accountName) ?? normalizeString(player.account_name);
}

export function getPlayerPlayerId(player: PalworldRestPlayer): string | null {
  return normalizeString(player.playerId) ?? normalizeString(player.player_id);
}

export function getPlayerUserId(player: PalworldRestPlayer): string | null {
  return normalizeString(player.userId) ?? normalizeString(player.user_id);
}

export function getPlayerIp(player: PalworldRestPlayer): string | null {
  return normalizeString(player.ip);
}

export function getPlayerPing(player: PalworldRestPlayer): number | null {
  return normalizeNumber(player.ping);
}

export function getPlayerLevel(player: PalworldRestPlayer): number | null {
  return normalizeInteger(player.level);
}

export function getPlayerBuildingCount(player: PalworldRestPlayer): number | null {
  return normalizeInteger(player.building_count);
}

export function getPlayerLocationX(player: PalworldRestPlayer): number | null {
  return normalizeNumber(player.location_x);
}

export function getPlayerLocationY(player: PalworldRestPlayer): number | null {
  return normalizeNumber(player.location_y);
}

export function deriveRegionName(locationX: number | null, locationY: number | null): string | null {
  if (locationX === null || locationY === null) {
    return null;
  }

  if (Math.abs(locationX) <= 100 && Math.abs(locationY) <= 100) {
    return 'central-plains';
  }

  if (locationX >= 0 && locationY >= 0) {
    return 'northeast-frontier';
  }

  if (locationX < 0 && locationY >= 0) {
    return 'northwest-frontier';
  }

  if (locationX < 0 && locationY < 0) {
    return 'southwest-frontier';
  }

  return 'southeast-frontier';
}

function buildLookupKey(player: PalworldRestPlayer): string | null {
  const playerId = getPlayerPlayerId(player);

  if (playerId) {
    return `player:${playerId}`;
  }

  const userId = getPlayerUserId(player);

  if (userId) {
    return `user:${userId}`;
  }

  const name = getPlayerName(player) ?? getPlayerAccountName(player);

  if (name) {
    return `name:${name.toLowerCase()}`;
  }

  return null;
}

function toPlayerIdentity(player: PalworldRestPlayer): PalworldPlayerIdentity | null {
  const lookupKey = buildLookupKey(player);
  const playerName = getPlayerName(player) ?? getPlayerAccountName(player);

  if (!lookupKey || !playerName) {
    return null;
  }

  return {
    lookupKey,
    playerName,
    ...(getPlayerPlayerId(player) ? { playerId: getPlayerPlayerId(player) ?? undefined } : {}),
    ...(getPlayerUserId(player) ? { userId: getPlayerUserId(player) ?? undefined } : {}),
    ...(getPlayerAccountName(player) ? { accountName: getPlayerAccountName(player) ?? undefined } : {})
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

function stripKnownEndpointSuffix(path: string): string {
  return path.replace(/\/(players|metrics|settings)$/i, '');
}

function buildCandidateUrls(config: PalworldRestConfig, endpoint: 'players' | 'metrics' | 'settings'): string[] {
  const normalizedPath = normalizePath(config.path);
  const baseUrl = `http://${config.host}:${config.port}`;
  const basePath = stripKnownEndpointSuffix(normalizedPath);
  const directPath = normalizedPath.toLowerCase().endsWith(`/${endpoint}`)
    ? normalizedPath
    : `${basePath}/${endpoint}`;
  const fallback = `/${endpoint}`;

  return Array.from(new Set([
    `${baseUrl}${directPath}`,
    `${baseUrl}${fallback}`
  ]));
}

async function fetchJson(url: string, authHeader: string): Promise<Response> {
  return fetch(url, {
    headers: {
      authorization: authHeader,
      accept: 'application/json'
    }
  });
}

async function fetchEndpointJson(
  config: PalworldRestConfig,
  endpoint: 'players' | 'metrics' | 'settings'
): Promise<unknown> {
  const authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  const candidateUrls = buildCandidateUrls(config, endpoint);
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
      throw new Error(`Palworld REST /${endpoint} failed (${response.status}) at ${url}: ${body.slice(0, 200)}`);
    }

    return await response.json();
  }

  throw lastError ?? new Error(`Palworld REST /${endpoint} request failed`);
}

function parseRecordResponse(payload: unknown): Record<string, unknown> {
  return z.record(z.string(), z.unknown()).parse(payload);
}

export async function fetchPlayers(config: PalworldRestConfig): Promise<PalworldRestPlayer[]> {
  return parsePlayersResponse(await fetchEndpointJson(config, 'players'));
}

export async function fetchMetrics(config: PalworldRestConfig): Promise<PalworldMetricsResponse> {
  return parseRecordResponse(await fetchEndpointJson(config, 'metrics'));
}

export async function fetchSettings(config: PalworldRestConfig): Promise<PalworldSettingsResponse> {
  return parseRecordResponse(await fetchEndpointJson(config, 'settings'));
}
