import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import {
  palworldTransitionMilestoneEventSchema,
  type PalworldLevelTier,
  type PalworldSessionTier,
  type PalworldTransitionMilestoneEvent,
  type PalworldUnifiedPlayerProfile
} from '@gameops/shared';
import { z } from 'zod';
import { getActiveSessionsForServer } from './event-store.js';
import { getPalworldUnifiedProfilesForServer } from './palworld-player-profile.js';

const MAX_STORED_TRANSITION_EVENTS = 500;

const transitionStateRecordSchema = z.object({
  serverId: z.string().min(1),
  playerId: z.string().min(1),
  lastEmittedLevelTier: z.string().nullable().default(null),
  lastEmittedSessionTier: z.string().nullable().default(null),
  lastEmittedIdentityReviewState: z.string().nullable().default(null),
  activeSessionKey: z.string().nullable().default(null),
  lastEvaluatedAt: z.string().datetime()
});

const transitionStoreSchema = z.object({
  states: z.array(transitionStateRecordSchema).default([]),
  recentEvents: z.array(palworldTransitionMilestoneEventSchema).default([])
});

type TransitionStateRecord = z.infer<typeof transitionStateRecordSchema>;
type TransitionStore = z.infer<typeof transitionStoreSchema>;

let transitionStateInitialized = false;
const transitionStateByKey = new Map<string, TransitionStateRecord>();
const recentTransitionEvents: PalworldTransitionMilestoneEvent[] = [];

function resolveTransitionStorePath(): string {
  const rawPath = process.env.PALWORLD_MILESTONE_TRANSITION_STORE_PATH ?? '../palworld-milestone-transitions.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function getStateKey(serverId: string, playerId: string): string {
  return `${serverId}::${playerId}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function initializeTransitionStoreIfNeeded(): void {
  if (transitionStateInitialized) {
    return;
  }

  transitionStateInitialized = true;
  const path = resolveTransitionStorePath();

  try {
    const parsed = transitionStoreSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);

    for (const state of parsed.states) {
      transitionStateByKey.set(getStateKey(state.serverId, state.playerId), state);
    }

    recentTransitionEvents.push(...parsed.recentEvents.slice(-MAX_STORED_TRANSITION_EVENTS));
    console.log(`[palworld-transition] state-loaded path=${path} states=${parsed.states.length} events=${recentTransitionEvents.length}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    console.log(`[palworld-transition] state-load-skipped path=${path} reason=${message}`);
  }
}

function persistTransitionStore(): void {
  const path = resolveTransitionStorePath();
  const payload: TransitionStore = transitionStoreSchema.parse({
    states: Array.from(transitionStateByKey.values()),
    recentEvents: recentTransitionEvents.slice(-MAX_STORED_TRANSITION_EVENTS)
  });

  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    console.log(`[palworld-transition] persist-failed path=${path} error=${message}`);
  }
}

function getStateRecord(serverId: string, playerId: string): TransitionStateRecord | null {
  initializeTransitionStoreIfNeeded();
  return transitionStateByKey.get(getStateKey(serverId, playerId)) ?? null;
}

function upsertStateRecord(state: TransitionStateRecord): void {
  transitionStateByKey.set(getStateKey(state.serverId, state.playerId), state);
}

function getLevelTierRank(levelTier: PalworldLevelTier | null): number {
  switch (levelTier) {
    case 'new': return 0;
    case 'mid': return 1;
    case 'high': return 2;
    case 'elite': return 3;
    default: return -1;
  }
}

function getSessionTierRank(sessionTier: PalworldSessionTier | null): number {
  switch (sessionTier) {
    case 'short': return 0;
    case 'active': return 1;
    case 'grinding': return 2;
    case 'marathon': return 3;
    default: return -1;
  }
}

function findActiveSessionKey(profile: PalworldUnifiedPlayerProfile): string | null {
  if (!profile.isOnline) {
    return null;
  }

  const normalizedName = normalize(profile.playerName ?? '');

  if (normalizedName) {
    const session = getActiveSessionsForServer(profile.serverId).find((entry) => normalize(entry.playerName) === normalizedName) ?? null;
    if (session) {
      return session.startedAt;
    }
  }

  if (profile.lastSeenAt && typeof profile.currentSessionDurationSeconds === 'number') {
    const lastSeenMs = new Date(profile.lastSeenAt).getTime();
    if (Number.isFinite(lastSeenMs)) {
      return new Date(lastSeenMs - (profile.currentSessionDurationSeconds * 1000)).toISOString();
    }
  }

  return null;
}

