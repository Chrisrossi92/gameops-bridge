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
export declare const hostingModeSchema: z.ZodEnum<{
    self_hosted: "self_hosted";
    hybrid: "hybrid";
    hosted_limited: "hosted_limited";
}>;
export type HostingMode = z.infer<typeof hostingModeSchema>;
export declare const valheimConnectorModeSchema: z.ZodEnum<{
    file: "file";
    journal: "journal";
}>;
export type ValheimConnectorMode = z.infer<typeof valheimConnectorModeSchema>;
export declare const palworldConnectorModeSchema: z.ZodEnum<{
    file: "file";
    rest: "rest";
    rcon: "rcon";
    query: "query";
}>;
export type PalworldConnectorMode = z.infer<typeof palworldConnectorModeSchema>;
export declare const normalizedEventRawSchema: z.ZodObject<{
    discordNotify: z.ZodOptional<z.ZodBoolean>;
    ownerActionRequired: z.ZodOptional<z.ZodBoolean>;
    severity: z.ZodOptional<z.ZodEnum<{
        info: "info";
        warning: "warning";
        critical: "critical";
    }>>;
    sessionCloseReason: z.ZodOptional<z.ZodString>;
    sessionReconciledCount: z.ZodOptional<z.ZodNumber>;
    sessionClosedPlayers: z.ZodOptional<z.ZodArray<z.ZodString>>;
    sessionDurationSeconds: z.ZodOptional<z.ZodNumber>;
    replacedSessionStartedAt: z.ZodOptional<z.ZodString>;
    valheimCurrentPlayerCount: z.ZodOptional<z.ZodNumber>;
    valheimDisconnectSignal: z.ZodOptional<z.ZodBoolean>;
    valheimDisconnectRule: z.ZodOptional<z.ZodString>;
}, z.core.$catchall<z.ZodUnknown>>;
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
    raw: z.ZodOptional<z.ZodObject<{
        discordNotify: z.ZodOptional<z.ZodBoolean>;
        ownerActionRequired: z.ZodOptional<z.ZodBoolean>;
        severity: z.ZodOptional<z.ZodEnum<{
            info: "info";
            warning: "warning";
            critical: "critical";
        }>>;
        sessionCloseReason: z.ZodOptional<z.ZodString>;
        sessionReconciledCount: z.ZodOptional<z.ZodNumber>;
        sessionClosedPlayers: z.ZodOptional<z.ZodArray<z.ZodString>>;
        sessionDurationSeconds: z.ZodOptional<z.ZodNumber>;
        replacedSessionStartedAt: z.ZodOptional<z.ZodString>;
        valheimCurrentPlayerCount: z.ZodOptional<z.ZodNumber>;
        valheimDisconnectSignal: z.ZodOptional<z.ZodBoolean>;
        valheimDisconnectRule: z.ZodOptional<z.ZodString>;
    }, z.core.$catchall<z.ZodUnknown>>>;
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
        raw: z.ZodOptional<z.ZodObject<{
            discordNotify: z.ZodOptional<z.ZodBoolean>;
            ownerActionRequired: z.ZodOptional<z.ZodBoolean>;
            severity: z.ZodOptional<z.ZodEnum<{
                info: "info";
                warning: "warning";
                critical: "critical";
            }>>;
            sessionCloseReason: z.ZodOptional<z.ZodString>;
            sessionReconciledCount: z.ZodOptional<z.ZodNumber>;
            sessionClosedPlayers: z.ZodOptional<z.ZodArray<z.ZodString>>;
            sessionDurationSeconds: z.ZodOptional<z.ZodNumber>;
            replacedSessionStartedAt: z.ZodOptional<z.ZodString>;
            valheimCurrentPlayerCount: z.ZodOptional<z.ZodNumber>;
            valheimDisconnectSignal: z.ZodOptional<z.ZodBoolean>;
            valheimDisconnectRule: z.ZodOptional<z.ZodString>;
        }, z.core.$catchall<z.ZodUnknown>>>;
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
        raw: z.ZodOptional<z.ZodObject<{
            discordNotify: z.ZodOptional<z.ZodBoolean>;
            ownerActionRequired: z.ZodOptional<z.ZodBoolean>;
            severity: z.ZodOptional<z.ZodEnum<{
                info: "info";
                warning: "warning";
                critical: "critical";
            }>>;
            sessionCloseReason: z.ZodOptional<z.ZodString>;
            sessionReconciledCount: z.ZodOptional<z.ZodNumber>;
            sessionClosedPlayers: z.ZodOptional<z.ZodArray<z.ZodString>>;
            sessionDurationSeconds: z.ZodOptional<z.ZodNumber>;
            replacedSessionStartedAt: z.ZodOptional<z.ZodString>;
            valheimCurrentPlayerCount: z.ZodOptional<z.ZodNumber>;
            valheimDisconnectSignal: z.ZodOptional<z.ZodBoolean>;
            valheimDisconnectRule: z.ZodOptional<z.ZodString>;
        }, z.core.$catchall<z.ZodUnknown>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RecentEventsResponse = z.infer<typeof recentEventsResponseSchema>;
