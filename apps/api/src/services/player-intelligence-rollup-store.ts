import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import {
  gameKeySchema,
  playerIntelligenceConfidenceSchema,
  playerDetailSessionSchema,
  type GameKey,
  type PlayerDetailSession,
  type PlayerIntelligenceConfidence,
  type SessionRecord
} from '@gameops/shared';
import { z } from 'zod';
import { recordClosedSessionEngagementRollup } from './player-engagement-rollup-store.js';
import { clearCachedResult } from './request-performance.js';

const MAX_PROCESSED_SESSION_IDS = 20_000;
const MAX_RECENT_SESSIONS_PER_PLAYER = 25;
const STORE_CACHE_TTL_MS = 5_000;

const playerRollupRecordSchema = z.object({
  playerId: z.string().min(1),
  serverId: z.string().min(1),
  displayName: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  game: gameKeySchema,
  firstSeenAt: z.string().datetime().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
  totalTrackedSeconds: z.number().int().min(0).default(0),
  sessionCount: z.number().int().min(0).default(0),
  averageSessionSeconds: z.number().int().min(0).default(0),
  identityConfidence: playerIntelligenceConfidenceSchema.default('unknown'),
  identityExplanation: z.string().min(1).default('Stored from previous GameOps observations.'),
  sourceSummary: z.array(z.string()).default([]),
  lastUpdatedAt: z.string().datetime(),
  gameFields: z.record(z.string(), z.unknown()).default({}),
  recentSessions: z.array(playerDetailSessionSchema).default([])
});

const playerIntelligenceStoreSchema = z.object({
  players: z.array(playerRollupRecordSchema).default([]),
  processedSessionIds: z.array(z.string()).default([])
});

export type PersistedPlayerRollup = z.infer<typeof playerRollupRecordSchema>;
type PlayerIntelligenceStore = z.infer<typeof playerIntelligenceStoreSchema>;

let storeCache: { path: string; expiresAt: number; store: PlayerIntelligenceStore } | null = null;

function resolveStorePath(): string {
  const rawPath = process.env.PLAYER_INTELLIGENCE_STORE_PATH ?? '../player-intelligence-state.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function slug(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown-player';
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function pickConfidence(
  current: PlayerIntelligenceConfidence,
  candidate: PlayerIntelligenceConfidence
): PlayerIntelligenceConfidence {
  const rank: Record<PlayerIntelligenceConfidence, number> = {
    unknown: 0,
    low: 1,
    medium: 2,
    high: 3
  };

  return rank[candidate] > rank[current] ? candidate : current;
}

function minTimestamp(current: string | null, candidate: string): string {
  return current && current.localeCompare(candidate) < 0 ? current : candidate;
}

function maxTimestamp(current: string | null, candidate: string): string {
  return current && current.localeCompare(candidate) > 0 ? current : candidate;
}

function getDurationSeconds(session: SessionRecord): number {
  if (typeof session.durationSeconds === 'number' && Number.isFinite(session.durationSeconds)) {
    return Math.max(0, Math.floor(session.durationSeconds));
  }

  if (!session.endedAt) {
    return 0;
  }

  const startedAtMs = Date.parse(session.startedAt);
  const endedAtMs = Date.parse(session.endedAt);

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs) || endedAtMs <= startedAtMs) {
    return 0;
  }

  return Math.floor((endedAtMs - startedAtMs) / 1000);
}

function toDetailSession(session: SessionRecord): PlayerDetailSession {
  const sessionId = getClosedSessionRollupId(session);
  const durationSeconds = getDurationSeconds(session);
  const inferred = session.closeReason === 'occupancy_reconciliation';

  return playerDetailSessionSchema.parse({
    sessionId,
    startedAt: session.startedAt,
    endedAt: session.endedAt ?? null,
    durationSeconds,
    closeReason: session.closeReason ?? null,
    startConfidence: session.startConfidence ?? null,
    endConfidence: session.endConfidence ?? null,
    observedName: session.playerName,
    explanation: inferred
      ? 'Session was closed from player-count reconciliation, so the exact leave time is inferred.'
      : session.endedAt
        ? 'Session ended from observed connector activity.'
        : 'Session is currently active.'
  });
}

export function getClosedSessionRollupId(session: SessionRecord): string {
  return [
    session.serverId,
    normalize(session.playerName),
    session.startedAt,
    session.endedAt ?? '',
    String(getDurationSeconds(session))
  ].join('::');
}

function getPlayerId(serverId: string, playerName: string): string {
  return `${serverId}:${slug(playerName)}`;
}

function loadStore(): PlayerIntelligenceStore {
  const path = resolveStorePath();
  const now = Date.now();

  if (storeCache && storeCache.path === path && storeCache.expiresAt > now) {
    return storeCache.store;
  }

  try {
    const store = playerIntelligenceStoreSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
    storeCache = { path, expiresAt: now + STORE_CACHE_TTL_MS, store };
    return store;
  } catch {
    const store = playerIntelligenceStoreSchema.parse({});
    storeCache = { path, expiresAt: now + STORE_CACHE_TTL_MS, store };
    return store;
  }
}

function writeStore(store: PlayerIntelligenceStore): void {
  const path = resolveStorePath();

  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    storeCache = { path, expiresAt: Date.now() + STORE_CACHE_TTL_MS, store };
    clearCachedResult('player-intelligence:');
    clearCachedResult('session-timeline:');
    clearCachedResult('player-engagement:');
    clearCachedResult('data-freshness:');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    console.log(`[player-intelligence] persist-failed path=${path} error=${message}`);
  }
}