function createTransitionEvent(input: {
  profile: PalworldUnifiedPlayerProfile;
  eventType: PalworldTransitionMilestoneEvent['eventType'];
  fromValue: string | null;
  toValue: string | null;
  reason: string;
  activeSessionKey: string | null;
}): PalworldTransitionMilestoneEvent {
  return palworldTransitionMilestoneEventSchema.parse({
    serverId: input.profile.serverId,
    playerId: input.profile.playerId,
    playerName: input.profile.playerName,
    accountName: input.profile.accountName,
    eventType: input.eventType,
    occurredAt: new Date().toISOString(),
    identityState: input.profile.identityState,
    level: input.profile.level,
    levelTier: input.profile.levelTier,
    sessionTier: input.profile.sessionTier,
    activeSessionKey: input.activeSessionKey,
    fromValue: input.fromValue,
    toValue: input.toValue,
    reason: input.reason
  });
}

function evaluateProfileTransitions(profile: PalworldUnifiedPlayerProfile): PalworldTransitionMilestoneEvent[] {
  const existing = getStateRecord(profile.serverId, profile.playerId);
  const activeSessionKey = findActiveSessionKey(profile);
  const nextState: TransitionStateRecord = transitionStateRecordSchema.parse({
    serverId: profile.serverId,
    playerId: profile.playerId,
    lastEmittedLevelTier: existing?.lastEmittedLevelTier ?? null,
    lastEmittedSessionTier: existing?.lastEmittedSessionTier ?? null,
    lastEmittedIdentityReviewState: existing?.lastEmittedIdentityReviewState ?? null,
    activeSessionKey,
    lastEvaluatedAt: new Date().toISOString()
  });

  if (!existing) {
    nextState.lastEmittedLevelTier = profile.levelTier;
    nextState.lastEmittedSessionTier = profile.sessionTier;
    nextState.lastEmittedIdentityReviewState = profile.identityState;
    upsertStateRecord(nextState);
    return [];
  }

  const events: PalworldTransitionMilestoneEvent[] = [];

  if (getLevelTierRank(profile.levelTier) > getLevelTierRank((existing.lastEmittedLevelTier as PalworldLevelTier | null) ?? null)) {
    events.push(createTransitionEvent({
      profile,
      eventType: 'PALWORLD_LEVEL_TIER_ENTERED',
      fromValue: existing.lastEmittedLevelTier,
      toValue: profile.levelTier,
      reason: `Player entered the ${profile.levelTier ?? 'unknown'} level tier.`,
      activeSessionKey
    }));
  }

  const sessionKeyChanged = existing.activeSessionKey !== activeSessionKey;
  if (sessionKeyChanged) {
    nextState.lastEmittedSessionTier = profile.sessionTier;
  } else if (
    getSessionTierRank(profile.sessionTier) > getSessionTierRank((existing.lastEmittedSessionTier as PalworldSessionTier | null) ?? null)
  ) {
    events.push(createTransitionEvent({
      profile,
      eventType: 'PALWORLD_SESSION_TIER_ENTERED',
      fromValue: existing.lastEmittedSessionTier,
      toValue: profile.sessionTier,
      reason: `Player entered the ${profile.sessionTier ?? 'unknown'} session tier during the active session.`,
      activeSessionKey
    }));
  }

  if (existing.lastEmittedIdentityReviewState !== 'approved' && profile.identityState === 'approved') {
    events.push(createTransitionEvent({
      profile,
      eventType: 'PALWORLD_IDENTITY_APPROVED',
      fromValue: existing.lastEmittedIdentityReviewState,
      toValue: profile.identityState,
      reason: 'Player identity review state changed into approved.',
      activeSessionKey
    }));
  }

  nextState.lastEmittedLevelTier = profile.levelTier;
  nextState.lastEmittedSessionTier = profile.sessionTier;
  nextState.lastEmittedIdentityReviewState = profile.identityState;
  upsertStateRecord(nextState);
  return events;
}

export function evaluatePalworldMilestoneTransitionsForServer(serverId: string): PalworldTransitionMilestoneEvent[] {
  initializeTransitionStoreIfNeeded();

  const profiles = getPalworldUnifiedProfilesForServer(serverId, 10_000);
  const generated = profiles.flatMap((profile) => evaluateProfileTransitions(profile));

  if (generated.length > 0) {
    recentTransitionEvents.push(...generated);
    if (recentTransitionEvents.length > MAX_STORED_TRANSITION_EVENTS) {
      recentTransitionEvents.splice(0, recentTransitionEvents.length - MAX_STORED_TRANSITION_EVENTS);
    }
  }

  persistTransitionStore();
  return generated;
}

export function getRecentPalworldMilestoneTransitionEventsForServer(serverId: string, limit = 20): PalworldTransitionMilestoneEvent[] {
  initializeTransitionStoreIfNeeded();
  return recentTransitionEvents
    .filter((event) => event.serverId === serverId)
    .slice(-Math.max(1, limit))
    .reverse();
}
