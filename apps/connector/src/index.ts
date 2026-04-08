import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import {
  gameKeySchema,
  gameOpsConfigSchema,
  ingestEventsRequestSchema,
  type GameOpsConfig,
  type IdentityConfidence,
  type NormalizedEvent
} from '@gameops/shared';
import { getAdapter } from './adapters/index.js';
import {
  buildHealthWarnEvent,
  buildPlayerSnapshot,
  buildServerOnlineEvent,
  diffPlayerSnapshots,
  fetchMetrics,
  fetchPlayers,
  fetchSettings,
  type PalworldPlayerIdentity
} from './adapters/palworld/rest.js';
import { persistPalworldTelemetry } from './adapters/palworld/telemetry-store.js';
import { startValheimJournalStream } from './adapters/valheim/journal.js';
import { findKnownPlayer, upsertKnownPlayerObservation } from './identity/known-player-store.js';

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name} in apps/connector/.env`);
  }

  return value;
}

const runtimeConnectorModeSchema = z.enum(['file', 'journal', 'rest', 'rcon', 'query']);
type ConnectorMode = z.infer<typeof runtimeConnectorModeSchema>;

interface ConnectorRuntimeSettings {
  serverId: string;
  game: z.infer<typeof gameKeySchema>;
  mode: ConnectorMode;
  apiBaseUrl: string;
  pollIntervalMs: number;
  logFile?: string;
  journalServiceName?: string;
  restHost?: string;
  restPort?: number;
  restUsername?: string;
  restPassword?: string;
  restPath?: string;
}

function resolveConfigPath(): string {
  const rawPath = process.env.GAMEOPS_CONFIG_PATH ?? './config/gameops.config.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function selectConfiguredServer(config: GameOpsConfig): GameOpsConfig['servers'][number] {
  const enabledServers = config.servers.filter((server) => server.enabled !== false);

  if (enabledServers.length === 0) {
    throw new Error('No enabled servers found in config/gameops.config.json');
  }

  const requestedServerId = process.env.CONNECTOR_SERVER_ID?.trim();

  if (requestedServerId) {
    const match = enabledServers.find((server) => server.id === requestedServerId);

    if (!match) {
      const known = enabledServers.map((server) => server.id).join(', ');
      throw new Error(`CONNECTOR_SERVER_ID="${requestedServerId}" not found among enabled servers: ${known}`);
    }

    return match;
  }

  if (enabledServers.length === 1) {
    return enabledServers[0]!;
  }

  const known = enabledServers.map((server) => server.id).join(', ');
  throw new Error(`Multiple enabled servers found. Set CONNECTOR_SERVER_ID to one of: ${known}`);
}

function resolveFromSharedConfig(): ConnectorRuntimeSettings | null {
  const configPath = resolveConfigPath();

  try {
    const raw = readFileSync(configPath, 'utf8');
    const parsed = gameOpsConfigSchema.parse(JSON.parse(raw) as unknown);
    const selected = selectConfiguredServer(parsed);

    const mode = runtimeConnectorModeSchema.parse(selected.connector.mode);
    const apiBaseUrl = process.env.API_BASE_URL ?? parsed.api.baseUrl;
    const pollIntervalMs = parsePositiveInt(process.env.POLL_INTERVAL_MS, selected.connector.pollIntervalMs);
    const envLogFile = process.env.VALHEIM_LOG_FILE?.trim();
    const envJournalService = process.env.VALHEIM_JOURNAL_SERVICE?.trim();
    const resolvedLogFile = envLogFile || selected.connector.logPath;
    const resolvedJournalService = envJournalService || selected.connector.journalServiceName;

    const settings: ConnectorRuntimeSettings = {
      serverId: selected.id,
      game: selected.game,
      mode,
      apiBaseUrl,
      pollIntervalMs
    };

    if (resolvedLogFile) {
      settings.logFile = resolvedLogFile;
    }

    if (resolvedJournalService) {
      settings.journalServiceName = resolvedJournalService;
    }

    if (selected.game === 'palworld') {
      const resolvedRestHost = process.env.PALWORLD_REST_HOST?.trim() || selected.connector.restHost;
      const resolvedRestUsername = process.env.PALWORLD_REST_USERNAME?.trim() || selected.connector.restUsername;
      const resolvedRestPassword = process.env.PALWORLD_REST_PASSWORD?.trim() || selected.connector.restPassword;
      const resolvedRestPath = process.env.PALWORLD_REST_PATH?.trim() || selected.connector.restPath;

      if (resolvedRestHost) {
        settings.restHost = resolvedRestHost;
      }

      settings.restPort = parsePositiveInt(process.env.PALWORLD_REST_PORT, selected.connector.restPort ?? 8212);

      if (resolvedRestUsername) {
        settings.restUsername = resolvedRestUsername;
      }

      if (resolvedRestPassword) {
        settings.restPassword = resolvedRestPassword;
      }

      if (resolvedRestPath) {
        settings.restPath = resolvedRestPath;
      }
    }

    return settings;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[connector] shared-config-unavailable path=${configPath} reason=${message}`);
    return null;
  }
}

