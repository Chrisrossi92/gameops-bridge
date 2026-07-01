import { existsSync, readFileSync, statSync } from 'node:fs';
import {
  knownPlayerRecordSchema,
  normalizedEventSchema,
  playerIntelligenceRecordSchema,
  sessionRecordSchema,
  type KnownPlayerRecord,
  type NormalizedEvent,
  type PlayerIntelligenceRecord,
  type SessionRecord
} from '@gameops/shared';
import { z } from 'zod';
import { resolveRuntimeDataPath } from './runtime-paths.js';

export type PlayerActivityImportPreviewConfidence = 'low' | 'medium' | 'high';

export interface PlayerActivityImportPreviewSource {
  store: string;
  path: string;
  evidenceCount: number;
}

export interface PlayerActivityImportCandidate {
  serverId: string;
  playerKey: string;
  displayName: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  sessionLikeEvidenceCount: number;
  confidence: PlayerActivityImportPreviewConfidence;
  sourceStores: PlayerActivityImportPreviewSource[];
  wouldCreatePlayer: boolean;
  wouldUpdatePlayer: boolean;
}

export interface PlayerActivityImportPreviewStoreStatus {
  store: string;
  path: string;
  exists: boolean;
  readable: boolean;
  recordsScanned: number;
  error?: string;
}

export interface PlayerActivityImportPreviewResult {
  generatedAt: string;
  scannedStores: PlayerActivityImportPreviewStoreStatus[];
  candidatePlayers: PlayerActivityImportCandidate[];
  wouldCreatePlayers: number;
  wouldUpdatePlayers: number;
}

interface PreviewOptions {
  env?: NodeJS.ProcessEnv;
  now?: Date;
  serverId?: string;
}

interface EvidenceInput {
  serverId: string;
  displayName: string;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  sessionLikeEvidenceCount?: number;
  confidence: PlayerActivityImportPreviewConfidence;
  store: string;
  path: string;
  evidenceCount?: number;
  existingPlayer?: boolean;
}

interface CandidateAccumulator {
  serverId: string;
  playerKey: string;
  displayName: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  sessionLikeEvidenceCount: number;
  confidence: PlayerActivityImportPreviewConfidence;
  sourceStores: Map<string, PlayerActivityImportPreviewSource>;
  existingPlayer: boolean;
}

interface StoreDefinition {
  store: string;
  envName: string;
  fileName: string;
  scan: (root: unknown, path: string, add: (input: EvidenceInput) => void) => number;
}

const logTruthStoreSchema = z.object({
  entries: z.array(z.object({
    serverId: z.string().min(1).optional(),
    game: z.string().optional(),
    eventType: z.string().optional(),
    occurredAt: z.string().datetime().optional(),
    confidence: z.enum(['low', 'medium', 'high']).optional(),
    event: normalizedEventSchema.optional()
  }).catchall(z.unknown())).default([])
});

const sessionStateStoreSchema = z.object({
  activeSessionsByServer: z.record(z.string(), z.unknown()).optional(),
  recentClosedSessionsByServer: z.record(z.string(), z.unknown()).optional()
});

const playerIntelligenceStoreSchema = z.object({
  players: z.array(playerIntelligenceRecordSchema).default([])
});

const knownPlayersStoreSchema = z.object({
  players: z.array(knownPlayerRecordSchema).default([]),
  observations: z.array(z.object({
    serverId: z.string().min(1),
    displayName: z.string().min(1),
    observedAt: z.string().datetime(),
    confidence: z.enum(['low', 'medium', 'high']).default('low')
  }).catchall(z.unknown())).default([])
});

const palworldTelemetryStoreSchema = z.object({
  latestPlayerStates: z.array(z.object({
    server_id: z.string().min(1),
    lookup_key: z.string().min(1),
    player_name: z.string().optional(),
    account_name: z.string().optional(),
    player_id: z.string().optional(),
    user_id: z.string().optional(),
    first_seen_at: z.string().datetime(),
    last_seen_at: z.string().datetime(),
    total_sessions: z.number().int().min(0).default(0)
  }).catchall(z.unknown())).default([]),
  playerSnapshotHistory: z.array(z.object({
    server_id: z.string().min(1),
    observed_at: z.string().datetime(),
    lookup_key: z.string().min(1),
    player_name: z.string().optional(),
    account_name: z.string().optional(),
    player_id: z.string().optional(),
    user_id: z.string().optional()
  }).catchall(z.unknown())).default([])
});

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function minTimestamp(left: string | null, right: string | null): string | null {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return left.localeCompare(right) <= 0 ? left : right;
}

