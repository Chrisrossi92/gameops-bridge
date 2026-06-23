import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import {
  playerIntelligenceConfidenceSchema,
  type PlayerIntelligenceConfidence,
  type SessionRecord
} from '@gameops/shared';
import { z } from 'zod';

const MAX_PROCESSED_SESSION_IDS = 50_000;
const MAX_SOURCE_SESSION_IDS_PER_DAY = 250;

const hourlyEngagementBucketSchema = z.object({
  hourUtc: z.number().int().min(0).max(23),
  sessionStartCount: z.number().int().min(0).default(0),
  trackedSeconds: z.number().int().min(0).default(0),
  activePlayerKeys: z.array(z.string()).default([]),
  lowConfidenceSessionCount: z.number().int().min(0).default(0),
  inferredSessionCount: z.number().int().min(0).default(0)
});

const dailyPlayerEngagementRollupSchema = z.object({
  serverId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  playerId: z.string().min(1),
  playerKey: z.string().min(1),
  displayName: z.string().min(1),
  sessionCount: z.number().int().min(0).default(0),
  trackedSeconds: z.number().int().min(0).default(0),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  lowConfidenceSessionCount: z.number().int().min(0).default(0),
  inferredSessionCount: z.number().int().min(0).default(0),
  sourceSummary: z.array(z.string()).default([]),
  sourceSessionIds: z.array(z.string()).default([]),
  hourlyBuckets: z.array(hourlyEngagementBucketSchema).default([])
});

const playerEngagementRollupStoreSchema = z.object({
  dailyRollups: z.array(dailyPlayerEngagementRollupSchema).default([]),
  processedSessionIds: z.array(z.string()).default([])
});

export type DailyPlayerEngagementRollup = z.infer<typeof dailyPlayerEngagementRollupSchema>;

