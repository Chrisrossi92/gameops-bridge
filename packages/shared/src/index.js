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
export const hostingModeSchema = z.enum(['self_hosted', 'hybrid', 'hosted_limited']);
export const valheimConnectorModeSchema = z.enum(['file', 'journal']);
export const palworldConnectorModeSchema = z.enum(['rest', 'rcon', 'query', 'file']);
export const normalizedEventRawSchema = z.object({
    discordNotify: z.boolean().optional(),
    ownerActionRequired: z.boolean().optional(),
    severity: z.enum(['info', 'warning', 'critical']).optional(),
    sessionCloseReason: z.string().optional(),
    sessionReconciledCount: z.number().int().min(0).optional(),
    sessionClosedPlayers: z.array(z.string()).optional(),
    sessionDurationSeconds: z.number().int().min(0).optional(),
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
export const ingestEventsRequestSchema = z.object({
    events: z.array(normalizedEventSchema).min(1)
});
export const recentEventsResponseSchema = z.object({
    serverId: z.string().min(1),
    events: z.array(normalizedEventSchema)
});
export const identityConfidenceSchema = z.enum(['low', 'medium', 'high']);
export const sessionRecordSchema = z.object({
    serverId: z.string().min(1),
    playerName: z.string().min(1),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional(),
    durationSeconds: z.number().int().min(0).optional(),
    closeReason: z.string().optional(),
    startConfidence: identityConfidenceSchema.optional(),
    endConfidence: identityConfidenceSchema.optional(),
    sourceEventIds: z.array(z.string()).default([])
});
export const activeSessionsResponseSchema = z.object({
    serverId: z.string().min(1),
    sessions: z.array(sessionRecordSchema)
});
export const recentSessionsResponseSchema = z.object({
    serverId: z.string().min(1),
    sessions: z.array(sessionRecordSchema)
});
export const activitySeveritySchema = z.enum(['info', 'warning', 'critical']);
export const activityLogItemSchema = z.object({
    id: z.string().min(1),
    serverId: z.string().min(1),
    timestamp: z.string().datetime(),
    title: z.string().min(1),
    description: z.string().min(1),
    severity: activitySeveritySchema,
    confidence: identityConfidenceSchema,
    explanation: z.string().min(1),
    playerName: z.string().optional(),
    sessionId: z.string().optional(),
    sourceEventIds: z.array(z.string())
});
export const activityLogResponseSchema = z.object({
    serverId: z.string().min(1),
    items: z.array(activityLogItemSchema)
});
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
export const configuredServerSummarySchema = z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    game: gameKeySchema
});
export const configuredServersResponseSchema = z.object({
    servers: z.array(configuredServerSummarySchema)
});
export const palworldLatestPlayerTelemetrySchema = z.object({
    serverId: z.string().min(1),
    lookupKey: z.string().min(1),
    playerName: z.string().optional(),
    accountName: z.string().optional(),
    playerId: z.string().optional(),
    userId: z.string().optional(),
    level: z.number().int().optional(),
    ping: z.number().optional(),
    locationX: z.number().optional(),
    locationY: z.number().optional(),
    region: z.string().optional(),
    firstSeenAt: z.string().datetime(),
    lastSeenAt: z.string().datetime(),
    maxLevelSeen: z.number().int().min(0).optional(),
    totalSessions: z.number().int().min(0),
    isOnline: z.boolean(),
    avgPing: z.number().optional(),
    maxPing: z.number().optional(),
    pingStdDev: z.number().optional(),
    currentSessionDurationSeconds: z.number().int().min(0).optional()
});
export const palworldLatestPlayersResponseSchema = z.object({
    serverId: z.string().min(1),
    players: z.array(palworldLatestPlayerTelemetrySchema)
});
export const palworldPlayerTelemetryProfileResponseSchema = z.object({
    serverId: z.string().min(1),
    player: palworldLatestPlayerTelemetrySchema.nullable()
});
export const palworldPlayerSnapshotSchema = z.object({
    serverId: z.string().min(1),
    observedAt: z.string().datetime(),
    lookupKey: z.string().min(1),
    playerName: z.string().optional(),
    accountName: z.string().optional(),
    playerId: z.string().optional(),
    userId: z.string().optional(),
    level: z.number().int().optional(),
    ping: z.number().optional(),
    locationX: z.number().optional(),
    locationY: z.number().optional(),
    region: z.string().optional(),
    raw: z.unknown()
});
export const palworldPlayerSnapshotsResponseSchema = z.object({
    serverId: z.string().min(1),
    snapshots: z.array(palworldPlayerSnapshotSchema)
});
export const palworldMetricsSummarySchema = z.object({
    serverId: z.string().min(1),
    observedAt: z.string().datetime(),
    currentPlayerCount: z.number().int().min(0).optional(),
    serverFps: z.number().optional(),
    uptimeSeconds: z.number().min(0).optional(),
    averageFps: z.number().optional(),
    worstFrameTimeMs: z.number().optional(),
    currentUptimeHours: z.number().min(0).optional(),
    raw: z.record(z.string(), z.unknown())
});
export const palworldMetricsSummariesResponseSchema = z.object({
    serverId: z.string().min(1),
    metrics: z.array(palworldMetricsSummarySchema)
});
export const palworldHighlightImportanceSchema = z.enum(['high', 'medium', 'low']);
export const palworldHighlightSchema = z.object({
    type: z.string().min(1),
    message: z.string().min(1),
    importance: palworldHighlightImportanceSchema
});
export const palworldHighlightsResponseSchema = z.object({
    serverId: z.string().min(1),
    highlights: z.array(palworldHighlightSchema).max(5)
});
export const palworldIdentityLinkCandidateSchema = z.object({
    serverId: z.string().min(1),
    savePlayerFileName: z.string().min(1),
    savePlayerSaveId: z.string().min(1),
    telemetryLookupKey: z.string().nullable(),
    candidate: z.object({
        playerId: z.string().nullable(),
        userId: z.string().nullable(),
        accountName: z.string().nullable(),
        playerName: z.string().nullable()
    }),
    confidence: identityConfidenceSchema,
    score: z.number(),
    matchedOn: z.array(z.string()),
    notes: z.array(z.string())
});
export const palworldIdentityLinkFailureSchema = z.object({
    savePlayerFileName: z.string().min(1),
    savePlayerSaveId: z.string().min(1),
    status: z.enum(['skipped', 'no_match', 'input_error']),
    message: z.string().min(1)
});
export const palworldIdentityLinksResponseSchema = z.object({
    generatedAt: z.string().datetime().optional(),
    candidates: z.array(palworldIdentityLinkCandidateSchema),
    failures: z.array(palworldIdentityLinkFailureSchema)
});
export const palworldIdentityLinkReviewResponseSchema = z.object({
    candidate: palworldIdentityLinkCandidateSchema.nullable(),
    failures: z.array(palworldIdentityLinkFailureSchema)
});
export const palworldApprovedIdentitySchema = z.object({
    state: z.literal('approved'),
    serverId: z.string().min(1),
    savePlayerSaveId: z.string().min(1),
    savePlayerFileName: z.string().min(1),
    telemetryLookupKey: z.string().nullable(),
    playerId: z.string().nullable(),
    userId: z.string().nullable(),
    accountName: z.string().nullable(),
    playerName: z.string().nullable(),
    approvedAt: z.string().datetime(),
    approvedBy: z.string().min(1),
    notes: z.string().default('')
});
export const palworldRejectedIdentitySchema = z.object({
    state: z.literal('rejected'),
    serverId: z.string().min(1).nullable(),
    savePlayerSaveId: z.string().min(1),
    savePlayerFileName: z.string().min(1),
    telemetryLookupKey: z.string().nullable(),
    playerId: z.string().nullable(),
    userId: z.string().nullable(),
    accountName: z.string().nullable(),
    playerName: z.string().nullable(),
    rejectedAt: z.string().datetime(),
    rejectedBy: z.string().min(1),
    notes: z.string().default('')
});
export const palworldIdentityApprovalsResponseSchema = z.object({
    approvals: z.array(palworldApprovedIdentitySchema),
    rejections: z.array(palworldRejectedIdentitySchema)
});
export const palworldIdentityApprovalActionSchema = z.object({
    savePlayerKey: z.string().min(1),
    reviewedBy: z.string().min(1),
    notes: z.string().optional()
});
export const palworldManualIdentityLinkActionSchema = z.object({
    serverId: z.string().min(1),
    savePlayerSaveId: z.string().min(1),
    savePlayerFileName: z.string().min(1).optional(),
    telemetryLookupKey: z.string().optional(),
    playerId: z.string().optional(),
    userId: z.string().optional(),
    accountName: z.string().optional(),
    playerName: z.string().optional(),
    reviewedBy: z.string().min(1),
    notes: z.string().optional()
});
export const palworldIdentityReviewStateSchema = z.enum(['approved', 'rejected', 'unresolved']);
export const palworldPlayerSaveArtifactSchema = z.object({
    present: z.boolean(),
    path: z.string().nullable(),
    modifiedAt: z.string().datetime().nullable(),
    sizeBytes: z.number().int().min(0).nullable(),
    parseStatus: z.string().nullable(),
    savePlayerSaveId: z.string().nullable(),
    savePlayerFileName: z.string().nullable()
});
export const palworldPlayerReviewMetadataSchema = z.object({
    state: palworldIdentityReviewStateSchema,
    savePlayerSaveId: z.string().nullable(),
    savePlayerFileName: z.string().nullable(),
    telemetryLookupKey: z.string().nullable(),
    reviewedAt: z.string().datetime().nullable(),
    reviewedBy: z.string().nullable(),
    notes: z.string().default('')
});
export const palworldSessionTierSchema = z.enum(['short', 'active', 'grinding', 'marathon']);
export const palworldLevelTierSchema = z.enum(['new', 'mid', 'high', 'elite']);
export const palworldMilestoneSignalKeySchema = z.enum([
    'entered_elite_level_tier',
    'reached_marathon_session_tier',
    'top_online_level',
    'top_online_session_duration'
]);
export const palworldMilestoneSignalStrengthSchema = z.enum(['verified', 'provisional']);
export const palworldMilestoneSignalSchema = z.object({
    key: palworldMilestoneSignalKeySchema,
    label: z.string().min(1),
    reason: z.string().min(1),
    strength: palworldMilestoneSignalStrengthSchema
});
export const palworldMilestoneFeedEntrySchema = z.object({
    serverId: z.string().min(1),
    playerId: z.string().min(1),
    playerName: z.string().nullable(),
    accountName: z.string().nullable(),
    identityState: palworldIdentityReviewStateSchema,
    signalKey: palworldMilestoneSignalKeySchema,
    signalLabel: z.string().min(1),
    signalReason: z.string().min(1),
    signalStrength: palworldMilestoneSignalStrengthSchema,
    level: z.number().int().nullable(),
    sessionTier: palworldSessionTierSchema.nullable(),
    levelTier: palworldLevelTierSchema.nullable()
});
export const palworldMilestoneFeedResponseSchema = z.object({
    serverId: z.string().min(1),
    milestones: z.array(palworldMilestoneFeedEntrySchema)
});
export const palworldTransitionMilestoneEventTypeSchema = z.enum([
    'PALWORLD_LEVEL_TIER_ENTERED',
    'PALWORLD_SESSION_TIER_ENTERED',
    'PALWORLD_IDENTITY_APPROVED'
]);
export const palworldTransitionMilestoneEventSchema = z.object({
    serverId: z.string().min(1),
    playerId: z.string().min(1),
    playerName: z.string().nullable(),
    accountName: z.string().nullable(),
    eventType: palworldTransitionMilestoneEventTypeSchema,
    occurredAt: z.string().datetime(),
    identityState: palworldIdentityReviewStateSchema,
    level: z.number().int().nullable(),
    levelTier: palworldLevelTierSchema.nullable(),
    sessionTier: palworldSessionTierSchema.nullable(),
    activeSessionKey: z.string().nullable(),
    fromValue: z.string().nullable(),
    toValue: z.string().nullable(),
    reason: z.string().min(1),
    previewMessage: z.string().default('')
});
export const palworldTransitionMilestoneEventsResponseSchema = z.object({
    serverId: z.string().min(1),
    events: z.array(palworldTransitionMilestoneEventSchema)
});
export const palworldManualTransitionPostActionSchema = z.object({
    serverId: z.string().min(1),
    playerId: z.string().min(1),
    eventType: palworldTransitionMilestoneEventTypeSchema,
    occurredAt: z.string().datetime(),
    fromValue: z.string().nullable().optional(),
    toValue: z.string().nullable().optional()
});
export const palworldManualTransitionPostResponseSchema = z.object({
    ok: z.literal(true),
    channelId: z.string().min(1),
    messagePreview: z.string().min(1)
});
export const palworldPlayerClassificationSchema = z.enum([
    'Core Player',
    'Active Player',
    'New / Light Player'
]);
export const palworldPlayerImpactLevelSchema = z.enum([
    'High Impact',
    'Core',
    'Active',
    'Low'
]);
export const palworldPlayerIntelligenceSchema = z.object({
    likelyGuildName: z.string().nullable(),
    guildMemberCount: z.number().int().min(0).nullable(),
    identityState: palworldIdentityReviewStateSchema,
    levelTier: palworldLevelTierSchema.nullable(),
    sessionTier: palworldSessionTierSchema.nullable(),
    engagementScore: z.number().int().min(0),
    classification: palworldPlayerClassificationSchema,
    impactLevel: palworldPlayerImpactLevelSchema
});
export const palworldUnifiedPlayerProfileSchema = z.object({
    serverId: z.string().min(1),
    playerId: z.string().min(1),
    lookupKey: z.string().nullable(),
    playerName: z.string().nullable(),
    accountName: z.string().nullable(),
    userId: z.string().nullable(),
    level: z.number().int().nullable(),
    ping: z.number().nullable(),
    locationX: z.number().nullable(),
    locationY: z.number().nullable(),
    region: z.string().nullable(),
    firstSeenAt: z.string().datetime().nullable(),
    lastSeenAt: z.string().datetime().nullable(),
    maxLevelSeen: z.number().int().min(0).nullable(),
    totalSessions: z.number().int().min(0).nullable(),
    isOnline: z.boolean(),
    avgPing: z.number().nullable(),
    maxPing: z.number().nullable(),
    pingStdDev: z.number().nullable(),
    currentSessionDurationSeconds: z.number().int().min(0).nullable(),
    sessionTier: palworldSessionTierSchema.nullable(),
    levelTier: palworldLevelTierSchema.nullable(),
    onlineRankByLevel: z.number().int().min(1).nullable(),
    onlineRankBySessionDuration: z.number().int().min(1).nullable(),
    milestoneSignals: z.array(palworldMilestoneSignalSchema),
    identityState: palworldIdentityReviewStateSchema,
    review: palworldPlayerReviewMetadataSchema,
    saveArtifact: palworldPlayerSaveArtifactSchema,
    playerIntelligence: palworldPlayerIntelligenceSchema
});
export const palworldPlayerProfileSessionSummarySchema = z.object({
    serverId: z.string().min(1),
    playerId: z.string().min(1),
    lookupKey: z.string().nullable(),
    playerName: z.string().nullable(),
    accountName: z.string().nullable(),
    isOnline: z.boolean(),
    activeSessionStartedAt: z.string().datetime().nullable(),
    currentSessionDurationSeconds: z.number().int().min(0).nullable(),
    recentTrackedSeconds: z.number().int().min(0),
    trackedSeconds24h: z.number().int().min(0),
    trackedSeconds7d: z.number().int().min(0),
    trackedSeconds30d: z.number().int().min(0),
    lastSessionDurationSeconds: z.number().int().min(0).nullable(),
    lastSessionEndedAt: z.string().datetime().nullable(),
    recentSessions: z.array(sessionRecordSchema),
    saveArtifact: palworldPlayerSaveArtifactSchema,
    inferredGuildName: z.string().nullable(),
    profile: palworldUnifiedPlayerProfileSchema
});
export const palworldPlayerProfileSessionSummariesResponseSchema = z.object({
    serverId: z.string().min(1),
    profiles: z.array(palworldPlayerProfileSessionSummarySchema)
});
export const palworldGuildActivityRiskLevelSchema = z.enum(['active', 'watch', 'risk', 'expired', 'unknown']);
export const palworldGuildActivityMemberSchema = z.object({
    memberName: z.string().min(1),
    matched: z.boolean(),
    status: z.enum(['never_seen']).optional(),
    matchedPlayerName: z.string().nullable(),
    lastSeenAt: z.string().datetime().nullable(),
    daysSinceSeen: z.number().int().min(0).nullable(),
    level: z.number().int().min(0).nullable(),
    saveLinked: z.boolean().nullable()
});
export const palworldGuildActivityEntrySchema = z.object({
    guildName: z.string().min(1),
    memberCount: z.number().int().min(0),
    members: z.array(palworldGuildActivityMemberSchema),
    lastMemberSeenAt: z.string().datetime().nullable(),
    lastSeenMemberName: z.string().nullable(),
    daysInactive: z.number().int().min(0).nullable(),
    daysUntilPalboxRisk: z.number().int().min(0).nullable(),
    riskLevel: palworldGuildActivityRiskLevelSchema
});
export const palworldGuildActivityResponseSchema = z.object({
    serverId: z.string().min(1),
    guilds: z.array(palworldGuildActivityEntrySchema)
});
const workspaceConfigSchema = z.object({
    workspaceId: z.string().min(1),
    workspaceName: z.string().min(1),
    ownerName: z.string().min(1),
    hostingMode: hostingModeSchema,
    timezone: z.string().min(1).default('UTC')
});
const apiConfigSchema = z.object({
    baseUrl: z.string().url(),
    port: z.number().int().min(1).max(65535).default(3001),
    corsOrigin: z.string().optional()
});
const discordConfigSchema = z.object({
    enabled: z.boolean().default(false),
    applicationId: z.string().optional(),
    guildId: z.string().optional(),
    botTokenEnvVar: z.string().default('DISCORD_BOT_TOKEN')
});
const connectorCommonSchema = z.object({
    pollIntervalMs: z.number().int().min(250).default(2000),
    logPath: z.string().optional(),
    journalServiceName: z.string().optional(),
    restHost: z.string().optional(),
    restPort: z.number().int().min(1).max(65535).optional(),
    restUsername: z.string().optional(),
    restPassword: z.string().optional(),
    restPath: z.string().optional(),
    rconHost: z.string().optional(),
    rconPort: z.number().int().min(1).max(65535).optional(),
    rconPassword: z.string().optional(),
    queryPort: z.number().int().min(1).max(65535).optional(),
    savePath: z.string().optional()
});
const valheimServerConfigSchema = z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    enabled: z.boolean().default(true),
    game: z.literal('valheim'),
    connector: z.discriminatedUnion('mode', [
        connectorCommonSchema.extend({
            mode: z.literal('file'),
            logPath: z.string().min(1)
        }),
        connectorCommonSchema.extend({
            mode: z.literal('journal'),
            journalServiceName: z.string().min(1)
        })
    ])
});
const palworldServerConfigSchema = z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    enabled: z.boolean().default(true),
    game: z.literal('palworld'),
    connector: z.discriminatedUnion('mode', [
        connectorCommonSchema.extend({
            mode: z.literal('rest'),
            restHost: z.string().min(1),
            restPort: z.number().int().min(1).max(65535),
            restUsername: z.string().min(1).default('admin'),
            restPassword: z.string().min(1),
            restPath: z.string().min(1).default('/v1/api')
        }),
        connectorCommonSchema.extend({
            mode: z.literal('rcon'),
            rconHost: z.string().min(1),
            rconPort: z.number().int().min(1).max(65535),
            rconPassword: z.string().min(1)
        }),
        connectorCommonSchema.extend({
            mode: z.literal('query'),
            rconHost: z.string().min(1),
            queryPort: z.number().int().min(1).max(65535)
        }),
        connectorCommonSchema.extend({
            mode: z.literal('file'),
            logPath: z.string().min(1)
        })
    ])
});
const serverConfigSchema = z.discriminatedUnion('game', [
    valheimServerConfigSchema,
    palworldServerConfigSchema
]);
export const featureFlagsSchema = z.object({
    dashboardEnabled: z.boolean().default(true),
    botEnabled: z.boolean().default(true),
    connectorEnabled: z.boolean().default(true),
    identityResolutionEnabled: z.boolean().default(true),
    sessionReconciliationEnabled: z.boolean().default(true)
}).catchall(z.boolean());
export const gameOpsConfigSchema = z.object({
    version: z.literal(1),
    workspace: workspaceConfigSchema,
    api: apiConfigSchema,
    discord: discordConfigSchema,
    servers: z.array(serverConfigSchema).min(1),
    featureFlags: featureFlagsSchema
});
//# sourceMappingURL=index.js.map