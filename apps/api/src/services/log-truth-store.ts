import { createHash } from 'node:crypto';
import { accessSync, constants, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  identityConfidenceSchema,
  normalizedEventSchema,
  logTruthHealthSchema,
  type LogTruthHealth,
  type IdentityConfidence,
  type NormalizedEvent
} from '@gameops/shared';
import { z } from 'zod';
import { resolveRuntimeDataPath } from './runtime-paths.js';

const MAX_STORED_LOG_TRUTH_EVENTS = 10_000;
const STORE_CACHE_TTL_MS = 5_000;

const logTruthEntrySchema = z.object({
  id: z.string().min(1),
  serverId: z.string().min(1),
  game: normalizedEventSchema.shape.game,
  eventType: normalizedEventSchema.shape.eventType,
  occurredAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
  source: z.string().min(1).optional(),
  confidence: identityConfidenceSchema.optional(),
  event: normalizedEventSchema
});

const logTruthStoreSchema = z.object({
  entries: z.array(logTruthEntrySchema).default([])
});

export type LogTruthEntry = z.infer<typeof logTruthEntrySchema>;
type LogTruthStore = z.infer<typeof logTruthStoreSchema>;

let storeCache: { path: string; expiresAt: number; store: LogTruthStore } | null = null;
let lastSuccessfulAppend: { path: string; at: string } | null = null;
let lastWriteError: { path: string; message: string } | null = null;