function maxTimestamp(left: string | null, right: string | null): string | null {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return left.localeCompare(right) >= 0 ? left : right;
}

function pickConfidence(
  current: PlayerActivityImportPreviewConfidence,
  candidate: PlayerActivityImportPreviewConfidence
): PlayerActivityImportPreviewConfidence {
  const rank: Record<PlayerActivityImportPreviewConfidence, number> = {
    low: 1,
    medium: 2,
    high: 3
  };

  return rank[candidate] > rank[current] ? candidate : current;
}

function readJson(path: string): { root: unknown; status: PlayerActivityImportPreviewStoreStatus } {
  if (!existsSync(path)) {
    return {
      root: null,
      status: {
        store: '',
        path,
        exists: false,
        readable: false,
        recordsScanned: 0
      }
    };
  }

  try {
    if (!statSync(path).isFile()) {
      return {
        root: null,
        status: {
          store: '',
          path,
          exists: true,
          readable: false,
          recordsScanned: 0,
          error: 'Path exists but is not a file.'
        }
      };
    }

    return {
      root: JSON.parse(readFileSync(path, 'utf8')) as unknown,
      status: {
        store: '',
        path,
        exists: true,
        readable: true,
        recordsScanned: 0
      }
    };
  } catch (error) {
    return {
      root: null,
      status: {
        store: '',
        path,
        exists: true,
        readable: false,
        recordsScanned: 0,
        error: error instanceof Error ? error.message : 'Unable to read store.'
      }
    };
  }
}

function displayNameFrom(...values: Array<string | undefined>): string | null {
  return values.map((value) => value?.trim()).find((value): value is string => Boolean(value)) ?? null;
}