function resolveFromLegacyEnv(): ConnectorRuntimeSettings {
  const game = gameKeySchema.parse(process.env.GAME_KEY ?? 'valheim');
  const logFileFromEnv = game === 'palworld'
    ? process.env.PALWORLD_LOG_FILE ?? process.env.VALHEIM_LOG_FILE
    : process.env.VALHEIM_LOG_FILE;

  return {
    game,
    mode: runtimeConnectorModeSchema.parse(process.env.CONNECTOR_MODE ?? 'file'),
    serverId: getRequiredEnv('CONNECTOR_SERVER_ID'),
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3001',
    pollIntervalMs: parsePositiveInt(process.env.POLL_INTERVAL_MS, 2000),
    ...(logFileFromEnv ? { logFile: logFileFromEnv } : {}),
    ...(process.env.VALHEIM_JOURNAL_SERVICE ? { journalServiceName: process.env.VALHEIM_JOURNAL_SERVICE } : {}),
    ...(process.env.PALWORLD_REST_HOST ? { restHost: process.env.PALWORLD_REST_HOST } : {}),
    ...(process.env.PALWORLD_REST_PORT ? { restPort: parsePositiveInt(process.env.PALWORLD_REST_PORT, 8212) } : {}),
    ...(process.env.PALWORLD_REST_USERNAME ? { restUsername: process.env.PALWORLD_REST_USERNAME } : {}),
    ...(process.env.PALWORLD_REST_PASSWORD ? { restPassword: process.env.PALWORLD_REST_PASSWORD } : {}),
    ...(process.env.PALWORLD_REST_PATH ? { restPath: process.env.PALWORLD_REST_PATH } : {})
  };
}

function resolveRuntimeSettings(): ConnectorRuntimeSettings {
  return resolveFromSharedConfig() ?? resolveFromLegacyEnv();
}

const runtime = resolveRuntimeSettings();
const game = runtime.game;
const mode = runtime.mode;
const serverId = runtime.serverId;
const apiBaseUrl = runtime.apiBaseUrl;
const pollIntervalMs = runtime.pollIntervalMs;
const logFile = runtime.logFile;
const journalServiceName = runtime.journalServiceName;
const restHost = runtime.restHost;
const restPort = runtime.restPort;
const restUsername = runtime.restUsername;
const restPassword = runtime.restPassword;
const restPath = runtime.restPath;

const adapter = getAdapter(game);
let processedLineCount = 0;

const IDENTITY_BUFFER_MAX = 25;
const IDENTITY_CORRELATION_WINDOW_MS = 20_000;
const PENDING_JOIN_BUFFER_MAX = 30;
const PENDING_JOIN_TTL_MS = 30_000;

interface IdentityCandidate {
  playerName: string;
  observedAtMs: number;
  source: 'got_character_zdoid';
  characterId?: string;
  platformId?: string;
  playFabId?: string;
}

const recentIdentityCandidates: IdentityCandidate[] = [];

interface PendingJoin {
  event: NormalizedEvent;
  observedAtMs: number;
}

const pendingJoins: PendingJoin[] = [];

const ingestStats = {
  seenLines: 0,
  parsedEvents: 0,
  parseFailures: 0
};

function normalizeJournalPrefixes(message: string): string {
  let normalized = message.trim();

  normalized = normalized.replace(
    /^[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\S+\s+[^:]+:\s*/,
    ''
  );
  normalized = normalized.replace(/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}:\s*/, '');

  return normalized.trim();
}