function resolveStorePath(): string {
  return resolveRuntimeDataPath('LOG_TRUTH_STORE_PATH', 'log-truth.json');
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function getRawString(event: NormalizedEvent, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = event.raw?.[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getEventSource(event: NormalizedEvent): string | undefined {
  return getRawString(event, [
    'source',
    'eventSource',
    'valheimEventSource',
    'palworldEventSource'
  ]);
}

function getEventConfidence(event: NormalizedEvent): IdentityConfidence | undefined {
  const candidates = [
    event.raw?.confidence,
    event.raw?.identityConfidence,
    event.raw?.valheimIdentityConfidence,
    event.raw?.palworldIdentityConfidence
  ];

  for (const candidate of candidates) {
    const parsed = identityConfidenceSchema.safeParse(candidate);

    if (parsed.success) {
      return parsed.data;
    }
  }

  return undefined;
}

function getEventPlayerIdentifier(event: NormalizedEvent): string {
  return event.platformId
    ?? getRawString(event, ['playerId', 'player_id', 'playerUid', 'userId', 'lookupKey'])
    ?? event.playerName
    ?? '';
}

export function getLogTruthDedupeKey(event: NormalizedEvent): string {
  const eventId = event.id?.trim();

  if (eventId) {
    return `event-id:${eventId}`;
  }

  const rawMessage = getRawString(event, ['message', 'rawMessage', 'logMessage', 'line']);
  return `fingerprint:${hashValue([
    event.serverId,
    event.eventType,
    getEventPlayerIdentifier(event),
    event.occurredAt,
    event.message ?? '',
    rawMessage ?? ''
  ].join('|'))}`;
}

function loadStore(): LogTruthStore {
  const path = resolveStorePath();
  const now = Date.now();

  if (storeCache && storeCache.path === path && storeCache.expiresAt > now) {
    return storeCache.store;
  }

  if (!existsSync(path)) {
    const store = logTruthStoreSchema.parse({});
    storeCache = { path, expiresAt: now + STORE_CACHE_TTL_MS, store };
    return store;
  }

  try {
    const store = logTruthStoreSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
    storeCache = { path, expiresAt: now + STORE_CACHE_TTL_MS, store };
    return store;
  } catch {
    const store = logTruthStoreSchema.parse({});
    storeCache = { path, expiresAt: now + STORE_CACHE_TTL_MS, store };
    return store;
  }
}

function writeStore(store: LogTruthStore): void {
  const path = resolveStorePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  storeCache = { path, expiresAt: Date.now() + STORE_CACHE_TTL_MS, store };
}

function readStoreFromDisk(path: string): LogTruthStore | null {
  if (!existsSync(path)) {
    return logTruthStoreSchema.parse({});
  }

  if (!statSync(path).isFile()) {
    return null;
  }

  return logTruthStoreSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
}

function isStorePathReadable(path: string): boolean {
  try {
    const store = readStoreFromDisk(path);
    return store !== null;
  } catch {
    return false;
  }
}

function isStorePathWritable(path: string): boolean {
  try {
    mkdirSync(dirname(path), { recursive: true });

    if (existsSync(path) && !statSync(path).isFile()) {
      return false;
    }

    accessSync(dirname(path), constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function toLogTruthEntry(event: NormalizedEvent, receivedAt: string): LogTruthEntry {
  const dedupeKey = getLogTruthDedupeKey(event);
  const source = getEventSource(event);
  const confidence = getEventConfidence(event);

  return logTruthEntrySchema.parse({
    id: `log:${hashValue(dedupeKey)}`,
    serverId: event.serverId,
    game: event.game,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    receivedAt,
    ...(source ? { source } : {}),
    ...(confidence ? { confidence } : {}),
    event
  });
}

export function appendLogTruthEvents(events: NormalizedEvent[], receivedAt = new Date().toISOString()): LogTruthEntry[] {
  if (events.length === 0) {
    return [];
  }

  const path = resolveStorePath();
  const store = loadStore();
  const existingIds = new Set(store.entries.map((entry) => entry.id));
  const appended: LogTruthEntry[] = [];

  for (const event of events) {
    const parsedEvent = normalizedEventSchema.parse(event);
    const entry = toLogTruthEntry(parsedEvent, receivedAt);

    if (existingIds.has(entry.id)) {
      continue;
    }

    store.entries.push(entry);
    existingIds.add(entry.id);
    appended.push(entry);
  }

  if (appended.length === 0) {
    return [];
  }

  store.entries = store.entries
    .sort((left, right) => (
      left.occurredAt.localeCompare(right.occurredAt)
      || left.receivedAt.localeCompare(right.receivedAt)
      || left.id.localeCompare(right.id)
    ))
    .slice(-MAX_STORED_LOG_TRUTH_EVENTS);

  try {
    writeStore(store);
    lastSuccessfulAppend = { path, at: receivedAt };
    lastWriteError = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    lastWriteError = { path, message };
    console.log(`[log-truth] persist-failed error=${message}`);
    return [];
  }

  return appended;
}

export function getRecentLogTruthEventsForServer(serverId: string, limit = 10): NormalizedEvent[] {
  return loadStore().entries
    .filter((entry) => entry.serverId === serverId)
    .sort((left, right) => (
      right.occurredAt.localeCompare(left.occurredAt)
      || right.receivedAt.localeCompare(left.receivedAt)
      || right.id.localeCompare(left.id)
    ))
    .slice(0, Math.max(1, limit))
    .map((entry) => entry.event);
}

export function getRecentLogTruthEntriesForServer(serverId: string, limit = 10): LogTruthEntry[] {
  return loadStore().entries
    .filter((entry) => entry.serverId === serverId)
    .sort((left, right) => (
      right.occurredAt.localeCompare(left.occurredAt)
      || right.receivedAt.localeCompare(left.receivedAt)
      || right.id.localeCompare(left.id)
    ))
    .slice(0, Math.max(1, limit));
}

export function resetLogTruthStoreForTests(): void {
  lastSuccessfulAppend = null;
  lastWriteError = null;
  writeStore(logTruthStoreSchema.parse({}));
}

export function getLogTruthHealth(): LogTruthHealth {
  const path = resolveStorePath();
  const readable = isStorePathReadable(path);
  const writable = isStorePathWritable(path);
  let diskStore: LogTruthStore | null = null;
  let readError: string | null = null;

  try {
    diskStore = readStoreFromDisk(path);
  } catch (error) {
    readError = error instanceof Error ? error.message : 'unknown_error';
  }

  const diskEntries = diskStore?.entries ?? [];
  const latestReceivedAt = diskEntries
    .map((entry) => entry.receivedAt)
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
  const effectiveLastError = lastWriteError?.path === path ? lastWriteError.message : readError;
  const effectiveLastSuccessfulAppendAt = lastSuccessfulAppend?.path === path
    ? lastSuccessfulAppend.at
    : latestReceivedAt;

  return logTruthHealthSchema.parse({
    status: readable && writable && !effectiveLastError ? 'healthy' : 'unhealthy',
    path,
    readable,
    writable,
    lastSuccessfulAppendAt: effectiveLastSuccessfulAppendAt,
    lastError: effectiveLastError,
    totalEventCount: diskEntries.length
  });
}