function rawString(event: NormalizedEvent, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = event.raw?.[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function isPlayerEvent(event: NormalizedEvent): boolean {
  return event.eventType === 'PLAYER_JOIN' || event.eventType === 'PLAYER_LEAVE';
}

function parseSessions(rawValue: unknown): SessionRecord[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .map((value) => sessionRecordSchema.safeParse(value))
    .filter((result): result is { success: true; data: SessionRecord } => result.success)
    .map((result) => result.data);
}

function addEvidence(
  candidates: Map<string, CandidateAccumulator>,
  options: PreviewOptions,
  input: EvidenceInput
): void {
  if (options.serverId && input.serverId !== options.serverId) {
    return;
  }

  const normalizedName = normalizeKey(input.displayName);

  if (!input.serverId.trim() || !normalizedName) {
    return;
  }

  const key = `${input.serverId}::${normalizedName}`;
  const existing = candidates.get(key);

  if (!existing) {
    candidates.set(key, {
      serverId: input.serverId,
      playerKey: normalizedName,
      displayName: input.displayName,
      firstSeenAt: input.firstSeenAt ?? input.lastSeenAt ?? null,
      lastSeenAt: input.lastSeenAt ?? input.firstSeenAt ?? null,
      sessionLikeEvidenceCount: Math.max(0, input.sessionLikeEvidenceCount ?? 0),
      confidence: input.confidence,
      sourceStores: new Map([[input.store, {
        store: input.store,
        path: input.path,
        evidenceCount: Math.max(1, input.evidenceCount ?? 1)
      }]]),
      existingPlayer: input.existingPlayer ?? false
    });
    return;
  }

  existing.firstSeenAt = minTimestamp(existing.firstSeenAt, input.firstSeenAt ?? input.lastSeenAt ?? null);
  existing.lastSeenAt = maxTimestamp(existing.lastSeenAt, input.lastSeenAt ?? input.firstSeenAt ?? null);
  existing.sessionLikeEvidenceCount += Math.max(0, input.sessionLikeEvidenceCount ?? 0);
  existing.confidence = pickConfidence(existing.confidence, input.confidence);
  existing.existingPlayer = existing.existingPlayer || (input.existingPlayer ?? false);

  const source = existing.sourceStores.get(input.store);
  if (source) {
    source.evidenceCount += Math.max(1, input.evidenceCount ?? 1);
  } else {
    existing.sourceStores.set(input.store, {
      store: input.store,
      path: input.path,
      evidenceCount: Math.max(1, input.evidenceCount ?? 1)
    });
  }
}

function scanLogTruth(root: unknown, path: string, add: (input: EvidenceInput) => void): number {
  const parsed = logTruthStoreSchema.parse(root ?? {});

  for (const entry of parsed.entries) {
    const event = entry.event ?? null;
    const displayName = event
      ? displayNameFrom(
        event.playerName,
        rawString(event, ['playerName', 'player_name', 'accountName', 'account_name', 'lookupKey', 'lookup_key'])
      )
      : null;

    if (!event || !displayName || !isPlayerEvent(event)) {
      continue;
    }

    add({
      serverId: event.serverId,
      displayName,
      firstSeenAt: event.occurredAt,
      lastSeenAt: event.occurredAt,
      sessionLikeEvidenceCount: 1,
      confidence: entry.confidence ?? 'medium',
      store: 'log-truth',
      path
    });
  }

  return parsed.entries.length;
}

function scanSessionState(root: unknown, path: string, add: (input: EvidenceInput) => void): number {
  const parsed = sessionStateStoreSchema.parse(root ?? {});
  let scanned = 0;

  for (const [serverId, rawSessions] of Object.entries(parsed.activeSessionsByServer ?? {})) {
    const sessions = parseSessions(rawSessions);
    scanned += sessions.length;

    for (const session of sessions) {
      add({
        serverId,
        displayName: session.playerName,
        firstSeenAt: session.startedAt,
        lastSeenAt: session.endedAt ?? session.startedAt,
        sessionLikeEvidenceCount: 1,
        confidence: session.startConfidence ?? 'medium',
        store: 'session-state',
        path
      });
    }
  }

  for (const [serverId, rawSessions] of Object.entries(parsed.recentClosedSessionsByServer ?? {})) {
    const sessions = parseSessions(rawSessions);
    scanned += sessions.length;

    for (const session of sessions) {
      add({
        serverId,
        displayName: session.playerName,
        firstSeenAt: session.startedAt,
        lastSeenAt: session.endedAt ?? session.startedAt,
        sessionLikeEvidenceCount: 1,
        confidence: session.endConfidence ?? session.startConfidence ?? 'medium',
        store: 'session-state',
        path
      });
    }
  }

  return scanned;
}

function scanPlayerIntelligence(root: unknown, path: string, add: (input: EvidenceInput) => void): number {
  const parsed = playerIntelligenceStoreSchema.parse(root ?? {});

  for (const player of parsed.players) {
    add({
      serverId: player.serverId,
      displayName: player.displayName,
      firstSeenAt: player.firstSeenAt,
      lastSeenAt: player.lastSeenAt,
      sessionLikeEvidenceCount: player.sessionCount,
      confidence: player.identityConfidence === 'unknown' ? 'low' : player.identityConfidence,
      store: 'player-intelligence',
      path,
      existingPlayer: true
    });
  }

  return parsed.players.length;
}

function scanKnownPlayers(root: unknown, path: string, add: (input: EvidenceInput) => void): number {
  const parsed = knownPlayersStoreSchema.parse(root ?? {});

  for (const player of parsed.players) {
    addKnownPlayer(player, path, add);
  }

  for (const observation of parsed.observations) {
    add({
      serverId: observation.serverId,
      displayName: observation.displayName,
      firstSeenAt: observation.observedAt,
      lastSeenAt: observation.observedAt,
      sessionLikeEvidenceCount: 0,
      confidence: observation.confidence,
      store: 'known-players',
      path,
      existingPlayer: true
    });
  }

  return parsed.players.length + parsed.observations.length;
}

function addKnownPlayer(
  player: KnownPlayerRecord,
  path: string,
  add: (input: EvidenceInput) => void
): void {
  add({
    serverId: player.serverId,
    displayName: player.displayName,
    firstSeenAt: player.firstSeenAt,
    lastSeenAt: player.lastSeenAt,
    sessionLikeEvidenceCount: 0,
    confidence: player.confidence,
    store: 'known-players',
    path,
    evidenceCount: player.observationCount,
    existingPlayer: true
  });
}

function scanPalworldTelemetry(root: unknown, path: string, add: (input: EvidenceInput) => void): number {
  const parsed = palworldTelemetryStoreSchema.parse(root ?? {});

  for (const player of parsed.latestPlayerStates) {
    const displayName = displayNameFrom(player.player_name, player.account_name, player.lookup_key);

    if (!displayName) {
      continue;
    }

    add({
      serverId: player.server_id,
      displayName,
      firstSeenAt: player.first_seen_at,
      lastSeenAt: player.last_seen_at,
      sessionLikeEvidenceCount: player.total_sessions,
      confidence: player.player_id || player.user_id ? 'high' : 'medium',
      store: 'palworld-telemetry',
      path
    });
  }

  for (const snapshot of parsed.playerSnapshotHistory) {
    const displayName = displayNameFrom(snapshot.player_name, snapshot.account_name, snapshot.lookup_key);

    if (!displayName) {
      continue;
    }

    add({
      serverId: snapshot.server_id,
      displayName,
      firstSeenAt: snapshot.observed_at,
      lastSeenAt: snapshot.observed_at,
      sessionLikeEvidenceCount: 1,
      confidence: snapshot.player_id || snapshot.user_id ? 'high' : 'medium',
      store: 'palworld-telemetry',
      path
    });
  }

  return parsed.latestPlayerStates.length + parsed.playerSnapshotHistory.length;
}

const STORES: StoreDefinition[] = [
  {
    store: 'log-truth',
    envName: 'LOG_TRUTH_STORE_PATH',
    fileName: 'log-truth.json',
    scan: scanLogTruth
  },
  {
    store: 'session-state',
    envName: 'SESSION_STATE_STORE_PATH',
    fileName: 'session-state.json',
    scan: scanSessionState
  },
  {
    store: 'player-intelligence',
    envName: 'PLAYER_INTELLIGENCE_STORE_PATH',
    fileName: 'player-intelligence-state.json',
    scan: scanPlayerIntelligence
  },
  {
    store: 'known-players',
    envName: 'KNOWN_PLAYER_STORE_PATH',
    fileName: 'known-players.json',
    scan: scanKnownPlayers
  },
  {
    store: 'palworld-telemetry',
    envName: 'PALWORLD_TELEMETRY_STORE_PATH',
    fileName: 'palworld-telemetry.json',
    scan: scanPalworldTelemetry
  }
];

export function previewPlayerActivityImport(options: PreviewOptions = {}): PlayerActivityImportPreviewResult {
  const env = options.env ?? process.env;
  const candidates = new Map<string, CandidateAccumulator>();
  const scannedStores: PlayerActivityImportPreviewStoreStatus[] = [];

  for (const definition of STORES) {
    const path = resolveRuntimeDataPath(definition.envName, definition.fileName, env);
    const { root, status } = readJson(path);
    status.store = definition.store;

    if (status.readable) {
      try {
        status.recordsScanned = definition.scan(root, path, (input) => addEvidence(candidates, options, input));
      } catch (error) {
        status.readable = false;
        status.recordsScanned = 0;
        status.error = error instanceof Error ? error.message : 'Unable to parse store.';
      }
    }

    scannedStores.push(status);
  }

  const candidatePlayers = Array.from(candidates.values())
    .map((candidate): PlayerActivityImportCandidate => ({
      serverId: candidate.serverId,
      playerKey: candidate.playerKey,
      displayName: candidate.displayName,
      firstSeenAt: candidate.firstSeenAt,
      lastSeenAt: candidate.lastSeenAt,
      sessionLikeEvidenceCount: candidate.sessionLikeEvidenceCount,
      confidence: candidate.confidence,
      sourceStores: Array.from(candidate.sourceStores.values()).sort((left, right) => left.store.localeCompare(right.store)),
      wouldCreatePlayer: !candidate.existingPlayer,
      wouldUpdatePlayer: candidate.existingPlayer
    }))
    .sort((left, right) => (
      right.sessionLikeEvidenceCount - left.sessionLikeEvidenceCount
      || (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? '')
      || left.displayName.localeCompare(right.displayName)
    ));

  return {
    generatedAt: (options.now ?? new Date()).toISOString(),
    scannedStores,
    candidatePlayers,
    wouldCreatePlayers: candidatePlayers.filter((candidate) => candidate.wouldCreatePlayer).length,
    wouldUpdatePlayers: candidatePlayers.filter((candidate) => candidate.wouldUpdatePlayer).length
  };
}