function isCharacterId(value: string): boolean {
  return /^\d+:\d+$/.test(value.trim());
}

function isPlatformId(value: string): boolean {
  return /^(steam|xbox|psn|eos)[_:-]/i.test(value.trim());
}

function pushIdentityCandidate(candidate: IdentityCandidate): void {
  recentIdentityCandidates.push(candidate);

  if (recentIdentityCandidates.length > IDENTITY_BUFFER_MAX) {
    recentIdentityCandidates.splice(0, recentIdentityCandidates.length - IDENTITY_BUFFER_MAX);
  }
}

function extractIdentityCandidate(line: string): IdentityCandidate | null {
  const normalized = normalizeJournalPrefixes(line);
  const zdoidMatch = /got character zdoid from\s+([^:]+)\s*:\s*([0-9:]+)/i.exec(normalized);

  if (!zdoidMatch) {
    return null;
  }

  const playerName = zdoidMatch[1]?.trim();

  if (!playerName) {
    return null;
  }

  const characterId = zdoidMatch[2]?.trim();
  const playFabIdMatch = /playfab(?:\s*id)?\s*[:=]\s*([a-z0-9_-]+)/i.exec(normalized);
  const playFabId = playFabIdMatch?.[1]?.trim();
  const platformIdMatch = /\b((?:steam|xbox|psn|eos)[_:-][a-z0-9:_-]+)\b/i.exec(normalized);
  const inferredPlatformId = platformIdMatch?.[1]?.trim();

  return {
    playerName,
    observedAtMs: Date.now(),
    source: 'got_character_zdoid',
    ...(characterId && isCharacterId(characterId) ? { characterId } : {}),
    ...(inferredPlatformId && isPlatformId(inferredPlatformId) ? { platformId: inferredPlatformId } : {}),
    ...(playFabId ? { playFabId } : {})
  };
}

function correlateJoinIdentity(event: NormalizedEvent): NormalizedEvent {
  if (event.eventType !== 'PLAYER_JOIN' || event.playerName) {
    return event;
  }

  const nowMs = Date.now();

  for (let index = recentIdentityCandidates.length - 1; index >= 0; index -= 1) {
    const candidate = recentIdentityCandidates[index];

    if (!candidate) {
      continue;
    }

    const ageMs = nowMs - candidate.observedAtMs;

    if (ageMs < 0 || ageMs > IDENTITY_CORRELATION_WINDOW_MS) {
      continue;
    }

    recentIdentityCandidates.splice(index, 1);

    return {
      ...event,
      playerName: candidate.playerName,
      raw: {
        ...(event.raw ?? {}),
        valheimResolvedPlayerName: candidate.playerName,
        valheimIdentityConfidence: 'low',
        valheimIdentitySource: candidate.source,
        valheimIdentityCharacterId: candidate.characterId,
        valheimIdentityPlatformId: candidate.platformId,
        valheimIdentityPlayFabId: candidate.playFabId
      }
    };
  }

  return event;
}

function enqueuePendingJoin(event: NormalizedEvent): void {
  pendingJoins.push({
    event,
    observedAtMs: Date.now()
  });

  if (pendingJoins.length > PENDING_JOIN_BUFFER_MAX) {
    const dropped = pendingJoins.shift();

    if (dropped) {
      console.log(
        `[debug][pending-join-expired] server=${dropped.event.serverId} reason=buffer-overflow`
      );
    }
  }

  console.log(`[debug][pending-join] server=${event.serverId} queued_at=${new Date().toISOString()}`);
}

function expirePendingJoins(nowMs: number): NormalizedEvent[] {
  const expired: NormalizedEvent[] = [];

  while (pendingJoins.length > 0) {
    const oldest = pendingJoins[0];

    if (!oldest || nowMs - oldest.observedAtMs <= PENDING_JOIN_TTL_MS) {
      break;
    }

    pendingJoins.shift();
    expired.push(oldest.event);
    console.log(
      `[debug][pending-join-expired] server=${oldest.event.serverId} age_ms=${nowMs - oldest.observedAtMs}`
    );
  }

  return expired;
}