function findOrCreateRollup(
  store: z.infer<typeof playerIntelligenceStoreSchema>,
  input: {
    serverId: string;
    game: GameKey;
    playerName: string;
    observedAt: string;
  }
): PersistedPlayerRollup {
  const normalizedName = normalize(input.playerName);
  const existing = store.players.find((player) => (
    player.serverId === input.serverId
    && (
      normalize(player.displayName) === normalizedName
      || player.aliases.some((alias) => normalize(alias) === normalizedName)
    )
  ));

  if (existing) {
    return existing;
  }

  const created = playerRollupRecordSchema.parse({
    playerId: getPlayerId(input.serverId, input.playerName),
    serverId: input.serverId,
    displayName: input.playerName,
    aliases: [input.playerName],
    game: input.game,
    firstSeenAt: input.observedAt,
    lastSeenAt: input.observedAt,
    totalTrackedSeconds: 0,
    sessionCount: 0,
    averageSessionSeconds: 0,
    identityConfidence: 'unknown',
    identityExplanation: 'Stored from previous GameOps observations.',
    sourceSummary: ['stored rollup'],
    lastUpdatedAt: input.observedAt,
    gameFields: {},
    recentSessions: []
  });

  store.players.push(created);
  return created;
}

function updateAverageSessionSeconds(player: PersistedPlayerRollup): void {
  player.averageSessionSeconds = player.sessionCount > 0
    ? Math.floor(player.totalTrackedSeconds / player.sessionCount)
    : 0;
}

export function recordPlayerSeenFromSessionStart(input: {
  serverId: string;
  game: GameKey;
  playerName: string;
  observedAt: string;
  confidence?: Exclude<PlayerIntelligenceConfidence, 'unknown'> | undefined;
}): void {
  const store = loadStore();
  const player = findOrCreateRollup(store, input);

  player.displayName = input.playerName;
  player.aliases = dedupe([...player.aliases, input.playerName]);
  player.firstSeenAt = minTimestamp(player.firstSeenAt, input.observedAt);
  player.lastSeenAt = maxTimestamp(player.lastSeenAt, input.observedAt);
  player.identityConfidence = pickConfidence(player.identityConfidence, input.confidence ?? 'unknown');
  player.identityExplanation = input.confidence
    ? 'Stored from observed connector session activity.'
    : player.identityExplanation;
  player.sourceSummary = dedupe([...player.sourceSummary, 'stored rollup', 'session start']);
  player.lastUpdatedAt = input.observedAt;

  writeStore(store);
}

export function recordClosedSessionRollup(input: {
  game: GameKey;
  session: SessionRecord;
  confidence?: Exclude<PlayerIntelligenceConfidence, 'unknown'>;
}): boolean {
  if (!input.session.endedAt) {
    return false;
  }

  const sessionId = getClosedSessionRollupId(input.session);
  const store = loadStore();

  if (store.processedSessionIds.includes(sessionId)) {
    return false;
  }

  const durationSeconds = getDurationSeconds(input.session);
  const player = findOrCreateRollup(store, {
    serverId: input.session.serverId,
    game: input.game,
    playerName: input.session.playerName,
    observedAt: input.session.startedAt
  });

  player.aliases = dedupe([...player.aliases, input.session.playerName]);
  player.firstSeenAt = minTimestamp(player.firstSeenAt, input.session.startedAt);
  player.lastSeenAt = maxTimestamp(player.lastSeenAt, input.session.endedAt);
  player.totalTrackedSeconds += durationSeconds;
  player.sessionCount += 1;
  updateAverageSessionSeconds(player);
  player.identityConfidence = pickConfidence(player.identityConfidence, input.confidence ?? input.session.endConfidence ?? input.session.startConfidence ?? 'unknown');
  player.identityExplanation = 'Stored from closed connector sessions. Tracked playtime is based only on sessions GameOps observed.';
  player.sourceSummary = dedupe([...player.sourceSummary, 'stored rollup', 'closed sessions']);
  player.lastUpdatedAt = input.session.endedAt;
  player.recentSessions = [
    toDetailSession(input.session),
    ...player.recentSessions.filter((session) => session.sessionId !== sessionId)
  ]
    .sort((left, right) => (right.endedAt ?? right.startedAt).localeCompare(left.endedAt ?? left.startedAt))
    .slice(0, MAX_RECENT_SESSIONS_PER_PLAYER);

  store.processedSessionIds.push(sessionId);
  if (store.processedSessionIds.length > MAX_PROCESSED_SESSION_IDS) {
    store.processedSessionIds.splice(0, store.processedSessionIds.length - MAX_PROCESSED_SESSION_IDS);
  }

  recordClosedSessionEngagementRollup(input.session);
  writeStore(store);
  return true;
}

export function getPersistedPlayerRollupsForServer(serverId: string): PersistedPlayerRollup[] {
  return loadStore().players
    .filter((player) => player.serverId === serverId)
    .sort((left, right) => (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? ''));
}

export function hasProcessedClosedSessionRollup(session: SessionRecord): boolean {
  return loadStore().processedSessionIds.includes(getClosedSessionRollupId(session));
}

export function resetPlayerIntelligenceRollupStoreForTests(): void {
  writeStore(playerIntelligenceStoreSchema.parse({}));
}
