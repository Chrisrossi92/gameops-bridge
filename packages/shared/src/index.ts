import { z } from 'zod';

export const gameKeySchema = z.enum(['valheim', 'palworld']);
export type GameKey = z.infer<typeof gameKeySchema>;

export const eventTypeSchema = z.enum([
  'PLAYER_JOIN',
  'PLAYER_LEAVE',
  'CHAT_MESSAGE',
  'SERVER_ONLINE',
  'SERVER_OFFLINE',
  'SERVER_RESTARTING',
  'HEALTH_WARN',
  'INCIDENT_OPENED'
]);
export type EventType = z.infer<typeof eventTypeSchema>;

export const normalizedEventRawSchema = z.object({
  sessionCloseReason: z.string().optional(),
  sessionReconciledCount: z.number().int().min(0).optional(),
  replacedSessionStartedAt: z.string().datetime().optional(),
  valheimCurrentPlayerCount: z.number().int().min(0).optional(),
  valheimDisconnectSignal: z.boolean().optional(),
  valheimDisconnectRule: z.string().optional()
}).catchall(z.unknown());

export const normalizedEventSchema = z.object({
  id: z.string().optional(),
  game: gameKeySchema,
  serverId: z.string().min(1),
  eventType: eventTypeSchema,
  playerName: z.string().optional(),
  platformId: z.string().optional(),
  message: z.string().optional(),
  occurredAt: z.string().datetime(),
  raw: normalizedEventRawSchema.optional()
});
export type NormalizedEvent = z.infer<typeof normalizedEventSchema>;

export const ingestEventsRequestSchema = z.object({
  events: z.array(normalizedEventSchema).min(1)
});
export type IngestEventsRequest = z.infer<typeof ingestEventsRequestSchema>;

export const recentEventsResponseSchema = z.object({
  serverId: z.string().min(1),
  events: z.array(normalizedEventSchema)
});
export type RecentEventsResponse = z.infer<typeof recentEventsResponseSchema>;

export const sessionRecordSchema = z.object({
  serverId: z.string().min(1),
  playerName: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  durationSeconds: z.number().int().min(0).optional()
});
export type SessionRecord = z.infer<typeof sessionRecordSchema>;

export const activeSessionsResponseSchema = z.object({
  serverId: z.string().min(1),
  sessions: z.array(sessionRecordSchema)
});
export type ActiveSessionsResponse = z.infer<typeof activeSessionsResponseSchema>;

export const recentSessionsResponseSchema = z.object({
  serverId: z.string().min(1),
  sessions: z.array(sessionRecordSchema)
});
export type RecentSessionsResponse = z.infer<typeof recentSessionsResponseSchema>;

export const identityConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type IdentityConfidence = z.infer<typeof identityConfidenceSchema>;

export const knownPlayerRecordSchema = z.object({
  serverId: z.string().min(1),
  displayName: z.string().min(1),
  normalizedPlayerKey: z.string().min(1),
  knownPlatformIds: z.array(z.string()).default([]),
  knownPlayFabIds: z.array(z.string()).default([]),
  knownCharacterIds: z.array(z.string()).default([]),
  identitySources: z.array(z.string()).default([]),
  observationCount: z.number().int().min(1),
  confidence: identityConfidenceSchema,
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime()
});
export type KnownPlayerRecord = z.infer<typeof knownPlayerRecordSchema>;

export const knownPlayersResponseSchema = z.object({
  serverId: z.string().min(1),
  players: z.array(knownPlayerRecordSchema)
});
export type KnownPlayersResponse = z.infer<typeof knownPlayersResponseSchema>;

export const knownPlayerProfileResponseSchema = z.object({
  serverId: z.string().min(1),
  player: knownPlayerRecordSchema.nullable(),
  isOnline: z.boolean(),
  activeSession: sessionRecordSchema.nullable(),
  recentSessions: z.array(sessionRecordSchema)
});
export type KnownPlayerProfileResponse = z.infer<typeof knownPlayerProfileResponseSchema>;

export const identityObservationSchema = z.object({
  serverId: z.string().min(1),
  displayName: z.string().min(1),
  normalizedPlayerKey: z.string().min(1),
  observedAt: z.string().datetime(),
  playFabId: z.string().optional(),
  platformId: z.string().optional(),
  characterId: z.string().optional(),
  source: z.string().min(1),
  confidence: identityConfidenceSchema
});
export type IdentityObservation = z.infer<typeof identityObservationSchema>;

export const playerCharacterAuditAssessmentSchema = z.enum([
  'insufficient_evidence',
  'single_character_observed',
  'possible_multiple_characters',
  'multiple_characters_observed'
]);
export type PlayerCharacterAuditAssessment = z.infer<typeof playerCharacterAuditAssessmentSchema>;

export const playerCharacterAuditResponseSchema = z.object({
  serverId: z.string().min(1),
  player: knownPlayerRecordSchema.nullable(),
  distinctPlatformIds: z.array(z.string()),
  distinctPlayFabIds: z.array(z.string()),
  distinctCharacterIds: z.array(z.string()),
  recentObservations: z.array(identityObservationSchema),
  totalObservations: z.number().int().min(0),
  assessment: playerCharacterAuditAssessmentSchema
});
export type PlayerCharacterAuditResponse = z.infer<typeof playerCharacterAuditResponseSchema>;

export const serverStateSchema = z.enum([
  'online',
  'offline',
  'starting',
  'stopping',
  'restarting',
  'degraded'
]);
export type ServerState = z.infer<typeof serverStateSchema>;

export const serverStatusSchema = z.object({
  serverId: z.string().min(1),
  game: gameKeySchema,
  state: serverStateSchema,
  playerCount: z.number().int().min(0),
  maxPlayers: z.number().int().min(1),
  lastCheckedAt: z.string().datetime(),
  message: z.string().optional()
});
export type ServerStatus = z.infer<typeof serverStatusSchema>;