function resolvePendingJoinWithIdentity(candidate: IdentityCandidate): NormalizedEvent | null {
  for (let index = pendingJoins.length - 1; index >= 0; index -= 1) {
    const pending = pendingJoins[index];

    if (!pending) {
      continue;
    }

    const ageMs = candidate.observedAtMs - pending.observedAtMs;

    if (ageMs < 0 || ageMs > PENDING_JOIN_TTL_MS) {
      continue;
    }

    pendingJoins.splice(index, 1);

    const resolvedEvent: NormalizedEvent = {
      ...pending.event,
      playerName: candidate.playerName,
      raw: {
        ...(pending.event.raw ?? {}),
        valheimResolvedPlayerName: candidate.playerName,
        valheimIdentityConfidence: 'low',
        valheimIdentitySource: candidate.source,
        valheimIdentityCharacterId: candidate.characterId,
        valheimIdentityPlatformId: candidate.platformId,
        valheimIdentityPlayFabId: candidate.playFabId
      }
    };

    console.log(
      `[debug][pending-join-resolved] server=${resolvedEvent.serverId} player=${candidate.playerName} age_ms=${ageMs}`
    );

    return resolvedEvent;
  }

  return null;
}

function enrichJoinFromKnownPlayers(event: NormalizedEvent): NormalizedEvent {
  if (event.eventType !== 'PLAYER_JOIN' || event.playerName) {
    return event;
  }

  const rawResolvedName = event.raw?.valheimResolvedPlayerName;

  if (typeof rawResolvedName !== 'string' || !rawResolvedName.trim()) {
    return event;
  }

  const knownPlayer = findKnownPlayer(event.serverId, rawResolvedName);

  if (!knownPlayer || knownPlayer.confidence === 'low' || knownPlayer.observationCount < 2) {
    return event;
  }

  return {
    ...event,
    playerName: knownPlayer.displayName,
    raw: {
      ...(event.raw ?? {}),
      valheimResolvedPlayerName: knownPlayer.displayName,
      valheimIdentityConfidence: knownPlayer.confidence,
      valheimIdentitySource: 'known_player_memory'
    }
  };
}

function recordKnownPlayerObservation(event: NormalizedEvent): void {
  if (event.game !== 'valheim') {
    return;
  }

  if (event.eventType !== 'PLAYER_JOIN' || !event.playerName) {
    return;
  }

  const sourceValue = event.raw?.valheimIdentitySource;
  const confidenceValue = event.raw?.valheimIdentityConfidence;
  const characterIdValue = event.raw?.valheimIdentityCharacterId;
  const platformIdValue = event.raw?.valheimIdentityPlatformId;
  const playFabIdValue = event.raw?.valheimIdentityPlayFabId;

  const source = typeof sourceValue === 'string' && sourceValue.trim() ? sourceValue : 'direct_join_line';
  const confidence: IdentityConfidence = confidenceValue === 'high' || confidenceValue === 'medium' || confidenceValue === 'low'
    ? confidenceValue
    : 'low';
  const characterId = typeof characterIdValue === 'string' && characterIdValue.trim() && isCharacterId(characterIdValue)
    ? characterIdValue.trim()
    : undefined;
  const platformId = typeof platformIdValue === 'string' && platformIdValue.trim() ? platformIdValue.trim() : undefined;
  const playFabId = typeof playFabIdValue === 'string' && playFabIdValue.trim() ? playFabIdValue.trim() : undefined;
  const safePlatformId = platformId && !isCharacterId(platformId) ? platformId : undefined;

  const observation = {
    serverId: event.serverId,
    displayName: event.playerName,
    observedAt: event.occurredAt,
    source,
    confidence,
    ...(characterId ? { characterId } : {}),
    ...(safePlatformId ? { platformId: safePlatformId } : {}),
    ...(playFabId ? { playFabId } : {})
  };

  upsertKnownPlayerObservation(observation);
}

function logIngestStats(reason: string): void {
  console.log(
    `[connector] ${reason} lines=${ingestStats.seenLines} parsed=${ingestStats.parsedEvents} parse_failures=${ingestStats.parseFailures}`
  );
}

