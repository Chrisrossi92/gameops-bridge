import { z } from 'zod';
export const gameKeySchema = z.enum(['valheim', 'palworld']);
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
export const normalizedEventSchema = z.object({
    id: z.string().optional(),
    game: gameKeySchema,
    serverId: z.string().min(1),
    eventType: eventTypeSchema,
    playerName: z.string().optional(),
    platformId: z.string().optional(),
    message: z.string().optional(),
    occurredAt: z.string().datetime(),
    raw: z.record(z.string(), z.unknown()).optional()
});
export const ingestEventsRequestSchema = z.object({
    events: z.array(normalizedEventSchema).min(1)
});
export const recentEventsResponseSchema = z.object({
    serverId: z.string().min(1),
    events: z.array(normalizedEventSchema)
});
export const sessionRecordSchema = z.object({
    serverId: z.string().min(1),
    playerName: z.string().min(1),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional(),
    durationSeconds: z.number().int().min(0).optional()
});
export const activeSessionsResponseSchema = z.object({
    serverId: z.string().min(1),
    sessions: z.array(sessionRecordSchema)
});
export const recentSessionsResponseSchema = z.object({
    serverId: z.string().min(1),
    sessions: z.array(sessionRecordSchema)
});
export const identityConfidenceSchema = z.enum(['low', 'medium', 'high']);
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
export const knownPlayersResponseSchema = z.object({
    serverId: z.string().min(1),
    players: z.array(knownPlayerRecordSchema)
});
export const knownPlayerProfileResponseSchema = z.object({
    serverId: z.string().min(1),
    player: knownPlayerRecordSchema.nullable(),
    isOnline: z.boolean(),
    activeSession: sessionRecordSchema.nullable(),
    recentSessions: z.array(sessionRecordSchema)
});
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
export const playerCharacterAuditAssessmentSchema = z.enum([
    'insufficient_evidence',
    'single_character_observed',
    'possible_multiple_characters',
    'multiple_characters_observed'
]);
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
export const serverStateSchema = z.enum([
    'online',
    'offline',
    'starting',
    'stopping',
    'restarting',
    'degraded'
]);
export const serverStatusSchema = z.object({
    serverId: z.string().min(1),
    game: gameKeySchema,
    state: serverStateSchema,
    playerCount: z.number().int().min(0),
    maxPlayers: z.number().int().min(1),
    lastCheckedAt: z.string().datetime(),
    message: z.string().optional()
});
//# sourceMappingURL=index.js.map