function resolveStorePath(): string {
  const rawPath = process.env.PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH ?? '../player-engagement-rollups.json';
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

function minTimestamp(current: string, candidate: string): string {
  return current.localeCompare(candidate) < 0 ? current : candidate;
}

function maxTimestamp(current: string, candidate: string): string {
  return current.localeCompare(candidate) > 0 ? current : candidate;
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

function getPlayerId(serverId: string, playerName: string): string {
  return `${serverId}:${slug(playerName)}`;
}

function getUtcDate(value: string): string | null {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export function getClosedSessionEngagementId(session: SessionRecord): string {
  return [
    session.serverId,
    normalize(session.playerName),
    session.startedAt,
    session.endedAt ?? '',
    String(getDurationSeconds(session))
  ].join('::');
}

function loadStore(): z.infer<typeof playerEngagementRollupStoreSchema> {
  const path = resolveStorePath();

  try {
    return playerEngagementRollupStoreSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch {
    return playerEngagementRollupStoreSchema.parse({});
  }
}

function writeStore(store: z.infer<typeof playerEngagementRollupStoreSchema>): void {
  const path = resolveStorePath();

  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    console.log(`[player-engagement-rollup] persist-failed path=${path} error=${message}`);
  }
}

function getSessionConfidence(session: SessionRecord): PlayerIntelligenceConfidence {
  const confidence = session.endConfidence ?? session.startConfidence ?? 'unknown';
  return playerIntelligenceConfidenceSchema.parse(confidence);
}

function getSourceSummary(session: SessionRecord): string[] {
  const sources = ['daily engagement rollup'];

  if (session.closeReason) {
    sources.push(session.closeReason);
  }

  if (session.startConfidence === 'low' || session.endConfidence === 'low') {
    sources.push('low-confidence session');
  }

  return sources;
}

function findOrCreateHourlyBucket(rollup: DailyPlayerEngagementRollup, hourUtc: number): DailyPlayerEngagementRollup['hourlyBuckets'][number] {
  const existing = rollup.hourlyBuckets.find((bucket) => bucket.hourUtc === hourUtc);

  if (existing) {
    return existing;
  }

  const created = hourlyEngagementBucketSchema.parse({
    hourUtc,
    sessionStartCount: 0,
    trackedSeconds: 0,
    activePlayerKeys: [],
    lowConfidenceSessionCount: 0,
    inferredSessionCount: 0
  });

  rollup.hourlyBuckets.push(created);
  rollup.hourlyBuckets.sort((left, right) => left.hourUtc - right.hourUtc);
  return created;
}

function getHourlyOverlaps(session: SessionRecord): Array<{ hourUtc: number; trackedSeconds: number; includesStart: boolean }> {
  if (!session.endedAt) {
    return [];
  }

  const startedAtMs = Date.parse(session.startedAt);
  const endedAtMs = Date.parse(session.endedAt);

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs) || endedAtMs <= startedAtMs) {
    return [];
  }

  const overlaps: Array<{ hourUtc: number; trackedSeconds: number; includesStart: boolean }> = [];
  let cursor = startedAtMs;

  while (cursor < endedAtMs) {
    const cursorDate = new Date(cursor);
    const nextHourMs = Date.UTC(
      cursorDate.getUTCFullYear(),
      cursorDate.getUTCMonth(),
      cursorDate.getUTCDate(),
      cursorDate.getUTCHours() + 1,
      0,
      0,
      0
    );
    const segmentEndMs = Math.min(endedAtMs, nextHourMs);

    overlaps.push({
      hourUtc: cursorDate.getUTCHours(),
      trackedSeconds: Math.max(0, Math.floor((segmentEndMs - cursor) / 1000)),
      includesStart: cursor === startedAtMs
    });
    cursor = segmentEndMs;
  }

  return overlaps;
}

function recordHourlyBuckets(
  rollup: DailyPlayerEngagementRollup,
  input: {
    session: SessionRecord;
    playerKey: string;
    lowConfidence: boolean;
    inferred: boolean;
  }
): void {
  const overlaps = getHourlyOverlaps(input.session);

  for (const overlap of overlaps) {
    const bucket = findOrCreateHourlyBucket(rollup, overlap.hourUtc);

    if (overlap.includesStart) {
      bucket.sessionStartCount += 1;
    }

    bucket.trackedSeconds += overlap.trackedSeconds;
    bucket.activePlayerKeys = dedupe([...bucket.activePlayerKeys, input.playerKey]);
    bucket.lowConfidenceSessionCount += input.lowConfidence ? 1 : 0;
    bucket.inferredSessionCount += input.inferred ? 1 : 0;
  }
}

function findOrCreateDailyRollup(
  store: z.infer<typeof playerEngagementRollupStoreSchema>,
  input: {
    serverId: string;
    date: string;
    playerName: string;
    observedAt: string;
  }
): DailyPlayerEngagementRollup {
  const playerKey = normalize(input.playerName);
  const existing = store.dailyRollups.find((rollup) => (
    rollup.serverId === input.serverId
    && rollup.date === input.date
    && rollup.playerKey === playerKey
  ));

  if (existing) {
    return existing;
  }

  const created = dailyPlayerEngagementRollupSchema.parse({
    serverId: input.serverId,
    date: input.date,
    playerId: getPlayerId(input.serverId, input.playerName),
    playerKey,
    displayName: input.playerName,
    sessionCount: 0,
    trackedSeconds: 0,
    firstSeenAt: input.observedAt,
    lastSeenAt: input.observedAt,
    lowConfidenceSessionCount: 0,
    inferredSessionCount: 0,
    sourceSummary: ['daily engagement rollup'],
    sourceSessionIds: [],
    hourlyBuckets: []
  });

  store.dailyRollups.push(created);
  return created;
}

export function recordClosedSessionEngagementRollup(session: SessionRecord): boolean {
  if (!session.endedAt) {
    return false;
  }

  const date = getUtcDate(session.endedAt);

  if (!date) {
    return false;
  }

  const sessionId = getClosedSessionEngagementId(session);
  const store = loadStore();

  if (store.processedSessionIds.includes(sessionId)) {
    return false;
  }

  const rollup = findOrCreateDailyRollup(store, {
    serverId: session.serverId,
    date,
    playerName: session.playerName,
    observedAt: session.startedAt
  });
  const confidence = getSessionConfidence(session);
  const playerKey = normalize(session.playerName);
  const lowConfidence = confidence === 'low' || confidence === 'unknown';
  const inferred = session.closeReason === 'occupancy_reconciliation' || session.endConfidence === 'low';

  rollup.displayName = session.playerName;
  rollup.sessionCount += 1;
  rollup.trackedSeconds += getDurationSeconds(session);
  rollup.firstSeenAt = minTimestamp(rollup.firstSeenAt, session.startedAt);
  rollup.lastSeenAt = maxTimestamp(rollup.lastSeenAt, session.endedAt);
  rollup.lowConfidenceSessionCount += lowConfidence ? 1 : 0;
  rollup.inferredSessionCount += inferred ? 1 : 0;
  rollup.sourceSummary = dedupe([...rollup.sourceSummary, ...getSourceSummary(session)]);
  rollup.sourceSessionIds = dedupe([sessionId, ...rollup.sourceSessionIds]).slice(0, MAX_SOURCE_SESSION_IDS_PER_DAY);
  recordHourlyBuckets(rollup, {
    session,
    playerKey,
    lowConfidence,
    inferred
  });

  store.processedSessionIds.push(sessionId);
  if (store.processedSessionIds.length > MAX_PROCESSED_SESSION_IDS) {
    store.processedSessionIds.splice(0, store.processedSessionIds.length - MAX_PROCESSED_SESSION_IDS);
  }

  store.dailyRollups.sort((left, right) => (
    left.serverId.localeCompare(right.serverId)
    || left.date.localeCompare(right.date)
    || left.displayName.localeCompare(right.displayName)
  ));

  writeStore(store);
  return true;
}

export function getDailyPlayerEngagementRollupsForServer(serverId: string): DailyPlayerEngagementRollup[] {
  return loadStore().dailyRollups
    .filter((rollup) => rollup.serverId === serverId)
    .sort((left, right) => right.date.localeCompare(left.date) || right.lastSeenAt.localeCompare(left.lastSeenAt));
}

export function resetPlayerEngagementRollupStoreForTests(): void {
  writeStore(playerEngagementRollupStoreSchema.parse({}));
}