export declare const identityConfidenceSchema: z.ZodEnum<{
    low: "low";
    medium: "medium";
    high: "high";
}>;
export type IdentityConfidence = z.infer<typeof identityConfidenceSchema>;
export declare const sessionRecordSchema: z.ZodObject<{
    serverId: z.ZodString;
    playerName: z.ZodString;
    startedAt: z.ZodString;
    endedAt: z.ZodOptional<z.ZodString>;
    durationSeconds: z.ZodOptional<z.ZodNumber>;
    closeReason: z.ZodOptional<z.ZodString>;
    startConfidence: z.ZodOptional<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>>;
    endConfidence: z.ZodOptional<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>>;
    sourceEventIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
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
        closeReason: z.ZodOptional<z.ZodString>;
        startConfidence: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>>;
        endConfidence: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>>;
        sourceEventIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
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
        closeReason: z.ZodOptional<z.ZodString>;
        startConfidence: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>>;
        endConfidence: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>>;
        sourceEventIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RecentSessionsResponse = z.infer<typeof recentSessionsResponseSchema>;
export declare const activitySeveritySchema: z.ZodEnum<{
    info: "info";
    warning: "warning";
    critical: "critical";
}>;
export type ActivitySeverity = z.infer<typeof activitySeveritySchema>;
export declare const activityLogItemSchema: z.ZodObject<{
    id: z.ZodString;
    serverId: z.ZodString;
    timestamp: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    severity: z.ZodEnum<{
        info: "info";
        warning: "warning";
        critical: "critical";
    }>;
    confidence: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    explanation: z.ZodString;
    playerName: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    sourceEventIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type ActivityLogItem = z.infer<typeof activityLogItemSchema>;
export declare const activityLogResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        serverId: z.ZodString;
        timestamp: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        severity: z.ZodEnum<{
            info: "info";
            warning: "warning";
            critical: "critical";
        }>;
        confidence: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        explanation: z.ZodString;
        playerName: z.ZodOptional<z.ZodString>;
        sessionId: z.ZodOptional<z.ZodString>;
        sourceEventIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ActivityLogResponse = z.infer<typeof activityLogResponseSchema>;
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
        closeReason: z.ZodOptional<z.ZodString>;
        startConfidence: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>>;
        endConfidence: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>>;
        sourceEventIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    recentSessions: z.ZodArray<z.ZodObject<{
        serverId: z.ZodString;
        playerName: z.ZodString;
        startedAt: z.ZodString;
        endedAt: z.ZodOptional<z.ZodString>;
        durationSeconds: z.ZodOptional<z.ZodNumber>;
        closeReason: z.ZodOptional<z.ZodString>;
        startConfidence: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>>;
        endConfidence: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>>;
        sourceEventIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
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
export declare const configuredServerSummarySchema: z.ZodObject<{
    id: z.ZodString;
    displayName: z.ZodString;
    game: z.ZodEnum<{
        valheim: "valheim";
        palworld: "palworld";
    }>;
}, z.core.$strip>;
export type ConfiguredServerSummary = z.infer<typeof configuredServerSummarySchema>;
export declare const configuredServersResponseSchema: z.ZodObject<{
    servers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
        game: z.ZodEnum<{
            valheim: "valheim";
            palworld: "palworld";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ConfiguredServersResponse = z.infer<typeof configuredServersResponseSchema>;
export declare const palworldLatestPlayerTelemetrySchema: z.ZodObject<{
    serverId: z.ZodString;
    lookupKey: z.ZodString;
    playerName: z.ZodOptional<z.ZodString>;
    accountName: z.ZodOptional<z.ZodString>;
    playerId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    level: z.ZodOptional<z.ZodNumber>;
    ping: z.ZodOptional<z.ZodNumber>;
    locationX: z.ZodOptional<z.ZodNumber>;
    locationY: z.ZodOptional<z.ZodNumber>;
    region: z.ZodOptional<z.ZodString>;
    firstSeenAt: z.ZodString;
    lastSeenAt: z.ZodString;
    maxLevelSeen: z.ZodOptional<z.ZodNumber>;
    totalSessions: z.ZodNumber;
    isOnline: z.ZodBoolean;
    avgPing: z.ZodOptional<z.ZodNumber>;
    maxPing: z.ZodOptional<z.ZodNumber>;
    pingStdDev: z.ZodOptional<z.ZodNumber>;
    currentSessionDurationSeconds: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type PalworldLatestPlayerTelemetry = z.infer<typeof palworldLatestPlayerTelemetrySchema>;
export declare const palworldLatestPlayersResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    players: z.ZodArray<z.ZodObject<{
        serverId: z.ZodString;
        lookupKey: z.ZodString;
        playerName: z.ZodOptional<z.ZodString>;
        accountName: z.ZodOptional<z.ZodString>;
        playerId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        level: z.ZodOptional<z.ZodNumber>;
        ping: z.ZodOptional<z.ZodNumber>;
        locationX: z.ZodOptional<z.ZodNumber>;
        locationY: z.ZodOptional<z.ZodNumber>;
        region: z.ZodOptional<z.ZodString>;
        firstSeenAt: z.ZodString;
        lastSeenAt: z.ZodString;
        maxLevelSeen: z.ZodOptional<z.ZodNumber>;
        totalSessions: z.ZodNumber;
        isOnline: z.ZodBoolean;
        avgPing: z.ZodOptional<z.ZodNumber>;
        maxPing: z.ZodOptional<z.ZodNumber>;
        pingStdDev: z.ZodOptional<z.ZodNumber>;
        currentSessionDurationSeconds: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PalworldLatestPlayersResponse = z.infer<typeof palworldLatestPlayersResponseSchema>;
export declare const palworldPlayerTelemetryProfileResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    player: z.ZodNullable<z.ZodObject<{
        serverId: z.ZodString;
        lookupKey: z.ZodString;
        playerName: z.ZodOptional<z.ZodString>;
        accountName: z.ZodOptional<z.ZodString>;
        playerId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        level: z.ZodOptional<z.ZodNumber>;
        ping: z.ZodOptional<z.ZodNumber>;
        locationX: z.ZodOptional<z.ZodNumber>;
        locationY: z.ZodOptional<z.ZodNumber>;
        region: z.ZodOptional<z.ZodString>;
        firstSeenAt: z.ZodString;
        lastSeenAt: z.ZodString;
        maxLevelSeen: z.ZodOptional<z.ZodNumber>;
        totalSessions: z.ZodNumber;
        isOnline: z.ZodBoolean;
        avgPing: z.ZodOptional<z.ZodNumber>;
        maxPing: z.ZodOptional<z.ZodNumber>;
        pingStdDev: z.ZodOptional<z.ZodNumber>;
        currentSessionDurationSeconds: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PalworldPlayerTelemetryProfileResponse = z.infer<typeof palworldPlayerTelemetryProfileResponseSchema>;
export declare const palworldPlayerSnapshotSchema: z.ZodObject<{
    serverId: z.ZodString;
    observedAt: z.ZodString;
    lookupKey: z.ZodString;
    playerName: z.ZodOptional<z.ZodString>;
    accountName: z.ZodOptional<z.ZodString>;
    playerId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    level: z.ZodOptional<z.ZodNumber>;
    ping: z.ZodOptional<z.ZodNumber>;
    locationX: z.ZodOptional<z.ZodNumber>;
    locationY: z.ZodOptional<z.ZodNumber>;
    region: z.ZodOptional<z.ZodString>;
    raw: z.ZodUnknown;
}, z.core.$strip>;
export type PalworldPlayerSnapshot = z.infer<typeof palworldPlayerSnapshotSchema>;
export declare const palworldPlayerSnapshotsResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    snapshots: z.ZodArray<z.ZodObject<{
        serverId: z.ZodString;
        observedAt: z.ZodString;
        lookupKey: z.ZodString;
        playerName: z.ZodOptional<z.ZodString>;
        accountName: z.ZodOptional<z.ZodString>;
        playerId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        level: z.ZodOptional<z.ZodNumber>;
        ping: z.ZodOptional<z.ZodNumber>;
        locationX: z.ZodOptional<z.ZodNumber>;
        locationY: z.ZodOptional<z.ZodNumber>;
        region: z.ZodOptional<z.ZodString>;
        raw: z.ZodUnknown;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PalworldPlayerSnapshotsResponse = z.infer<typeof palworldPlayerSnapshotsResponseSchema>;
export declare const palworldMetricsSummarySchema: z.ZodObject<{
    serverId: z.ZodString;
    observedAt: z.ZodString;
    currentPlayerCount: z.ZodOptional<z.ZodNumber>;
    serverFps: z.ZodOptional<z.ZodNumber>;
    uptimeSeconds: z.ZodOptional<z.ZodNumber>;
    averageFps: z.ZodOptional<z.ZodNumber>;
    worstFrameTimeMs: z.ZodOptional<z.ZodNumber>;
    currentUptimeHours: z.ZodOptional<z.ZodNumber>;
    raw: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export type PalworldMetricsSummary = z.infer<typeof palworldMetricsSummarySchema>;
export declare const palworldMetricsSummariesResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    metrics: z.ZodArray<z.ZodObject<{
        serverId: z.ZodString;
        observedAt: z.ZodString;
        currentPlayerCount: z.ZodOptional<z.ZodNumber>;
        serverFps: z.ZodOptional<z.ZodNumber>;
        uptimeSeconds: z.ZodOptional<z.ZodNumber>;
        averageFps: z.ZodOptional<z.ZodNumber>;
        worstFrameTimeMs: z.ZodOptional<z.ZodNumber>;
        currentUptimeHours: z.ZodOptional<z.ZodNumber>;
        raw: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PalworldMetricsSummariesResponse = z.infer<typeof palworldMetricsSummariesResponseSchema>;
export declare const palworldHighlightImportanceSchema: z.ZodEnum<{
    low: "low";
    medium: "medium";
    high: "high";
}>;
export type PalworldHighlightImportance = z.infer<typeof palworldHighlightImportanceSchema>;
export declare const palworldHighlightSchema: z.ZodObject<{
    type: z.ZodString;
    message: z.ZodString;
    importance: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
}, z.core.$strip>;
export type PalworldHighlight = z.infer<typeof palworldHighlightSchema>;
export declare const palworldHighlightsResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    highlights: z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        message: z.ZodString;
        importance: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PalworldHighlightsResponse = z.infer<typeof palworldHighlightsResponseSchema>;
export declare const palworldIdentityLinkCandidateSchema: z.ZodObject<{
    serverId: z.ZodString;
    savePlayerFileName: z.ZodString;
    savePlayerSaveId: z.ZodString;
    telemetryLookupKey: z.ZodNullable<z.ZodString>;
    candidate: z.ZodObject<{
        playerId: z.ZodNullable<z.ZodString>;
        userId: z.ZodNullable<z.ZodString>;
        accountName: z.ZodNullable<z.ZodString>;
        playerName: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    confidence: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    score: z.ZodNumber;
    matchedOn: z.ZodArray<z.ZodString>;
    notes: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type PalworldIdentityLinkCandidate = z.infer<typeof palworldIdentityLinkCandidateSchema>;
export declare const palworldIdentityLinkFailureSchema: z.ZodObject<{
    savePlayerFileName: z.ZodString;
    savePlayerSaveId: z.ZodString;
    status: z.ZodEnum<{
        skipped: "skipped";
        no_match: "no_match";
        input_error: "input_error";
    }>;
    message: z.ZodString;
}, z.core.$strip>;
export type PalworldIdentityLinkFailure = z.infer<typeof palworldIdentityLinkFailureSchema>;
export declare const palworldIdentityLinksResponseSchema: z.ZodObject<{
    generatedAt: z.ZodOptional<z.ZodString>;
    candidates: z.ZodArray<z.ZodObject<{
        serverId: z.ZodString;
        savePlayerFileName: z.ZodString;
        savePlayerSaveId: z.ZodString;
        telemetryLookupKey: z.ZodNullable<z.ZodString>;
        candidate: z.ZodObject<{
            playerId: z.ZodNullable<z.ZodString>;
            userId: z.ZodNullable<z.ZodString>;
            accountName: z.ZodNullable<z.ZodString>;
            playerName: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
        confidence: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        score: z.ZodNumber;
        matchedOn: z.ZodArray<z.ZodString>;
        notes: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    failures: z.ZodArray<z.ZodObject<{
        savePlayerFileName: z.ZodString;
        savePlayerSaveId: z.ZodString;
        status: z.ZodEnum<{
            skipped: "skipped";
            no_match: "no_match";
            input_error: "input_error";
        }>;
        message: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PalworldIdentityLinksResponse = z.infer<typeof palworldIdentityLinksResponseSchema>;
export declare const palworldIdentityLinkReviewResponseSchema: z.ZodObject<{
    candidate: z.ZodNullable<z.ZodObject<{
        serverId: z.ZodString;
        savePlayerFileName: z.ZodString;
        savePlayerSaveId: z.ZodString;
        telemetryLookupKey: z.ZodNullable<z.ZodString>;
        candidate: z.ZodObject<{
            playerId: z.ZodNullable<z.ZodString>;
            userId: z.ZodNullable<z.ZodString>;
            accountName: z.ZodNullable<z.ZodString>;
            playerName: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
        confidence: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        score: z.ZodNumber;
        matchedOn: z.ZodArray<z.ZodString>;
        notes: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    failures: z.ZodArray<z.ZodObject<{
        savePlayerFileName: z.ZodString;
        savePlayerSaveId: z.ZodString;
        status: z.ZodEnum<{
            skipped: "skipped";
            no_match: "no_match";
            input_error: "input_error";
        }>;
        message: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PalworldIdentityLinkReviewResponse = z.infer<typeof palworldIdentityLinkReviewResponseSchema>;
export declare const palworldApprovedIdentitySchema: z.ZodObject<{
    state: z.ZodLiteral<"approved">;
    serverId: z.ZodString;
    savePlayerSaveId: z.ZodString;
    savePlayerFileName: z.ZodString;
    telemetryLookupKey: z.ZodNullable<z.ZodString>;
    playerId: z.ZodNullable<z.ZodString>;
    userId: z.ZodNullable<z.ZodString>;
    accountName: z.ZodNullable<z.ZodString>;
    playerName: z.ZodNullable<z.ZodString>;
    approvedAt: z.ZodString;
    approvedBy: z.ZodString;
    notes: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type PalworldApprovedIdentity = z.infer<typeof palworldApprovedIdentitySchema>;
export declare const palworldRejectedIdentitySchema: z.ZodObject<{
    state: z.ZodLiteral<"rejected">;
    serverId: z.ZodNullable<z.ZodString>;
    savePlayerSaveId: z.ZodString;
    savePlayerFileName: z.ZodString;
    telemetryLookupKey: z.ZodNullable<z.ZodString>;
    playerId: z.ZodNullable<z.ZodString>;
    userId: z.ZodNullable<z.ZodString>;
    accountName: z.ZodNullable<z.ZodString>;
    playerName: z.ZodNullable<z.ZodString>;
    rejectedAt: z.ZodString;
    rejectedBy: z.ZodString;
    notes: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type PalworldRejectedIdentity = z.infer<typeof palworldRejectedIdentitySchema>;
export declare const palworldIdentityApprovalsResponseSchema: z.ZodObject<{
    approvals: z.ZodArray<z.ZodObject<{
        state: z.ZodLiteral<"approved">;
        serverId: z.ZodString;
        savePlayerSaveId: z.ZodString;
        savePlayerFileName: z.ZodString;
        telemetryLookupKey: z.ZodNullable<z.ZodString>;
        playerId: z.ZodNullable<z.ZodString>;
        userId: z.ZodNullable<z.ZodString>;
        accountName: z.ZodNullable<z.ZodString>;
        playerName: z.ZodNullable<z.ZodString>;
        approvedAt: z.ZodString;
        approvedBy: z.ZodString;
        notes: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
    rejections: z.ZodArray<z.ZodObject<{
        state: z.ZodLiteral<"rejected">;
        serverId: z.ZodNullable<z.ZodString>;
        savePlayerSaveId: z.ZodString;
        savePlayerFileName: z.ZodString;
        telemetryLookupKey: z.ZodNullable<z.ZodString>;
        playerId: z.ZodNullable<z.ZodString>;
        userId: z.ZodNullable<z.ZodString>;
        accountName: z.ZodNullable<z.ZodString>;
        playerName: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodString;
        rejectedBy: z.ZodString;
        notes: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PalworldIdentityApprovalsResponse = z.infer<typeof palworldIdentityApprovalsResponseSchema>;
export declare const palworldIdentityApprovalActionSchema: z.ZodObject<{
    savePlayerKey: z.ZodString;
    reviewedBy: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PalworldIdentityApprovalAction = z.infer<typeof palworldIdentityApprovalActionSchema>;
export declare const palworldManualIdentityLinkActionSchema: z.ZodObject<{
    serverId: z.ZodString;
    savePlayerSaveId: z.ZodString;
    savePlayerFileName: z.ZodOptional<z.ZodString>;
    telemetryLookupKey: z.ZodOptional<z.ZodString>;
    playerId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    accountName: z.ZodOptional<z.ZodString>;
    playerName: z.ZodOptional<z.ZodString>;
    reviewedBy: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PalworldManualIdentityLinkAction = z.infer<typeof palworldManualIdentityLinkActionSchema>;
export declare const palworldIdentityReviewStateSchema: z.ZodEnum<{
    approved: "approved";
    rejected: "rejected";
    unresolved: "unresolved";
}>;
export type PalworldIdentityReviewState = z.infer<typeof palworldIdentityReviewStateSchema>;
export declare const palworldPlayerSaveArtifactSchema: z.ZodObject<{
    present: z.ZodBoolean;
    path: z.ZodNullable<z.ZodString>;
    modifiedAt: z.ZodNullable<z.ZodString>;
    sizeBytes: z.ZodNullable<z.ZodNumber>;
    parseStatus: z.ZodNullable<z.ZodString>;
    savePlayerSaveId: z.ZodNullable<z.ZodString>;
    savePlayerFileName: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type PalworldPlayerSaveArtifact = z.infer<typeof palworldPlayerSaveArtifactSchema>;
export declare const palworldPlayerReviewMetadataSchema: z.ZodObject<{
    state: z.ZodEnum<{
        approved: "approved";
        rejected: "rejected";
        unresolved: "unresolved";
    }>;
    savePlayerSaveId: z.ZodNullable<z.ZodString>;
    savePlayerFileName: z.ZodNullable<z.ZodString>;
    telemetryLookupKey: z.ZodNullable<z.ZodString>;
    reviewedAt: z.ZodNullable<z.ZodString>;
    reviewedBy: z.ZodNullable<z.ZodString>;
    notes: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type PalworldPlayerReviewMetadata = z.infer<typeof palworldPlayerReviewMetadataSchema>;
export declare const palworldSessionTierSchema: z.ZodEnum<{
    short: "short";
    active: "active";
    grinding: "grinding";
    marathon: "marathon";
}>;
export type PalworldSessionTier = z.infer<typeof palworldSessionTierSchema>;
export declare const palworldLevelTierSchema: z.ZodEnum<{
    high: "high";
    new: "new";
    mid: "mid";
    elite: "elite";
}>;
export type PalworldLevelTier = z.infer<typeof palworldLevelTierSchema>;
export declare const palworldMilestoneSignalKeySchema: z.ZodEnum<{
    entered_elite_level_tier: "entered_elite_level_tier";
    reached_marathon_session_tier: "reached_marathon_session_tier";
    top_online_level: "top_online_level";
    top_online_session_duration: "top_online_session_duration";
}>;
export type PalworldMilestoneSignalKey = z.infer<typeof palworldMilestoneSignalKeySchema>;
export declare const palworldMilestoneSignalStrengthSchema: z.ZodEnum<{
    verified: "verified";
    provisional: "provisional";
}>;
export type PalworldMilestoneSignalStrength = z.infer<typeof palworldMilestoneSignalStrengthSchema>;
export declare const palworldMilestoneSignalSchema: z.ZodObject<{
    key: z.ZodEnum<{
        entered_elite_level_tier: "entered_elite_level_tier";
        reached_marathon_session_tier: "reached_marathon_session_tier";
        top_online_level: "top_online_level";
        top_online_session_duration: "top_online_session_duration";
    }>;
    label: z.ZodString;
    reason: z.ZodString;
    strength: z.ZodEnum<{
        verified: "verified";
        provisional: "provisional";
    }>;
}, z.core.$strip>;
export type PalworldMilestoneSignal = z.infer<typeof palworldMilestoneSignalSchema>;
export declare const palworldMilestoneFeedEntrySchema: z.ZodObject<{
    serverId: z.ZodString;
    playerId: z.ZodString;
    playerName: z.ZodNullable<z.ZodString>;
    accountName: z.ZodNullable<z.ZodString>;
    identityState: z.ZodEnum<{
        approved: "approved";
        rejected: "rejected";
        unresolved: "unresolved";
    }>;
    signalKey: z.ZodEnum<{
        entered_elite_level_tier: "entered_elite_level_tier";
        reached_marathon_session_tier: "reached_marathon_session_tier";
        top_online_level: "top_online_level";
        top_online_session_duration: "top_online_session_duration";
    }>;
    signalLabel: z.ZodString;
    signalReason: z.ZodString;
    signalStrength: z.ZodEnum<{
        verified: "verified";
        provisional: "provisional";
    }>;
    level: z.ZodNullable<z.ZodNumber>;
    sessionTier: z.ZodNullable<z.ZodEnum<{
        short: "short";
        active: "active";
        grinding: "grinding";
        marathon: "marathon";
    }>>;
    levelTier: z.ZodNullable<z.ZodEnum<{
        high: "high";
        new: "new";
        mid: "mid";
        elite: "elite";
    }>>;
}, z.core.$strip>;
export type PalworldMilestoneFeedEntry = z.infer<typeof palworldMilestoneFeedEntrySchema>;
export declare const palworldMilestoneFeedResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    milestones: z.ZodArray<z.ZodObject<{
        serverId: z.ZodString;
        playerId: z.ZodString;
        playerName: z.ZodNullable<z.ZodString>;
        accountName: z.ZodNullable<z.ZodString>;
        identityState: z.ZodEnum<{
            approved: "approved";
            rejected: "rejected";
            unresolved: "unresolved";
        }>;
        signalKey: z.ZodEnum<{
            entered_elite_level_tier: "entered_elite_level_tier";
            reached_marathon_session_tier: "reached_marathon_session_tier";
            top_online_level: "top_online_level";
            top_online_session_duration: "top_online_session_duration";
        }>;
        signalLabel: z.ZodString;
        signalReason: z.ZodString;
        signalStrength: z.ZodEnum<{
            verified: "verified";
            provisional: "provisional";
        }>;
        level: z.ZodNullable<z.ZodNumber>;
        sessionTier: z.ZodNullable<z.ZodEnum<{
            short: "short";
            active: "active";
            grinding: "grinding";
            marathon: "marathon";
        }>>;
        levelTier: z.ZodNullable<z.ZodEnum<{
            high: "high";
            new: "new";
            mid: "mid";
            elite: "elite";
        }>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PalworldMilestoneFeedResponse = z.infer<typeof palworldMilestoneFeedResponseSchema>;
export declare const palworldTransitionMilestoneEventTypeSchema: z.ZodEnum<{
    PALWORLD_LEVEL_TIER_ENTERED: "PALWORLD_LEVEL_TIER_ENTERED";
    PALWORLD_SESSION_TIER_ENTERED: "PALWORLD_SESSION_TIER_ENTERED";
    PALWORLD_IDENTITY_APPROVED: "PALWORLD_IDENTITY_APPROVED";
}>;
export type PalworldTransitionMilestoneEventType = z.infer<typeof palworldTransitionMilestoneEventTypeSchema>;
export declare const palworldTransitionMilestoneEventSchema: z.ZodObject<{
    serverId: z.ZodString;
    playerId: z.ZodString;
    playerName: z.ZodNullable<z.ZodString>;
    accountName: z.ZodNullable<z.ZodString>;
    eventType: z.ZodEnum<{
        PALWORLD_LEVEL_TIER_ENTERED: "PALWORLD_LEVEL_TIER_ENTERED";
        PALWORLD_SESSION_TIER_ENTERED: "PALWORLD_SESSION_TIER_ENTERED";
        PALWORLD_IDENTITY_APPROVED: "PALWORLD_IDENTITY_APPROVED";
    }>;
    occurredAt: z.ZodString;
    identityState: z.ZodEnum<{
        approved: "approved";
        rejected: "rejected";
        unresolved: "unresolved";
    }>;
    level: z.ZodNullable<z.ZodNumber>;
    levelTier: z.ZodNullable<z.ZodEnum<{
        high: "high";
        new: "new";
        mid: "mid";
        elite: "elite";
    }>>;
    sessionTier: z.ZodNullable<z.ZodEnum<{
        short: "short";
        active: "active";
        grinding: "grinding";
        marathon: "marathon";
    }>>;
    activeSessionKey: z.ZodNullable<z.ZodString>;
    fromValue: z.ZodNullable<z.ZodString>;
    toValue: z.ZodNullable<z.ZodString>;
    reason: z.ZodString;
    previewMessage: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type PalworldTransitionMilestoneEvent = z.infer<typeof palworldTransitionMilestoneEventSchema>;
export declare const palworldTransitionMilestoneEventsResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    events: z.ZodArray<z.ZodObject<{
        serverId: z.ZodString;
        playerId: z.ZodString;
        playerName: z.ZodNullable<z.ZodString>;
        accountName: z.ZodNullable<z.ZodString>;
        eventType: z.ZodEnum<{
            PALWORLD_LEVEL_TIER_ENTERED: "PALWORLD_LEVEL_TIER_ENTERED";
            PALWORLD_SESSION_TIER_ENTERED: "PALWORLD_SESSION_TIER_ENTERED";
            PALWORLD_IDENTITY_APPROVED: "PALWORLD_IDENTITY_APPROVED";
        }>;
        occurredAt: z.ZodString;
        identityState: z.ZodEnum<{
            approved: "approved";
            rejected: "rejected";
            unresolved: "unresolved";
        }>;
        level: z.ZodNullable<z.ZodNumber>;
        levelTier: z.ZodNullable<z.ZodEnum<{
            high: "high";
            new: "new";
            mid: "mid";
            elite: "elite";
        }>>;
        sessionTier: z.ZodNullable<z.ZodEnum<{
            short: "short";
            active: "active";
            grinding: "grinding";
            marathon: "marathon";
        }>>;
        activeSessionKey: z.ZodNullable<z.ZodString>;
        fromValue: z.ZodNullable<z.ZodString>;
        toValue: z.ZodNullable<z.ZodString>;
        reason: z.ZodString;
        previewMessage: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PalworldTransitionMilestoneEventsResponse = z.infer<typeof palworldTransitionMilestoneEventsResponseSchema>;
export declare const palworldManualTransitionPostActionSchema: z.ZodObject<{
    serverId: z.ZodString;
    playerId: z.ZodString;
    eventType: z.ZodEnum<{
        PALWORLD_LEVEL_TIER_ENTERED: "PALWORLD_LEVEL_TIER_ENTERED";
        PALWORLD_SESSION_TIER_ENTERED: "PALWORLD_SESSION_TIER_ENTERED";
        PALWORLD_IDENTITY_APPROVED: "PALWORLD_IDENTITY_APPROVED";
    }>;
    occurredAt: z.ZodString;
    fromValue: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    toValue: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type PalworldManualTransitionPostAction = z.infer<typeof palworldManualTransitionPostActionSchema>;
export declare const palworldManualTransitionPostResponseSchema: z.ZodObject<{
    ok: z.ZodLiteral<true>;
    channelId: z.ZodString;
    messagePreview: z.ZodString;
}, z.core.$strip>;
export type PalworldManualTransitionPostResponse = z.infer<typeof palworldManualTransitionPostResponseSchema>;
export declare const palworldPlayerClassificationSchema: z.ZodEnum<{
    "Core Player": "Core Player";
    "Active Player": "Active Player";
    "New / Light Player": "New / Light Player";
}>;
export type PalworldPlayerClassification = z.infer<typeof palworldPlayerClassificationSchema>;
export declare const palworldPlayerImpactLevelSchema: z.ZodEnum<{
    "High Impact": "High Impact";
    Core: "Core";
    Active: "Active";
    Low: "Low";
}>;
export type PalworldPlayerImpactLevel = z.infer<typeof palworldPlayerImpactLevelSchema>;
export declare const palworldPlayerIntelligenceSchema: z.ZodObject<{
    likelyGuildName: z.ZodNullable<z.ZodString>;
    guildMemberCount: z.ZodNullable<z.ZodNumber>;
    identityState: z.ZodEnum<{
        approved: "approved";
        rejected: "rejected";
        unresolved: "unresolved";
    }>;
    levelTier: z.ZodNullable<z.ZodEnum<{
        high: "high";
        new: "new";
        mid: "mid";
        elite: "elite";
    }>>;
    sessionTier: z.ZodNullable<z.ZodEnum<{
        short: "short";
        active: "active";
        grinding: "grinding";
        marathon: "marathon";
    }>>;
    engagementScore: z.ZodNumber;
    classification: z.ZodEnum<{
        "Core Player": "Core Player";
        "Active Player": "Active Player";
        "New / Light Player": "New / Light Player";
    }>;
    impactLevel: z.ZodEnum<{
        "High Impact": "High Impact";
        Core: "Core";
        Active: "Active";
        Low: "Low";
    }>;
}, z.core.$strip>;
export type PalworldPlayerIntelligence = z.infer<typeof palworldPlayerIntelligenceSchema>;
export declare const palworldUnifiedPlayerProfileSchema: z.ZodObject<{
    serverId: z.ZodString;
    playerId: z.ZodString;
    lookupKey: z.ZodNullable<z.ZodString>;
    playerName: z.ZodNullable<z.ZodString>;
    accountName: z.ZodNullable<z.ZodString>;
    userId: z.ZodNullable<z.ZodString>;
    level: z.ZodNullable<z.ZodNumber>;
    ping: z.ZodNullable<z.ZodNumber>;
    locationX: z.ZodNullable<z.ZodNumber>;
    locationY: z.ZodNullable<z.ZodNumber>;
    region: z.ZodNullable<z.ZodString>;
    firstSeenAt: z.ZodNullable<z.ZodString>;
    lastSeenAt: z.ZodNullable<z.ZodString>;
    maxLevelSeen: z.ZodNullable<z.ZodNumber>;
    totalSessions: z.ZodNullable<z.ZodNumber>;
    isOnline: z.ZodBoolean;
    avgPing: z.ZodNullable<z.ZodNumber>;
    maxPing: z.ZodNullable<z.ZodNumber>;
    pingStdDev: z.ZodNullable<z.ZodNumber>;
    currentSessionDurationSeconds: z.ZodNullable<z.ZodNumber>;
    sessionTier: z.ZodNullable<z.ZodEnum<{
        short: "short";
        active: "active";
        grinding: "grinding";
        marathon: "marathon";
    }>>;
    levelTier: z.ZodNullable<z.ZodEnum<{
        high: "high";
        new: "new";
        mid: "mid";
        elite: "elite";
    }>>;
    onlineRankByLevel: z.ZodNullable<z.ZodNumber>;
    onlineRankBySessionDuration: z.ZodNullable<z.ZodNumber>;
    milestoneSignals: z.ZodArray<z.ZodObject<{
        key: z.ZodEnum<{
            entered_elite_level_tier: "entered_elite_level_tier";
            reached_marathon_session_tier: "reached_marathon_session_tier";
            top_online_level: "top_online_level";
            top_online_session_duration: "top_online_session_duration";
        }>;
        label: z.ZodString;
        reason: z.ZodString;
        strength: z.ZodEnum<{
            verified: "verified";
            provisional: "provisional";
        }>;
    }, z.core.$strip>>;
    identityState: z.ZodEnum<{
        approved: "approved";
        rejected: "rejected";
        unresolved: "unresolved";
    }>;
    review: z.ZodObject<{
        state: z.ZodEnum<{
            approved: "approved";
            rejected: "rejected";
            unresolved: "unresolved";
        }>;
        savePlayerSaveId: z.ZodNullable<z.ZodString>;
        savePlayerFileName: z.ZodNullable<z.ZodString>;
        telemetryLookupKey: z.ZodNullable<z.ZodString>;
        reviewedAt: z.ZodNullable<z.ZodString>;
        reviewedBy: z.ZodNullable<z.ZodString>;
        notes: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>;
    saveArtifact: z.ZodObject<{
        present: z.ZodBoolean;
        path: z.ZodNullable<z.ZodString>;
        modifiedAt: z.ZodNullable<z.ZodString>;
        sizeBytes: z.ZodNullable<z.ZodNumber>;
        parseStatus: z.ZodNullable<z.ZodString>;
        savePlayerSaveId: z.ZodNullable<z.ZodString>;
        savePlayerFileName: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    playerIntelligence: z.ZodObject<{
        likelyGuildName: z.ZodNullable<z.ZodString>;
        guildMemberCount: z.ZodNullable<z.ZodNumber>;
        identityState: z.ZodEnum<{
            approved: "approved";
            rejected: "rejected";
            unresolved: "unresolved";
        }>;
        levelTier: z.ZodNullable<z.ZodEnum<{
            high: "high";
            new: "new";
            mid: "mid";
            elite: "elite";
        }>>;
        sessionTier: z.ZodNullable<z.ZodEnum<{
            short: "short";
            active: "active";
            grinding: "grinding";
            marathon: "marathon";
        }>>;
        engagementScore: z.ZodNumber;
        classification: z.ZodEnum<{
            "Core Player": "Core Player";
            "Active Player": "Active Player";
            "New / Light Player": "New / Light Player";
        }>;
        impactLevel: z.ZodEnum<{
            "High Impact": "High Impact";
            Core: "Core";
            Active: "Active";
            Low: "Low";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type PalworldUnifiedPlayerProfile = z.infer<typeof palworldUnifiedPlayerProfileSchema>;
export declare const palworldPlayerProfileSessionSummarySchema: z.ZodObject<{
    serverId: z.ZodString;
    playerId: z.ZodString;
    lookupKey: z.ZodNullable<z.ZodString>;
    playerName: z.ZodNullable<z.ZodString>;
    accountName: z.ZodNullable<z.ZodString>;
    isOnline: z.ZodBoolean;
    activeSessionStartedAt: z.ZodNullable<z.ZodString>;
    currentSessionDurationSeconds: z.ZodNullable<z.ZodNumber>;
    recentTrackedSeconds: z.ZodNumber;
    trackedSeconds24h: z.ZodNumber;
    trackedSeconds7d: z.ZodNumber;
    trackedSeconds30d: z.ZodNumber;
    lastSessionDurationSeconds: z.ZodNullable<z.ZodNumber>;
    lastSessionEndedAt: z.ZodNullable<z.ZodString>;
    recentSessions: z.ZodArray<z.ZodObject<{
        serverId: z.ZodString;
        playerName: z.ZodString;
        startedAt: z.ZodString;
        endedAt: z.ZodOptional<z.ZodString>;
        durationSeconds: z.ZodOptional<z.ZodNumber>;
        closeReason: z.ZodOptional<z.ZodString>;
        startConfidence: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>>;
        endConfidence: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>>;
        sourceEventIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    saveArtifact: z.ZodObject<{
        present: z.ZodBoolean;
        path: z.ZodNullable<z.ZodString>;
        modifiedAt: z.ZodNullable<z.ZodString>;
        sizeBytes: z.ZodNullable<z.ZodNumber>;
        parseStatus: z.ZodNullable<z.ZodString>;
        savePlayerSaveId: z.ZodNullable<z.ZodString>;
        savePlayerFileName: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    inferredGuildName: z.ZodNullable<z.ZodString>;
    profile: z.ZodObject<{
        serverId: z.ZodString;
        playerId: z.ZodString;
        lookupKey: z.ZodNullable<z.ZodString>;
        playerName: z.ZodNullable<z.ZodString>;
        accountName: z.ZodNullable<z.ZodString>;
        userId: z.ZodNullable<z.ZodString>;
        level: z.ZodNullable<z.ZodNumber>;
        ping: z.ZodNullable<z.ZodNumber>;
        locationX: z.ZodNullable<z.ZodNumber>;
        locationY: z.ZodNullable<z.ZodNumber>;
        region: z.ZodNullable<z.ZodString>;
        firstSeenAt: z.ZodNullable<z.ZodString>;
        lastSeenAt: z.ZodNullable<z.ZodString>;
        maxLevelSeen: z.ZodNullable<z.ZodNumber>;
        totalSessions: z.ZodNullable<z.ZodNumber>;
        isOnline: z.ZodBoolean;
        avgPing: z.ZodNullable<z.ZodNumber>;
        maxPing: z.ZodNullable<z.ZodNumber>;
        pingStdDev: z.ZodNullable<z.ZodNumber>;
        currentSessionDurationSeconds: z.ZodNullable<z.ZodNumber>;
        sessionTier: z.ZodNullable<z.ZodEnum<{
            short: "short";
            active: "active";
            grinding: "grinding";
            marathon: "marathon";
        }>>;
        levelTier: z.ZodNullable<z.ZodEnum<{
            high: "high";
            new: "new";
            mid: "mid";
            elite: "elite";
        }>>;
        onlineRankByLevel: z.ZodNullable<z.ZodNumber>;
        onlineRankBySessionDuration: z.ZodNullable<z.ZodNumber>;
        milestoneSignals: z.ZodArray<z.ZodObject<{
            key: z.ZodEnum<{
                entered_elite_level_tier: "entered_elite_level_tier";
                reached_marathon_session_tier: "reached_marathon_session_tier";
                top_online_level: "top_online_level";
                top_online_session_duration: "top_online_session_duration";
            }>;
            label: z.ZodString;
            reason: z.ZodString;
            strength: z.ZodEnum<{
                verified: "verified";
                provisional: "provisional";
            }>;
        }, z.core.$strip>>;
        identityState: z.ZodEnum<{
            approved: "approved";
            rejected: "rejected";
            unresolved: "unresolved";
        }>;
        review: z.ZodObject<{
            state: z.ZodEnum<{
                approved: "approved";
                rejected: "rejected";
                unresolved: "unresolved";
            }>;
            savePlayerSaveId: z.ZodNullable<z.ZodString>;
            savePlayerFileName: z.ZodNullable<z.ZodString>;
            telemetryLookupKey: z.ZodNullable<z.ZodString>;
            reviewedAt: z.ZodNullable<z.ZodString>;
            reviewedBy: z.ZodNullable<z.ZodString>;
            notes: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>;
        saveArtifact: z.ZodObject<{
            present: z.ZodBoolean;
            path: z.ZodNullable<z.ZodString>;
            modifiedAt: z.ZodNullable<z.ZodString>;
            sizeBytes: z.ZodNullable<z.ZodNumber>;
            parseStatus: z.ZodNullable<z.ZodString>;
            savePlayerSaveId: z.ZodNullable<z.ZodString>;
            savePlayerFileName: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
        playerIntelligence: z.ZodObject<{
            likelyGuildName: z.ZodNullable<z.ZodString>;
            guildMemberCount: z.ZodNullable<z.ZodNumber>;
            identityState: z.ZodEnum<{
                approved: "approved";
                rejected: "rejected";
                unresolved: "unresolved";
            }>;
            levelTier: z.ZodNullable<z.ZodEnum<{
                high: "high";
                new: "new";
                mid: "mid";
                elite: "elite";
            }>>;
            sessionTier: z.ZodNullable<z.ZodEnum<{
                short: "short";
                active: "active";
                grinding: "grinding";
                marathon: "marathon";
            }>>;
            engagementScore: z.ZodNumber;
            classification: z.ZodEnum<{
                "Core Player": "Core Player";
                "Active Player": "Active Player";
                "New / Light Player": "New / Light Player";
            }>;
            impactLevel: z.ZodEnum<{
                "High Impact": "High Impact";
                Core: "Core";
                Active: "Active";
                Low: "Low";
            }>;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type PalworldPlayerProfileSessionSummary = z.infer<typeof palworldPlayerProfileSessionSummarySchema>;
export declare const palworldPlayerProfileSessionSummariesResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    profiles: z.ZodArray<z.ZodObject<{
        serverId: z.ZodString;
        playerId: z.ZodString;
        lookupKey: z.ZodNullable<z.ZodString>;
        playerName: z.ZodNullable<z.ZodString>;
        accountName: z.ZodNullable<z.ZodString>;
        isOnline: z.ZodBoolean;
        activeSessionStartedAt: z.ZodNullable<z.ZodString>;
        currentSessionDurationSeconds: z.ZodNullable<z.ZodNumber>;
        recentTrackedSeconds: z.ZodNumber;
        trackedSeconds24h: z.ZodNumber;
        trackedSeconds7d: z.ZodNumber;
        trackedSeconds30d: z.ZodNumber;
        lastSessionDurationSeconds: z.ZodNullable<z.ZodNumber>;
        lastSessionEndedAt: z.ZodNullable<z.ZodString>;
        recentSessions: z.ZodArray<z.ZodObject<{
            serverId: z.ZodString;
            playerName: z.ZodString;
            startedAt: z.ZodString;
            endedAt: z.ZodOptional<z.ZodString>;
            durationSeconds: z.ZodOptional<z.ZodNumber>;
            closeReason: z.ZodOptional<z.ZodString>;
            startConfidence: z.ZodOptional<z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>>;
            endConfidence: z.ZodOptional<z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>>;
            sourceEventIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        saveArtifact: z.ZodObject<{
            present: z.ZodBoolean;
            path: z.ZodNullable<z.ZodString>;
            modifiedAt: z.ZodNullable<z.ZodString>;
            sizeBytes: z.ZodNullable<z.ZodNumber>;
            parseStatus: z.ZodNullable<z.ZodString>;
            savePlayerSaveId: z.ZodNullable<z.ZodString>;
            savePlayerFileName: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
        inferredGuildName: z.ZodNullable<z.ZodString>;
        profile: z.ZodObject<{
            serverId: z.ZodString;
            playerId: z.ZodString;
            lookupKey: z.ZodNullable<z.ZodString>;
            playerName: z.ZodNullable<z.ZodString>;
            accountName: z.ZodNullable<z.ZodString>;
            userId: z.ZodNullable<z.ZodString>;
            level: z.ZodNullable<z.ZodNumber>;
            ping: z.ZodNullable<z.ZodNumber>;
            locationX: z.ZodNullable<z.ZodNumber>;
            locationY: z.ZodNullable<z.ZodNumber>;
            region: z.ZodNullable<z.ZodString>;
            firstSeenAt: z.ZodNullable<z.ZodString>;
            lastSeenAt: z.ZodNullable<z.ZodString>;
            maxLevelSeen: z.ZodNullable<z.ZodNumber>;
            totalSessions: z.ZodNullable<z.ZodNumber>;
            isOnline: z.ZodBoolean;
            avgPing: z.ZodNullable<z.ZodNumber>;
            maxPing: z.ZodNullable<z.ZodNumber>;
            pingStdDev: z.ZodNullable<z.ZodNumber>;
            currentSessionDurationSeconds: z.ZodNullable<z.ZodNumber>;
            sessionTier: z.ZodNullable<z.ZodEnum<{
                short: "short";
                active: "active";
                grinding: "grinding";
                marathon: "marathon";
            }>>;
            levelTier: z.ZodNullable<z.ZodEnum<{
                high: "high";
                new: "new";
                mid: "mid";
                elite: "elite";
            }>>;
            onlineRankByLevel: z.ZodNullable<z.ZodNumber>;
            onlineRankBySessionDuration: z.ZodNullable<z.ZodNumber>;
            milestoneSignals: z.ZodArray<z.ZodObject<{
                key: z.ZodEnum<{
                    entered_elite_level_tier: "entered_elite_level_tier";
                    reached_marathon_session_tier: "reached_marathon_session_tier";
                    top_online_level: "top_online_level";
                    top_online_session_duration: "top_online_session_duration";
                }>;
                label: z.ZodString;
                reason: z.ZodString;
                strength: z.ZodEnum<{
                    verified: "verified";
                    provisional: "provisional";
                }>;
            }, z.core.$strip>>;
            identityState: z.ZodEnum<{
                approved: "approved";
                rejected: "rejected";
                unresolved: "unresolved";
            }>;
            review: z.ZodObject<{
                state: z.ZodEnum<{
                    approved: "approved";
                    rejected: "rejected";
                    unresolved: "unresolved";
                }>;
                savePlayerSaveId: z.ZodNullable<z.ZodString>;
                savePlayerFileName: z.ZodNullable<z.ZodString>;
                telemetryLookupKey: z.ZodNullable<z.ZodString>;
                reviewedAt: z.ZodNullable<z.ZodString>;
                reviewedBy: z.ZodNullable<z.ZodString>;
                notes: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>;
            saveArtifact: z.ZodObject<{
                present: z.ZodBoolean;
                path: z.ZodNullable<z.ZodString>;
                modifiedAt: z.ZodNullable<z.ZodString>;
                sizeBytes: z.ZodNullable<z.ZodNumber>;
                parseStatus: z.ZodNullable<z.ZodString>;
                savePlayerSaveId: z.ZodNullable<z.ZodString>;
                savePlayerFileName: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>;
            playerIntelligence: z.ZodObject<{
                likelyGuildName: z.ZodNullable<z.ZodString>;
                guildMemberCount: z.ZodNullable<z.ZodNumber>;
                identityState: z.ZodEnum<{
                    approved: "approved";
                    rejected: "rejected";
                    unresolved: "unresolved";
                }>;
                levelTier: z.ZodNullable<z.ZodEnum<{
                    high: "high";
                    new: "new";
                    mid: "mid";
                    elite: "elite";
                }>>;
                sessionTier: z.ZodNullable<z.ZodEnum<{
                    short: "short";
                    active: "active";
                    grinding: "grinding";
                    marathon: "marathon";
                }>>;
                engagementScore: z.ZodNumber;
                classification: z.ZodEnum<{
                    "Core Player": "Core Player";
                    "Active Player": "Active Player";
                    "New / Light Player": "New / Light Player";
                }>;
                impactLevel: z.ZodEnum<{
                    "High Impact": "High Impact";
                    Core: "Core";
                    Active: "Active";
                    Low: "Low";
                }>;
            }, z.core.$strip>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PalworldPlayerProfileSessionSummariesResponse = z.infer<typeof palworldPlayerProfileSessionSummariesResponseSchema>;
export declare const palworldGuildActivityRiskLevelSchema: z.ZodEnum<{
    unknown: "unknown";
    active: "active";
    watch: "watch";
    risk: "risk";
    expired: "expired";
}>;
export type PalworldGuildActivityRiskLevel = z.infer<typeof palworldGuildActivityRiskLevelSchema>;
export declare const palworldGuildActivityMemberSchema: z.ZodObject<{
    memberName: z.ZodString;
    matched: z.ZodBoolean;
    status: z.ZodOptional<z.ZodEnum<{
        never_seen: "never_seen";
    }>>;
    matchedPlayerName: z.ZodNullable<z.ZodString>;
    lastSeenAt: z.ZodNullable<z.ZodString>;
    daysSinceSeen: z.ZodNullable<z.ZodNumber>;
    level: z.ZodNullable<z.ZodNumber>;
    saveLinked: z.ZodNullable<z.ZodBoolean>;
}, z.core.$strip>;
export type PalworldGuildActivityMember = z.infer<typeof palworldGuildActivityMemberSchema>;
export declare const palworldGuildActivityEntrySchema: z.ZodObject<{
    guildName: z.ZodString;
    memberCount: z.ZodNumber;
    members: z.ZodArray<z.ZodObject<{
        memberName: z.ZodString;
        matched: z.ZodBoolean;
        status: z.ZodOptional<z.ZodEnum<{
            never_seen: "never_seen";
        }>>;
        matchedPlayerName: z.ZodNullable<z.ZodString>;
        lastSeenAt: z.ZodNullable<z.ZodString>;
        daysSinceSeen: z.ZodNullable<z.ZodNumber>;
        level: z.ZodNullable<z.ZodNumber>;
        saveLinked: z.ZodNullable<z.ZodBoolean>;
    }, z.core.$strip>>;
    lastMemberSeenAt: z.ZodNullable<z.ZodString>;
    lastSeenMemberName: z.ZodNullable<z.ZodString>;
    daysInactive: z.ZodNullable<z.ZodNumber>;
    daysUntilPalboxRisk: z.ZodNullable<z.ZodNumber>;
    riskLevel: z.ZodEnum<{
        unknown: "unknown";
        active: "active";
        watch: "watch";
        risk: "risk";
        expired: "expired";
    }>;
}, z.core.$strip>;
export type PalworldGuildActivityEntry = z.infer<typeof palworldGuildActivityEntrySchema>;
export declare const palworldGuildActivityResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    guilds: z.ZodArray<z.ZodObject<{
        guildName: z.ZodString;
        memberCount: z.ZodNumber;
        members: z.ZodArray<z.ZodObject<{
            memberName: z.ZodString;
            matched: z.ZodBoolean;
            status: z.ZodOptional<z.ZodEnum<{
                never_seen: "never_seen";
            }>>;
            matchedPlayerName: z.ZodNullable<z.ZodString>;
            lastSeenAt: z.ZodNullable<z.ZodString>;
            daysSinceSeen: z.ZodNullable<z.ZodNumber>;
            level: z.ZodNullable<z.ZodNumber>;
            saveLinked: z.ZodNullable<z.ZodBoolean>;
        }, z.core.$strip>>;
        lastMemberSeenAt: z.ZodNullable<z.ZodString>;
        lastSeenMemberName: z.ZodNullable<z.ZodString>;
        daysInactive: z.ZodNullable<z.ZodNumber>;
        daysUntilPalboxRisk: z.ZodNullable<z.ZodNumber>;
        riskLevel: z.ZodEnum<{
            unknown: "unknown";
            active: "active";
            watch: "watch";
            risk: "risk";
            expired: "expired";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PalworldGuildActivityResponse = z.infer<typeof palworldGuildActivityResponseSchema>;
declare const workspaceConfigSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    workspaceName: z.ZodString;
    ownerName: z.ZodString;
    hostingMode: z.ZodEnum<{
        self_hosted: "self_hosted";
        hybrid: "hybrid";
        hosted_limited: "hosted_limited";
    }>;
    timezone: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
declare const apiConfigSchema: z.ZodObject<{
    baseUrl: z.ZodString;
    port: z.ZodDefault<z.ZodNumber>;
    corsOrigin: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const discordConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    applicationId: z.ZodOptional<z.ZodString>;
    guildId: z.ZodOptional<z.ZodString>;
    botTokenEnvVar: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
declare const serverConfigSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    id: z.ZodString;
    displayName: z.ZodString;
    enabled: z.ZodDefault<z.ZodBoolean>;
    game: z.ZodLiteral<"valheim">;
    connector: z.ZodDiscriminatedUnion<[z.ZodObject<{
        pollIntervalMs: z.ZodDefault<z.ZodNumber>;
        journalServiceName: z.ZodOptional<z.ZodString>;
        restHost: z.ZodOptional<z.ZodString>;
        restPort: z.ZodOptional<z.ZodNumber>;
        restUsername: z.ZodOptional<z.ZodString>;
        restPassword: z.ZodOptional<z.ZodString>;
        restPath: z.ZodOptional<z.ZodString>;
        rconHost: z.ZodOptional<z.ZodString>;
        rconPort: z.ZodOptional<z.ZodNumber>;
        rconPassword: z.ZodOptional<z.ZodString>;
        queryPort: z.ZodOptional<z.ZodNumber>;
        savePath: z.ZodOptional<z.ZodString>;
        mode: z.ZodLiteral<"file">;
        logPath: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        pollIntervalMs: z.ZodDefault<z.ZodNumber>;
        logPath: z.ZodOptional<z.ZodString>;
        restHost: z.ZodOptional<z.ZodString>;
        restPort: z.ZodOptional<z.ZodNumber>;
        restUsername: z.ZodOptional<z.ZodString>;
        restPassword: z.ZodOptional<z.ZodString>;
        restPath: z.ZodOptional<z.ZodString>;
        rconHost: z.ZodOptional<z.ZodString>;
        rconPort: z.ZodOptional<z.ZodNumber>;
        rconPassword: z.ZodOptional<z.ZodString>;
        queryPort: z.ZodOptional<z.ZodNumber>;
        savePath: z.ZodOptional<z.ZodString>;
        mode: z.ZodLiteral<"journal">;
        journalServiceName: z.ZodString;
    }, z.core.$strip>], "mode">;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    displayName: z.ZodString;
    enabled: z.ZodDefault<z.ZodBoolean>;
    game: z.ZodLiteral<"palworld">;
    connector: z.ZodDiscriminatedUnion<[z.ZodObject<{
        pollIntervalMs: z.ZodDefault<z.ZodNumber>;
        logPath: z.ZodOptional<z.ZodString>;
        journalServiceName: z.ZodOptional<z.ZodString>;
        rconHost: z.ZodOptional<z.ZodString>;
        rconPort: z.ZodOptional<z.ZodNumber>;
        rconPassword: z.ZodOptional<z.ZodString>;
        queryPort: z.ZodOptional<z.ZodNumber>;
        savePath: z.ZodOptional<z.ZodString>;
        mode: z.ZodLiteral<"rest">;
        restHost: z.ZodString;
        restPort: z.ZodNumber;
        restUsername: z.ZodDefault<z.ZodString>;
        restPassword: z.ZodString;
        restPath: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        pollIntervalMs: z.ZodDefault<z.ZodNumber>;
        logPath: z.ZodOptional<z.ZodString>;
        journalServiceName: z.ZodOptional<z.ZodString>;
        restHost: z.ZodOptional<z.ZodString>;
        restPort: z.ZodOptional<z.ZodNumber>;
        restUsername: z.ZodOptional<z.ZodString>;
        restPassword: z.ZodOptional<z.ZodString>;
        restPath: z.ZodOptional<z.ZodString>;
        queryPort: z.ZodOptional<z.ZodNumber>;
        savePath: z.ZodOptional<z.ZodString>;
        mode: z.ZodLiteral<"rcon">;
        rconHost: z.ZodString;
        rconPort: z.ZodNumber;
        rconPassword: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        pollIntervalMs: z.ZodDefault<z.ZodNumber>;
        logPath: z.ZodOptional<z.ZodString>;
        journalServiceName: z.ZodOptional<z.ZodString>;
        restHost: z.ZodOptional<z.ZodString>;
        restPort: z.ZodOptional<z.ZodNumber>;
        restUsername: z.ZodOptional<z.ZodString>;
        restPassword: z.ZodOptional<z.ZodString>;
        restPath: z.ZodOptional<z.ZodString>;
        rconPort: z.ZodOptional<z.ZodNumber>;
        rconPassword: z.ZodOptional<z.ZodString>;
        savePath: z.ZodOptional<z.ZodString>;
        mode: z.ZodLiteral<"query">;
        rconHost: z.ZodString;
        queryPort: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        pollIntervalMs: z.ZodDefault<z.ZodNumber>;
        journalServiceName: z.ZodOptional<z.ZodString>;
        restHost: z.ZodOptional<z.ZodString>;
        restPort: z.ZodOptional<z.ZodNumber>;
        restUsername: z.ZodOptional<z.ZodString>;
        restPassword: z.ZodOptional<z.ZodString>;
        restPath: z.ZodOptional<z.ZodString>;
        rconHost: z.ZodOptional<z.ZodString>;
        rconPort: z.ZodOptional<z.ZodNumber>;
        rconPassword: z.ZodOptional<z.ZodString>;
        queryPort: z.ZodOptional<z.ZodNumber>;
        savePath: z.ZodOptional<z.ZodString>;
        mode: z.ZodLiteral<"file">;
        logPath: z.ZodString;
    }, z.core.$strip>], "mode">;
}, z.core.$strip>], "game">;
export declare const featureFlagsSchema: z.ZodObject<{
    dashboardEnabled: z.ZodDefault<z.ZodBoolean>;
    botEnabled: z.ZodDefault<z.ZodBoolean>;
    connectorEnabled: z.ZodDefault<z.ZodBoolean>;
    identityResolutionEnabled: z.ZodDefault<z.ZodBoolean>;
    sessionReconciliationEnabled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$catchall<z.ZodBoolean>>;
export declare const gameOpsConfigSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    workspace: z.ZodObject<{
        workspaceId: z.ZodString;
        workspaceName: z.ZodString;
        ownerName: z.ZodString;
        hostingMode: z.ZodEnum<{
            self_hosted: "self_hosted";
            hybrid: "hybrid";
            hosted_limited: "hosted_limited";
        }>;
        timezone: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>;
    api: z.ZodObject<{
        baseUrl: z.ZodString;
        port: z.ZodDefault<z.ZodNumber>;
        corsOrigin: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    discord: z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        applicationId: z.ZodOptional<z.ZodString>;
        guildId: z.ZodOptional<z.ZodString>;
        botTokenEnvVar: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>;
    servers: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
        game: z.ZodLiteral<"valheim">;
        connector: z.ZodDiscriminatedUnion<[z.ZodObject<{
            pollIntervalMs: z.ZodDefault<z.ZodNumber>;
            journalServiceName: z.ZodOptional<z.ZodString>;
            restHost: z.ZodOptional<z.ZodString>;
            restPort: z.ZodOptional<z.ZodNumber>;
            restUsername: z.ZodOptional<z.ZodString>;
            restPassword: z.ZodOptional<z.ZodString>;
            restPath: z.ZodOptional<z.ZodString>;
            rconHost: z.ZodOptional<z.ZodString>;
            rconPort: z.ZodOptional<z.ZodNumber>;
            rconPassword: z.ZodOptional<z.ZodString>;
            queryPort: z.ZodOptional<z.ZodNumber>;
            savePath: z.ZodOptional<z.ZodString>;
            mode: z.ZodLiteral<"file">;
            logPath: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            pollIntervalMs: z.ZodDefault<z.ZodNumber>;
            logPath: z.ZodOptional<z.ZodString>;
            restHost: z.ZodOptional<z.ZodString>;
            restPort: z.ZodOptional<z.ZodNumber>;
            restUsername: z.ZodOptional<z.ZodString>;
            restPassword: z.ZodOptional<z.ZodString>;
            restPath: z.ZodOptional<z.ZodString>;
            rconHost: z.ZodOptional<z.ZodString>;
            rconPort: z.ZodOptional<z.ZodNumber>;
            rconPassword: z.ZodOptional<z.ZodString>;
            queryPort: z.ZodOptional<z.ZodNumber>;
            savePath: z.ZodOptional<z.ZodString>;
            mode: z.ZodLiteral<"journal">;
            journalServiceName: z.ZodString;
        }, z.core.$strip>], "mode">;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
        game: z.ZodLiteral<"palworld">;
        connector: z.ZodDiscriminatedUnion<[z.ZodObject<{
            pollIntervalMs: z.ZodDefault<z.ZodNumber>;
            logPath: z.ZodOptional<z.ZodString>;
            journalServiceName: z.ZodOptional<z.ZodString>;
            rconHost: z.ZodOptional<z.ZodString>;
            rconPort: z.ZodOptional<z.ZodNumber>;
            rconPassword: z.ZodOptional<z.ZodString>;
            queryPort: z.ZodOptional<z.ZodNumber>;
            savePath: z.ZodOptional<z.ZodString>;
            mode: z.ZodLiteral<"rest">;
            restHost: z.ZodString;
            restPort: z.ZodNumber;
            restUsername: z.ZodDefault<z.ZodString>;
            restPassword: z.ZodString;
            restPath: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            pollIntervalMs: z.ZodDefault<z.ZodNumber>;
            logPath: z.ZodOptional<z.ZodString>;
            journalServiceName: z.ZodOptional<z.ZodString>;
            restHost: z.ZodOptional<z.ZodString>;
            restPort: z.ZodOptional<z.ZodNumber>;
            restUsername: z.ZodOptional<z.ZodString>;
            restPassword: z.ZodOptional<z.ZodString>;
            restPath: z.ZodOptional<z.ZodString>;
            queryPort: z.ZodOptional<z.ZodNumber>;
            savePath: z.ZodOptional<z.ZodString>;
            mode: z.ZodLiteral<"rcon">;
            rconHost: z.ZodString;
            rconPort: z.ZodNumber;
            rconPassword: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            pollIntervalMs: z.ZodDefault<z.ZodNumber>;
            logPath: z.ZodOptional<z.ZodString>;
            journalServiceName: z.ZodOptional<z.ZodString>;
            restHost: z.ZodOptional<z.ZodString>;
            restPort: z.ZodOptional<z.ZodNumber>;
            restUsername: z.ZodOptional<z.ZodString>;
            restPassword: z.ZodOptional<z.ZodString>;
            restPath: z.ZodOptional<z.ZodString>;
            rconPort: z.ZodOptional<z.ZodNumber>;
            rconPassword: z.ZodOptional<z.ZodString>;
            savePath: z.ZodOptional<z.ZodString>;
            mode: z.ZodLiteral<"query">;
            rconHost: z.ZodString;
            queryPort: z.ZodNumber;
        }, z.core.$strip>, z.ZodObject<{
            pollIntervalMs: z.ZodDefault<z.ZodNumber>;
            journalServiceName: z.ZodOptional<z.ZodString>;
            restHost: z.ZodOptional<z.ZodString>;
            restPort: z.ZodOptional<z.ZodNumber>;
            restUsername: z.ZodOptional<z.ZodString>;
            restPassword: z.ZodOptional<z.ZodString>;
            restPath: z.ZodOptional<z.ZodString>;
            rconHost: z.ZodOptional<z.ZodString>;
            rconPort: z.ZodOptional<z.ZodNumber>;
            rconPassword: z.ZodOptional<z.ZodString>;
            queryPort: z.ZodOptional<z.ZodNumber>;
            savePath: z.ZodOptional<z.ZodString>;
            mode: z.ZodLiteral<"file">;
            logPath: z.ZodString;
        }, z.core.$strip>], "mode">;
    }, z.core.$strip>], "game">>;
    featureFlags: z.ZodObject<{
        dashboardEnabled: z.ZodDefault<z.ZodBoolean>;
        botEnabled: z.ZodDefault<z.ZodBoolean>;
        connectorEnabled: z.ZodDefault<z.ZodBoolean>;
        identityResolutionEnabled: z.ZodDefault<z.ZodBoolean>;
        sessionReconciliationEnabled: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$catchall<z.ZodBoolean>>;
}, z.core.$strip>;
export type WorkspaceConfig = z.infer<typeof workspaceConfigSchema>;
export type ApiConfig = z.infer<typeof apiConfigSchema>;
export type DiscordConfig = z.infer<typeof discordConfigSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type FeatureFlagsConfig = z.infer<typeof featureFlagsSchema>;
export type GameOpsConfig = z.infer<typeof gameOpsConfigSchema>;
export {};
//# sourceMappingURL=index.d.ts.map