async function ingestEvents(events: NormalizedEvent[]): Promise<void> {
  if (events.length === 0) {
    return;
  }

  for (const event of events) {
    recordKnownPlayerObservation(event);
  }

  const payload = ingestEventsRequestSchema.parse({ events });

  const response = await fetch(`${apiBaseUrl}/events/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ingest failed (${response.status}): ${body}`);
  }

  ingestStats.parsedEvents += events.length;
  console.log(`Ingested ${events.length} ${game} event(s) for server ${serverId}`);
}

function parseLineSafe(line: string): NormalizedEvent[] {
  const trimmed = line.trim();
  const nowMs = Date.now();
  const readyEvents = expirePendingJoins(nowMs);

  if (!trimmed) {
    return readyEvents;
  }

  ingestStats.seenLines += 1;
  const identityCandidate = extractIdentityCandidate(trimmed);

  if (identityCandidate) {
    pushIdentityCandidate(identityCandidate);
    const resolvedPendingJoin = resolvePendingJoinWithIdentity(identityCandidate);

    if (resolvedPendingJoin) {
      readyEvents.push(resolvedPendingJoin);
    }
  }

  const isJoinOrLeaveDebugLine =
    trimmed.includes('Player joined server') ||
    trimmed.includes('Player connection lost server') ||
    trimmed.includes('ZPlayFabSocket::Dispose') ||
    trimmed.includes('Keep socket for playfab/');

  if (isJoinOrLeaveDebugLine) {
    console.log(`[debug][journal-line] ${trimmed}`);
  }

  try {
    const parsedEvent = adapter.parseLine(trimmed, { serverId });
    const correlatedEvent = parsedEvent ? correlateJoinIdentity(parsedEvent) : null;
    const enrichedEvent = correlatedEvent ? enrichJoinFromKnownPlayers(correlatedEvent) : null;

    if (isJoinOrLeaveDebugLine) {
      if (enrichedEvent) {
        console.log(`[debug][journal-match] eventType=${enrichedEvent.eventType} player=${enrichedEvent.playerName ?? 'unknown'}`);
      } else {
        console.log('[debug][journal-parse-miss] join/leave line was ignored by parser');
      }
    }

    if (!enrichedEvent) {
      return readyEvents;
    }

    if (enrichedEvent.eventType === 'PLAYER_JOIN' && !enrichedEvent.playerName) {
      enqueuePendingJoin(enrichedEvent);
      return readyEvents;
    }

    readyEvents.push(enrichedEvent);
    return readyEvents;
  } catch (error) {
    ingestStats.parseFailures += 1;
    console.warn(`Parse failure for line: ${trimmed.slice(0, 220)}`, error);
    return readyEvents;
  }
}

async function runFileMode(): Promise<void> {
  const requiredLogFile = logFile ?? getRequiredEnv(game === 'palworld' ? 'PALWORLD_LOG_FILE' : 'VALHEIM_LOG_FILE');

  console.log(`Starting ${game} connector for ${serverId} in file mode`);
  console.log(`Watching log file: ${requiredLogFile}`);

  async function pollLogsAndIngest(): Promise<void> {
    const content = await readFile(requiredLogFile, 'utf8');
    const allLines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (processedLineCount > allLines.length) {
      processedLineCount = 0;
    }

    const newLines = allLines.slice(processedLineCount);
    processedLineCount = allLines.length;

    if (newLines.length === 0) {
      return;
    }

    const events = newLines.flatMap((line) => parseLineSafe(line));

    await ingestEvents(events);
    logIngestStats('file poll');
  }

  setInterval(() => {
    void pollLogsAndIngest().catch((error) => {
      console.error('Connector file poll failed', error);
    });
  }, pollIntervalMs);

  void pollLogsAndIngest().catch((error) => {
    console.error('Connector file startup poll failed', error);
  });
}

async function runJournalMode(): Promise<void> {
  console.log(`Starting ${game} connector for ${serverId} in journal mode`);

  await startValheimJournalStream({
    ...(journalServiceName ? { serviceName: journalServiceName } : {}),
    onLine: async (line) => {
      const events = parseLineSafe(line);

      if (events.length === 0) {
        return;
      }

      await ingestEvents(events);
      logIngestStats('journal stream');
    }
  });
}

