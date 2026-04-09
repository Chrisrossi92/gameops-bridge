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

export const hostingModeSchema = z.enum(['self_hosted', 'hybrid', 'hosted_limited']);
export type HostingMode = z.infer<typeof hostingModeSchema>;

export const valheimConnectorModeSchema = z.enum(['file', 'journal']);
export type ValheimConnectorMode = z.infer<typeof valheimConnectorModeSchema>;

export const palworldConnectorModeSchema = z.enum(['rest', 'rcon', 'query', 'file']);
export type PalworldConnectorMode = z.infer<typeof palworldConnectorModeSchema>;

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

export const configuredServerSummarySchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  game: gameKeySchema
});
export type ConfiguredServerSummary = z.infer<typeof configuredServerSummarySchema>;

export const configuredServersResponseSchema = z.object({
  servers: z.array(configuredServerSummarySchema)
});
export type ConfiguredServersResponse = z.infer<typeof configuredServersResponseSchema>;

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
export type PalworldLatestPlayerTelemetry = z.infer<typeof palworldLatestPlayerTelemetrySchema>;

export const palworldLatestPlayersResponseSchema = z.object({
  serverId: z.string().min(1),
  players: z.array(palworldLatestPlayerTelemetrySchema)
});
export type PalworldLatestPlayersResponse = z.infer<typeof palworldLatestPlayersResponseSchema>;

export const palworldPlayerTelemetryProfileResponseSchema = z.object({
  serverId: z.string().min(1),
  player: palworldLatestPlayerTelemetrySchema.nullable()
});
export type PalworldPlayerTelemetryProfileResponse = z.infer<typeof palworldPlayerTelemetryProfileResponseSchema>;

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
export type PalworldPlayerSnapshot = z.infer<typeof palworldPlayerSnapshotSchema>;

export const palworldPlayerSnapshotsResponseSchema = z.object({
  serverId: z.string().min(1),
  snapshots: z.array(palworldPlayerSnapshotSchema)
});
export type PalworldPlayerSnapshotsResponse = z.infer<typeof palworldPlayerSnapshotsResponseSchema>;

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
export type PalworldMetricsSummary = z.infer<typeof palworldMetricsSummarySchema>;

export const palworldMetricsSummariesResponseSchema = z.object({
  serverId: z.string().min(1),
  metrics: z.array(palworldMetricsSummarySchema)
});
export type PalworldMetricsSummariesResponse = z.infer<typeof palworldMetricsSummariesResponseSchema>;

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
export type PalworldIdentityLinkCandidate = z.infer<typeof palworldIdentityLinkCandidateSchema>;

export const palworldIdentityLinkFailureSchema = z.object({
  savePlayerFileName: z.string().min(1),
  savePlayerSaveId: z.string().min(1),
  status: z.enum(['skipped', 'no_match', 'input_error']),
  message: z.string().min(1)
});
export type PalworldIdentityLinkFailure = z.infer<typeof palworldIdentityLinkFailureSchema>;

export const palworldIdentityLinksResponseSchema = z.object({
  generatedAt: z.string().datetime().optional(),
  candidates: z.array(palworldIdentityLinkCandidateSchema),
  failures: z.array(palworldIdentityLinkFailureSchema)
});
export type PalworldIdentityLinksResponse = z.infer<typeof palworldIdentityLinksResponseSchema>;

export const palworldIdentityLinkReviewResponseSchema = z.object({
  candidate: palworldIdentityLinkCandidateSchema.nullable(),
  failures: z.array(palworldIdentityLinkFailureSchema)
});
export type PalworldIdentityLinkReviewResponse = z.infer<typeof palworldIdentityLinkReviewResponseSchema>;

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
export type PalworldApprovedIdentity = z.infer<typeof palworldApprovedIdentitySchema>;

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
export type PalworldRejectedIdentity = z.infer<typeof palworldRejectedIdentitySchema>;

export const palworldIdentityApprovalsResponseSchema = z.object({
  approvals: z.array(palworldApprovedIdentitySchema),
  rejections: z.array(palworldRejectedIdentitySchema)
});
export type PalworldIdentityApprovalsResponse = z.infer<typeof palworldIdentityApprovalsResponseSchema>;

export const palworldIdentityApprovalActionSchema = z.object({
  savePlayerKey: z.string().min(1),
  reviewedBy: z.string().min(1),
  notes: z.string().optional()
});
export type PalworldIdentityApprovalAction = z.infer<typeof palworldIdentityApprovalActionSchema>;

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

export type WorkspaceConfig = z.infer<typeof workspaceConfigSchema>;
export type ApiConfig = z.infer<typeof apiConfigSchema>;
export type DiscordConfig = z.infer<typeof discordConfigSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type FeatureFlagsConfig = z.infer<typeof featureFlagsSchema>;
export type GameOpsConfig = z.infer<typeof gameOpsConfigSchema>;
