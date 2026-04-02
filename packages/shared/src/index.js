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