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
export declare const sessionRecordSchema: z.ZodObject<{
    serverId: z.ZodString;
    playerName: z.ZodString;
    startedAt: z.ZodString;
    endedAt: z.ZodOptional<z.ZodString>;
    durationSeconds: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type SessionRecord = z.infer<typeof sessionRecordSchema>;
export declare const activeSessionsResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    sessions: z.ZodArray<z.ZodObject<{
        serverId: z.ZodString;
        playerName: z.ZodString;
        startedAt: z.ZodString;
        endedAt: z.ZodOptional<z.ZodString>;
        durationSeconds: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ActiveSessionsResponse = z.infer<typeof activeSessionsResponseSchema>;
export declare const recentSessionsResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    sessions: z.ZodArray<z.ZodObject<{
        serverId: z.ZodString;
        playerName: z.ZodString;
        startedAt: z.ZodString;
        endedAt: z.ZodOptional<z.ZodString>;
        durationSeconds: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RecentSessionsResponse = z.infer<typeof recentSessionsResponseSchema>;
export declare const identityConfidenceSchema: z.ZodEnum<{
    low: "low";
    medium: "medium";
    high: "high";
}>;
export type IdentityConfidence = z.infer<typeof identityConfidenceSchema>;
export declare const knownPlayerRecordSchema: z.ZodObject<{
    serverId: z.ZodString;
    displayName: z.ZodString;
    normalizedPlayerKey: z.ZodString;
    knownPlatformIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    knownPlayFabIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    knownCharacterIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    identitySources: z.ZodDefault<z.ZodArray<z.ZodString>>;
    observationCount: z.ZodNumber;
    confidence: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    firstSeenAt: z.ZodString;
    lastSeenAt: z.ZodString;
}, z.core.$strip>;
export type KnownPlayerRecord = z.infer<typeof knownPlayerRecordSchema>;
export declare const knownPlayersResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    players: z.ZodArray<z.ZodObject<{
        serverId: z.ZodString;
        displayName: z.ZodString;
        normalizedPlayerKey: z.ZodString;
        knownPlatformIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        knownPlayFabIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        knownCharacterIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        identitySources: z.ZodDefault<z.ZodArray<z.ZodString>>;
        observationCount: z.ZodNumber;
        confidence: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        firstSeenAt: z.ZodString;
        lastSeenAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type KnownPlayersResponse = z.infer<typeof knownPlayersResponseSchema>;
export declare const knownPlayerProfileResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    player: z.ZodNullable<z.ZodObject<{
        serverId: z.ZodString;
        displayName: z.ZodString;
        normalizedPlayerKey: z.ZodString;
        knownPlatformIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        knownPlayFabIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        knownCharacterIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        identitySources: z.ZodDefault<z.ZodArray<z.ZodString>>;
        observationCount: z.ZodNumber;
        confidence: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        firstSeenAt: z.ZodString;
        lastSeenAt: z.ZodString;
    }, z.core.$strip>>;
    isOnline: z.ZodBoolean;
    activeSession: z.ZodNullable<z.ZodObject<{
        serverId: z.ZodString;
        playerName: z.ZodString;
        startedAt: z.ZodString;
        endedAt: z.ZodOptional<z.ZodString>;
        durationSeconds: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    recentSessions: z.ZodArray<z.ZodObject<{
        serverId: z.ZodString;
        playerName: z.ZodString;
        startedAt: z.ZodString;
        endedAt: z.ZodOptional<z.ZodString>;
        durationSeconds: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type KnownPlayerProfileResponse = z.infer<typeof knownPlayerProfileResponseSchema>;
export declare const identityObservationSchema: z.ZodObject<{
    serverId: z.ZodString;
    displayName: z.ZodString;
    normalizedPlayerKey: z.ZodString;
    observedAt: z.ZodString;
    playFabId: z.ZodOptional<z.ZodString>;
    platformId: z.ZodOptional<z.ZodString>;
    characterId: z.ZodOptional<z.ZodString>;
    source: z.ZodString;
    confidence: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
}, z.core.$strip>;
export type IdentityObservation = z.infer<typeof identityObservationSchema>;
export declare const playerCharacterAuditAssessmentSchema: z.ZodEnum<{
    insufficient_evidence: "insufficient_evidence";
    single_character_observed: "single_character_observed";
    possible_multiple_characters: "possible_multiple_characters";
    multiple_characters_observed: "multiple_characters_observed";
}>;
export type PlayerCharacterAuditAssessment = z.infer<typeof playerCharacterAuditAssessmentSchema>;
export declare const playerCharacterAuditResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    player: z.ZodNullable<z.ZodObject<{
        serverId: z.ZodString;
        displayName: z.ZodString;
        normalizedPlayerKey: z.ZodString;
        knownPlatformIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        knownPlayFabIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        knownCharacterIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        identitySources: z.ZodDefault<z.ZodArray<z.ZodString>>;
        observationCount: z.ZodNumber;
        confidence: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        firstSeenAt: z.ZodString;
        lastSeenAt: z.ZodString;
    }, z.core.$strip>>;
    distinctPlatformIds: z.ZodArray<z.ZodString>;
    distinctPlayFabIds: z.ZodArray<z.ZodString>;
    distinctCharacterIds: z.ZodArray<z.ZodString>;
    recentObservations: z.ZodArray<z.ZodObject<{
        serverId: z.ZodString;
        displayName: z.ZodString;
        normalizedPlayerKey: z.ZodString;
        observedAt: z.ZodString;
        playFabId: z.ZodOptional<z.ZodString>;
        platformId: z.ZodOptional<z.ZodString>;
        characterId: z.ZodOptional<z.ZodString>;
        source: z.ZodString;
        confidence: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
    }, z.core.$strip>>;
    totalObservations: z.ZodNumber;
    assessment: z.ZodEnum<{
        insufficient_evidence: "insufficient_evidence";
        single_character_observed: "single_character_observed";
        possible_multiple_characters: "possible_multiple_characters";
        multiple_characters_observed: "multiple_characters_observed";
    }>;
}, z.core.$strip>;
export type PlayerCharacterAuditResponse = z.infer<typeof playerCharacterAuditResponseSchema>;
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