async function runPalworldRestMode(): Promise<void> {
  if (game !== 'palworld') {
    throw new Error(`Mode "rest" is only supported for palworld. Selected game=${game}`);
  }

  if (!restHost || !restPort || !restUsername || !restPassword) {
    throw new Error('Palworld REST mode requires restHost, restPort, restUsername, and restPassword.');
  }

  const requiredRestHost = restHost;
  const requiredRestPort = restPort;
  const requiredRestUsername = restUsername;
  const requiredRestPassword = restPassword;

  console.log(`Starting ${game} connector for ${serverId} in rest mode`);
  console.log(`Polling Palworld REST API at http://${requiredRestHost}:${requiredRestPort}${restPath ?? '/v1/api'}/players`);

  let previousSnapshot = new Map<string, PalworldPlayerIdentity>();
  let hasCompletedFirstSuccessfulPoll = false;
  let consecutiveFailureCount = 0;
  let lastHealthWarnAtMs = 0;
  let pollInFlight = false;

  const HEALTH_WARN_FAILURE_THRESHOLD = 3;
  const HEALTH_WARN_COOLDOWN_MS = 5 * 60 * 1000;

  async function pollPlayersAndIngest(): Promise<void> {
    if (pollInFlight) {
      console.log(`[palworld-rest] poll skipped server=${serverId} reason=in-flight`);
      return;
    }

    pollInFlight = true;

    try {
      const restConfig = {
        host: requiredRestHost,
        port: requiredRestPort,
        username: requiredRestUsername,
        password: requiredRestPassword,
        ...(restPath ? { path: restPath } : {})
      };
      const [players, metrics, settings] = await Promise.all([
        fetchPlayers(restConfig),
        fetchMetrics(restConfig),
        fetchSettings(restConfig)
      ]);
      const currentSnapshot = buildPlayerSnapshot(players);
      const occurredAt = new Date().toISOString();
      const events: NormalizedEvent[] = [];
      const previousLookupKeys = new Set(previousSnapshot.keys());
      const currentLookupKeys = new Set(currentSnapshot.keys());

      persistPalworldTelemetry({
        serverId,
        observedAt: occurredAt,
        players,
        previousPlayerLookupKeys: previousLookupKeys,
        currentPlayerLookupKeys: currentLookupKeys,
        metrics,
        settings
      });

      if (!hasCompletedFirstSuccessfulPoll) {
        hasCompletedFirstSuccessfulPoll = true;
        events.push(buildServerOnlineEvent(serverId, occurredAt, currentSnapshot.size));
      }

      events.push(...diffPlayerSnapshots(previousSnapshot, currentSnapshot, serverId, occurredAt));
      previousSnapshot = currentSnapshot;

      if (consecutiveFailureCount > 0) {
        console.log(`[palworld-rest] poll recovered server=${serverId} failures=${consecutiveFailureCount}`);
      }

      consecutiveFailureCount = 0;

      if (events.length > 0) {
        await ingestEvents(events);
      }
    } catch (error) {
      consecutiveFailureCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[palworld-rest] poll failed server=${serverId} count=${consecutiveFailureCount} reason=${message}`);

      const nowMs = Date.now();
      const shouldEmitHealthWarn = consecutiveFailureCount >= HEALTH_WARN_FAILURE_THRESHOLD
        && (nowMs - lastHealthWarnAtMs) >= HEALTH_WARN_COOLDOWN_MS;

      if (!shouldEmitHealthWarn) {
        return;
      }

      lastHealthWarnAtMs = nowMs;
      await ingestEvents([
        buildHealthWarnEvent(
          serverId,
          new Date(nowMs).toISOString(),
          consecutiveFailureCount,
          `Palworld REST /players poll failing (${consecutiveFailureCount} consecutive errors): ${message}`
        )
      ]);
    } finally {
      pollInFlight = false;
    }
  }

  setInterval(() => {
    void pollPlayersAndIngest();
  }, pollIntervalMs);

  await pollPlayersAndIngest();
}

if (mode === 'file') {
  await runFileMode();
} else if (mode === 'journal') {
  if (game !== 'valheim') {
    throw new Error(`Mode "journal" is only supported for valheim. Selected game=${game}`);
  }

  await runJournalMode();
} else if (mode === 'rest') {
  await runPalworldRestMode();
} else {
  throw new Error(
    `Connector mode "${mode}" for game "${game}" is not implemented yet.`
  );
}
