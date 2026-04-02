import { z } from 'zod';
export declare const gameKeySchema: z.ZodEnum<{
    valheim: "valheim";
    palworld: "palworld";
}>;
export type GameKey = z.infer<typeof gameKeySchema>;
export declare const eventTypeSchema: z.ZodEnum<{
    PLAYER_JOIN: "PLAYER_JOIN";
    PLAYER_LEAVE: "PLAYER_LEAVE";
    CHAT_MESSAGE: "CHAT_MESSAGE";
    SERVER_ONLINE: "SERVER_ONLINE";
    SERVER_OFFLINE: "SERVER_OFFLINE";
    SERVER_RESTARTING: "SERVER_RESTARTING";
    HEALTH_WARN: "HEALTH_WARN";
    INCIDENT_OPENED: "INCIDENT_OPENED";
}>;
export type EventType = z.infer<typeof eventTypeSchema>;
export declare const normalizedEventSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    game: z.ZodEnum<{
        valheim: "valheim";
        palworld: "palworld";
    }>;
    serverId: z.ZodString;
    eventType: z.ZodEnum<{
        PLAYER_JOIN: "PLAYER_JOIN";
        PLAYER_LEAVE: "PLAYER_LEAVE";
        CHAT_MESSAGE: "CHAT_MESSAGE";
        SERVER_ONLINE: "SERVER_ONLINE";
        SERVER_OFFLINE: "SERVER_OFFLINE";
        SERVER_RESTARTING: "SERVER_RESTARTING";
        HEALTH_WARN: "HEALTH_WARN";
        INCIDENT_OPENED: "INCIDENT_OPENED";
    }>;
    playerName: z.ZodOptional<z.ZodString>;
    platformId: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    occurredAt: z.ZodString;
    raw: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type NormalizedEvent = z.infer<typeof normalizedEventSchema>;
export declare const ingestEventsRequestSchema: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        game: z.ZodEnum<{
            valheim: "valheim";
            palworld: "palworld";
        }>;
        serverId: z.ZodString;
        eventType: z.ZodEnum<{
            PLAYER_JOIN: "PLAYER_JOIN";
            PLAYER_LEAVE: "PLAYER_LEAVE";
            CHAT_MESSAGE: "CHAT_MESSAGE";
            SERVER_ONLINE: "SERVER_ONLINE";
            SERVER_OFFLINE: "SERVER_OFFLINE";
            SERVER_RESTARTING: "SERVER_RESTARTING";
            HEALTH_WARN: "HEALTH_WARN";
            INCIDENT_OPENED: "INCIDENT_OPENED";
        }>;
        playerName: z.ZodOptional<z.ZodString>;
        platformId: z.ZodOptional<z.ZodString>;
        message: z.ZodOptional<z.ZodString>;
        occurredAt: z.ZodString;
        raw: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type IngestEventsRequest = z.infer<typeof ingestEventsRequestSchema>;
export declare const recentEventsResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        game: z.ZodEnum<{
            valheim: "valheim";
            palworld: "palworld";
        }>;
        serverId: z.ZodString;
        eventType: z.ZodEnum<{
            PLAYER_JOIN: "PLAYER_JOIN";
            PLAYER_LEAVE: "PLAYER_LEAVE";
            CHAT_MESSAGE: "CHAT_MESSAGE";
            SERVER_ONLINE: "SERVER_ONLINE";
            SERVER_OFFLINE: "SERVER_OFFLINE";
            SERVER_RESTARTING: "SERVER_RESTARTING";
            HEALTH_WARN: "HEALTH_WARN";
            INCIDENT_OPENED: "INCIDENT_OPENED";
        }>;
        playerName: z.ZodOptional<z.ZodString>;
        platformId: z.ZodOptional<z.ZodString>;
        message: z.ZodOptional<z.ZodString>;
        occurredAt: z.ZodString;
        raw: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RecentEventsResponse = z.infer<typeof recentEventsResponseSchema>;
export declare const serverStateSchema: z.ZodEnum<{
    online: "online";
    offline: "offline";
    starting: "starting";
    stopping: "stopping";
    restarting: "restarting";
    degraded: "degraded";
}>;
export type ServerState = z.infer<typeof serverStateSchema>;
export declare const serverStatusSchema: z.ZodObject<{
    serverId: z.ZodString;
    game: z.ZodEnum<{
        valheim: "valheim";
        palworld: "palworld";
    }>;
    state: z.ZodEnum<{
        online: "online";
        offline: "offline";
        starting: "starting";
        stopping: "stopping";
        restarting: "restarting";
        degraded: "degraded";
    }>;
    playerCount: z.ZodNumber;
    maxPlayers: z.ZodNumber;
    lastCheckedAt: z.ZodString;
    message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ServerStatus = z.infer<typeof serverStatusSchema>;
//# sourceMappingURL=index.d.ts.map