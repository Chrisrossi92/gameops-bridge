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

export const identityConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type IdentityConfidence = z.infer<typeof identityConfidenceSchema>;

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

export const activitySeveritySchema = z.enum(['info', 'warning', 'critical']);
export type ActivitySeverity = z.infer<typeof activitySeveritySchema>;

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
export type ActivityLogItem = z.infer<typeof activityLogItemSchema>;

export const activityLogResponseSchema = z.object({
  serverId: z.string().min(1),
  items: z.array(activityLogItemSchema)
});
export type ActivityLogResponse = z.infer<typeof activityLogResponseSchema>;

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

export const playerIntelligenceConfidenceSchema = z.enum(['unknown', 'low', 'medium', 'high']);
export type PlayerIntelligenceConfidence = z.infer<typeof playerIntelligenceConfidenceSchema>;

export const playerIntelligenceRecordSchema = z.object({
  playerId: z.string().min(1),
  serverId: z.string().min(1),
  displayName: z.string().min(1),
  aliases: z.array(z.string()),
  game: gameKeySchema,
  identityConfidence: playerIntelligenceConfidenceSchema,
  identityExplanation: z.string().min(1),
  firstSeenAt: z.string().datetime().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
  isOnline: z.boolean(),
  activeSessionId: z.string().nullable(),
  totalTrackedSeconds: z.number().int().min(0),
  sessionCount: z.number().int().min(0),
  averageSessionSeconds: z.number().int().min(0),
  sourceSummary: z.array(z.string()),
  gameFields: z.record(z.string(), z.unknown()).optional()
});
export type PlayerIntelligenceRecord = z.infer<typeof playerIntelligenceRecordSchema>;

export const playerIntelligenceResponseSchema = z.object({
  serverId: z.string().min(1),
  explanation: z.string().min(1),
  players: z.array(playerIntelligenceRecordSchema)
});
export type PlayerIntelligenceResponse = z.infer<typeof playerIntelligenceResponseSchema>;

export const playerEngagementPlayerSchema = z.object({
  playerId: z.string().min(1),
  displayName: z.string().min(1),
  isOnline: z.boolean(),
  lastSeenAt: z.string().datetime().nullable(),
  firstSeenAt: z.string().datetime().nullable(),
  sessionCount: z.number().int().min(0),
  totalTrackedSeconds: z.number().int().min(0),
  averageSessionSeconds: z.number().int().min(0),
  confidence: playerIntelligenceConfidenceSchema,
  reason: z.string().min(1)
});
export type PlayerEngagementPlayer = z.infer<typeof playerEngagementPlayerSchema>;

export const playerEngagementWindowSchema = z.object({
  sessions: z.number().int().min(0),
  trackedSeconds: z.number().int().min(0),
  uniquePlayers: z.number().int().min(0)
});
export type PlayerEngagementWindow = z.infer<typeof playerEngagementWindowSchema>;

export const playerEngagementActivityShapeSchema = z.object({
  activeNowCount: z.number().int().min(0),
  activeNow: z.array(playerEngagementPlayerSchema),
  today: playerEngagementWindowSchema,
  sevenDays: playerEngagementWindowSchema,
  thirtyDays: playerEngagementWindowSchema,
  lastActivityAt: z.string().datetime().nullable(),
  peakHourUtc: z.number().int().min(0).max(23).nullable(),
  peakHourSessionCount: z.number().int().min(0)
});
export type PlayerEngagementActivityShape = z.infer<typeof playerEngagementActivityShapeSchema>;

export const playerEngagementSummarySchema = z.object({
  serverId: z.string().min(1),
  generatedAt: z.string().datetime(),
  headline: z.string().min(1),
  explanation: z.string().min(1),
  activity: playerEngagementActivityShapeSchema,
  returningPlayers: z.array(playerEngagementPlayerSchema),
  mostRecentPlayers: z.array(playerEngagementPlayerSchema),
  highEngagementPlayers: z.array(playerEngagementPlayerSchema),
  inactivePlayers: z.array(playerEngagementPlayerSchema),
  confidence: playerIntelligenceConfidenceSchema,
  dataWarnings: z.array(z.string().min(1))
});
export type PlayerEngagementSummary = z.infer<typeof playerEngagementSummarySchema>;

export const sessionTimelineSourceSchema = z.enum(['live', 'recent', 'stored']);
export type SessionTimelineSource = z.infer<typeof sessionTimelineSourceSchema>;

export const sessionTimelineItemSchema = z.object({
  sessionId: z.string().min(1),
  playerId: z.string().min(1),
  displayName: z.string().min(1),
  observedName: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
  durationSeconds: z.number().int().min(0),
  closeReason: z.string().nullable(),
  startConfidence: playerIntelligenceConfidenceSchema.nullable(),
  endConfidence: playerIntelligenceConfidenceSchema.nullable(),
  explanation: z.string().min(1),
  source: sessionTimelineSourceSchema
});
export type SessionTimelineItem = z.infer<typeof sessionTimelineItemSchema>;

export const sessionTimelineSummarySchema = z.object({
  activeCount: z.number().int().min(0),
  sessionsToday: z.number().int().min(0),
  trackedSecondsToday: z.number().int().min(0),
  lastActivityAt: z.string().datetime().nullable()
});
export type SessionTimelineSummary = z.infer<typeof sessionTimelineSummarySchema>;

export const sessionTimelineResponseSchema = z.object({
  serverId: z.string().min(1),
  sessions: z.array(sessionTimelineItemSchema),
  summary: sessionTimelineSummarySchema,
  explanation: z.string().min(1)
});
export type SessionTimelineResponse = z.infer<typeof sessionTimelineResponseSchema>;

export const playerDetailSessionSchema = z.object({
  sessionId: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  durationSeconds: z.number().int().min(0),
  closeReason: z.string().nullable(),
  startConfidence: playerIntelligenceConfidenceSchema.nullable(),
  endConfidence: playerIntelligenceConfidenceSchema.nullable(),
  observedName: z.string().min(1),
  explanation: z.string().min(1)
});
export type PlayerDetailSession = z.infer<typeof playerDetailSessionSchema>;

export const playerEngagementStatusSchema = z.enum([
  'active_now',
  'recently_active',
  'inactive',
  'fading',
  'unknown'
]);
export type PlayerEngagementStatus = z.infer<typeof playerEngagementStatusSchema>;

export const playerEngagementTrendDirectionSchema = z.enum(['up', 'down', 'steady', 'unknown']);
export type PlayerEngagementTrendDirection = z.infer<typeof playerEngagementTrendDirectionSchema>;

export const playerEngagementDetailSchema = z.object({
  serverId: z.string().min(1),
  playerId: z.string().min(1),
  displayName: z.string().min(1),
  status: playerEngagementStatusSchema,
  statusLabel: z.string().min(1),
  whyTheyMatter: z.array(z.string().min(1)),
  firstSeenAt: z.string().datetime().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
  totalSessions: z.number().int().min(0),
  totalTrackedSeconds: z.number().int().min(0),
  averageSessionSeconds: z.number().int().min(0),
  sevenDays: playerEngagementWindowSchema,
  thirtyDays: playerEngagementWindowSchema,
  trendDirection: playerEngagementTrendDirectionSchema,
  current7dSessions: z.number().int().min(0),
  previous7dSessions: z.number().int().min(0),
  current7dPlaySeconds: z.number().int().min(0),
  previous7dPlaySeconds: z.number().int().min(0),
  trendReasons: z.array(z.string().min(1)),
  trendConfidenceWarning: z.string().min(1).nullable(),
  recentSessions: z.array(playerDetailSessionSchema),
  confidence: playerIntelligenceConfidenceSchema,
  confidenceWarnings: z.array(z.string().min(1)),
  evidenceNotes: z.array(z.string().min(1))
});
export type PlayerEngagementDetail = z.infer<typeof playerEngagementDetailSchema>;

export const serverAliveRhythmDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayOfWeek: z.string().min(1),
  sessions: z.number().int().min(0),
  trackedSeconds: z.number().int().min(0),
  uniquePlayers: z.number().int().min(0)
});
export type ServerAliveRhythmDay = z.infer<typeof serverAliveRhythmDaySchema>;

export const serverAliveRhythmPeriodSchema = z.object({
  totalSessions: z.number().int().min(0),
  totalTrackedSeconds: z.number().int().min(0),
  uniqueActivePlayers: z.number().int().min(0),
  busiestDays: z.array(serverAliveRhythmDaySchema),
  quietDays: z.array(serverAliveRhythmDaySchema)
});
export type ServerAliveRhythmPeriod = z.infer<typeof serverAliveRhythmPeriodSchema>;

export const serverAliveRhythmDayPatternSchema = z.object({
  dayOfWeek: z.string().min(1),
  observedDays: z.number().int().min(0),
  totalSessions: z.number().int().min(0),
  totalTrackedSeconds: z.number().int().min(0),
  averageSessions: z.number().min(0),
  averageTrackedSeconds: z.number().min(0)
});
export type ServerAliveRhythmDayPattern = z.infer<typeof serverAliveRhythmDayPatternSchema>;

export const serverAliveRhythmHourlyPatternSchema = z.object({
  status: z.enum(['available', 'unknown']),
  busiestUtcHours: z.array(z.object({
    hourUtc: z.number().int().min(0).max(23),
    sessions: z.number().int().min(0),
    trackedSeconds: z.number().int().min(0)
  })),
  explanation: z.string().min(1)
});
export type ServerAliveRhythmHourlyPattern = z.infer<typeof serverAliveRhythmHourlyPatternSchema>;

export const serverAliveRhythmSummarySchema = z.object({
  serverId: z.string().min(1),
  generatedAt: z.string().datetime(),
  summary: z.string().min(1),
  sevenDays: serverAliveRhythmPeriodSchema,
  thirtyDays: serverAliveRhythmPeriodSchema,
  bestDayOfWeekPattern: serverAliveRhythmDayPatternSchema.nullable(),
  hourlyPattern: serverAliveRhythmHourlyPatternSchema,
  confidence: playerIntelligenceConfidenceSchema,
  confidenceWarnings: z.array(z.string().min(1))
});
export type ServerAliveRhythmSummary = z.infer<typeof serverAliveRhythmSummarySchema>;

export const settingsCapabilityStateSchema = z.enum(['yes', 'no', 'unknown']);
export type SettingsCapabilityState = z.infer<typeof settingsCapabilityStateSchema>;

export const settingsReadSourceSchema = z.enum(['Palworld REST', 'config file', 'unavailable', 'unknown']);
export type SettingsReadSource = z.infer<typeof settingsReadSourceSchema>;

export const settingsWritePathStatusSchema = z.enum([
  'not_supported',
  'unknown',
  'possible_needs_validation',
  'blocked_missing_config'
]);
export type SettingsWritePathStatus = z.infer<typeof settingsWritePathStatusSchema>;

export const settingsCandidateWritePathSchema = z.enum(['rest', 'rcon', 'file_edit', 'manual']);
export type SettingsCandidateWritePath = z.infer<typeof settingsCandidateWritePathSchema>;

export const supportedSettingGroupSchema = z.enum([
  'rates',
  'egg/incubation',
  'spawn/world',
  'difficulty',
  'whitelist/access',
  'unknown/unmapped'
]);
export type SupportedSettingGroup = z.infer<typeof supportedSettingGroupSchema>;

export const serverSettingsCapabilitySummarySchema = z.object({
  serverId: z.string().min(1),
  serverName: z.string().min(1).nullable(),
  game: gameKeySchema.nullable(),
  connectorMode: z.enum(['file', 'journal', 'rest', 'rcon', 'query']).nullable(),
  canReadSettings: settingsCapabilityStateSchema,
  readSource: settingsReadSourceSchema,
  lastSettingsSnapshotAt: z.string().datetime().nullable(),
  canWriteSettings: settingsCapabilityStateSchema,
  writePathStatus: settingsWritePathStatusSchema,
  candidateWritePaths: z.array(settingsCandidateWritePathSchema),
  requiresRestart: settingsCapabilityStateSchema,
  supportedSettingGroups: z.array(supportedSettingGroupSchema),
  validationSteps: z.array(z.string().min(1)),
  rollbackRequirements: z.array(z.string().min(1)),
  unresolvedQuestions: z.array(z.string().min(1)),
  safetyNotes: z.array(z.string().min(1)),
  missingRequirements: z.array(z.string().min(1)),
  nextSafeStep: z.string().min(1)
});
export type ServerSettingsCapabilitySummary = z.infer<typeof serverSettingsCapabilitySummarySchema>;

export const palworldConfigAuditDiscoveryStatusSchema = z.enum([
  'unsupported',
  'no_config_path',
  'candidate_not_found',
  'found'
]);
export type PalworldConfigAuditDiscoveryStatus = z.infer<typeof palworldConfigAuditDiscoveryStatusSchema>;

export const palworldConfigAuditParseStatusSchema = z.enum([
  'not_attempted',
  'parsed',
  'failed',
  'unreadable'
]);
export type PalworldConfigAuditParseStatus = z.infer<typeof palworldConfigAuditParseStatusSchema>;

export const palworldConfigFileEditViabilitySchema = z.enum([
  'not_viable',
  'unknown',
  'possible_needs_backup_restart_validation'
]);
export type PalworldConfigFileEditViability = z.infer<typeof palworldConfigFileEditViabilitySchema>;

export const palworldConfigAuditMatchedSettingSchema = z.object({
  key: z.string().min(1),
  fileValue: z.unknown(),
  restValue: z.unknown(),
  valuesMatch: z.boolean()
});
export type PalworldConfigAuditMatchedSetting = z.infer<typeof palworldConfigAuditMatchedSettingSchema>;

export const palworldConfigAuditSchema = z.object({
  serverId: z.string().min(1),
  serverName: z.string().min(1).nullable(),
  discoveryStatus: palworldConfigAuditDiscoveryStatusSchema,
  candidatePaths: z.array(z.string().min(1)),
  selectedPath: z.string().min(1).nullable(),
  canReadFile: z.boolean(),
  parseStatus: palworldConfigAuditParseStatusSchema,
  parsedSettingCount: z.number().int().min(0),
  matchedRestSettings: z.array(palworldConfigAuditMatchedSettingSchema),
  unmatchedFileSettings: z.array(z.string().min(1)),
  unmatchedRestSettings: z.array(z.string().min(1)),
  fileEditViability: palworldConfigFileEditViabilitySchema,
  safetyWarnings: z.array(z.string().min(1)),
  nextValidationSteps: z.array(z.string().min(1))
});
export type PalworldConfigAudit = z.infer<typeof palworldConfigAuditSchema>;

export const eventTemplateConfigDiffPreviewStatusSchema = z.enum(['available', 'limited', 'unavailable']);
export type EventTemplateConfigDiffPreviewStatus = z.infer<typeof eventTemplateConfigDiffPreviewStatusSchema>;

export const palworldRuntimeConfigAlignmentStatusSchema = z.enum(['matched', 'mismatched', 'unknown', 'unreadable']);
export type PalworldRuntimeConfigAlignmentStatus = z.infer<typeof palworldRuntimeConfigAlignmentStatusSchema>;

export const eventTemplateConfigDiffChangeSchema = z.object({
  key: z.string().min(1),
  currentFileValue: z.unknown(),
  currentObservedValue: z.unknown().nullable(),
  proposedValue: z.unknown().nullable(),
  valueType: z.enum(['string', 'number', 'boolean', 'object', 'array', 'null', 'unknown']),
  riskLabel: z.string().min(1),
  warningNotes: z.array(z.string().min(1))
});
export type EventTemplateConfigDiffChange = z.infer<typeof eventTemplateConfigDiffChangeSchema>;

export const eventTemplateConfigDiffPreviewSchema = z.object({
  serverId: z.string().min(1),
  templateId: z.string().min(1),
  selectedConfigPath: z.string().min(1).nullable(),
  targetConfigPath: z.string().min(1).nullable(),
  activeRuntimeConfigPath: z.string().min(1).nullable(),
  runtimeConfigMatchesSelected: z.boolean(),
  runtimeAlignmentStatus: palworldRuntimeConfigAlignmentStatusSchema,
  previewStatus: eventTemplateConfigDiffPreviewStatusSchema,
  changes: z.array(eventTemplateConfigDiffChangeSchema),
  missingKeys: z.array(z.string().min(1)),
  unmappedSettings: z.array(z.string().min(1)),
  safetyWarnings: z.array(z.string().min(1)),
  canApply: z.literal(false),
  reasonApplyDisabled: z.string().min(1)
});
export type EventTemplateConfigDiffPreview = z.infer<typeof eventTemplateConfigDiffPreviewSchema>;

export const palworldBackupReadinessStatusSchema = z.enum([
  'ready_for_manual_backup_plan',
  'blocked_missing_config_file',
  'blocked_unreadable_file',
  'unknown'
]);
export type PalworldBackupReadinessStatus = z.infer<typeof palworldBackupReadinessStatusSchema>;

export const palworldBackupReadinessFileSchema = z.object({
  path: z.string().min(1),
  exists: z.boolean(),
  readable: z.boolean(),
  reason: z.string().min(1)
});
export type PalworldBackupReadinessFile = z.infer<typeof palworldBackupReadinessFileSchema>;

export const palworldBackupReadinessSchema = z.object({
  serverId: z.string().min(1),
  serverName: z.string().min(1).nullable(),
  readinessStatus: palworldBackupReadinessStatusSchema,
  filesToBackup: z.array(palworldBackupReadinessFileSchema),
  proposedBackupDirectory: z.string().min(1).nullable(),
  proposedBackupFilenamePattern: z.string().min(1).nullable(),
  activeRuntimeConfigPath: z.string().min(1).nullable(),
  runtimeConfigMatchesSelected: z.boolean(),
  runtimeAlignmentStatus: palworldRuntimeConfigAlignmentStatusSchema,
  rollbackRequirements: z.array(z.string().min(1)),
  validationSteps: z.array(z.string().min(1)),
  safetyWarnings: z.array(z.string().min(1)),
  canCreateBackup: z.literal(false),
  reasonCreateBackupDisabled: z.string().min(1)
});
export type PalworldBackupReadiness = z.infer<typeof palworldBackupReadinessSchema>;

export const eventTemplateManualChecklistStatusSchema = z.enum(['ready_for_manual_review', 'blocked', 'limited']);
export type EventTemplateManualChecklistStatus = z.infer<typeof eventTemplateManualChecklistStatusSchema>;

export const eventTemplateManualChecklistItemStatusSchema = z.enum(['pass', 'warning', 'blocked', 'info']);
export type EventTemplateManualChecklistItemStatus = z.infer<typeof eventTemplateManualChecklistItemStatusSchema>;

export const eventTemplateManualChecklistItemSchema = z.object({
  label: z.string().min(1),
  status: eventTemplateManualChecklistItemStatusSchema,
  detail: z.string().min(1)
});
export type EventTemplateManualChecklistItem = z.infer<typeof eventTemplateManualChecklistItemSchema>;

export const eventTemplateManualChangeChecklistSchema = z.object({
  serverId: z.string().min(1),
  templateId: z.string().min(1),
  checklistStatus: eventTemplateManualChecklistStatusSchema,
  checklistItems: z.array(eventTemplateManualChecklistItemSchema),
  requiredManualSteps: z.array(z.string().min(1)),
  ownerConfirmationText: z.string().min(1),
  canApply: z.literal(false),
  reasonApplyDisabled: z.string().min(1)
});
export type EventTemplateManualChangeChecklist = z.infer<typeof eventTemplateManualChangeChecklistSchema>;

export const eventTemplateManualEditPlanStatusSchema = z.enum(['available', 'limited', 'blocked']);
export type EventTemplateManualEditPlanStatus = z.infer<typeof eventTemplateManualEditPlanStatusSchema>;

export const eventTemplateManualEditPlanChangeSchema = z.object({
  key: z.string().min(1),
  fromValue: z.unknown(),
  toValue: z.unknown().nullable()
});
export type EventTemplateManualEditPlanChange = z.infer<typeof eventTemplateManualEditPlanChangeSchema>;

export const eventTemplateManualEditPlanSchema = z.object({
  serverId: z.string().min(1),
  templateId: z.string().min(1),
  planStatus: eventTemplateManualEditPlanStatusSchema,
  targetConfigPath: z.string().min(1).nullable(),
  backupRecommendation: z.string().min(1),
  exactChanges: z.array(eventTemplateManualEditPlanChangeSchema),
  manualSteps: z.array(z.string().min(1)),
  copyableText: z.string().min(1),
  warnings: z.array(z.string().min(1)),
  canApply: z.literal(false)
});
export type EventTemplateManualEditPlan = z.infer<typeof eventTemplateManualEditPlanSchema>;

export const palworldRuntimeAuditStatusSchema = z.enum([
  'matched_active_config',
  'mismatched_config',
  'missing_systemd_service',
  'missing_working_directory',
  'active_config_unreadable',
  'unknown'
]);
export type PalworldRuntimeAuditStatus = z.infer<typeof palworldRuntimeAuditStatusSchema>;

export const palworldRuntimeAuditSchema = z.object({
  serverId: z.string().min(1),
  servicePath: z.string().min(1),
  serviceReadable: z.boolean(),
  workingDirectory: z.string().min(1).nullable(),
  execStart: z.string().min(1).nullable(),
  inferredActiveConfigPath: z.string().min(1).nullable(),
  inferredActiveConfigExists: z.boolean(),
  inferredActiveConfigReadable: z.boolean(),
  selectedConfigAuditPath: z.string().min(1).nullable(),
  pathsMatch: z.boolean(),
  runtimeAuditStatus: palworldRuntimeAuditStatusSchema,
  summary: z.string().min(1),
  safetyWarnings: z.array(z.string().min(1))
});
export type PalworldRuntimeAudit = z.infer<typeof palworldRuntimeAuditSchema>;

export const observedSettingValueTypeSchema = z.enum(['string', 'number', 'boolean', 'object', 'array', 'null', 'unknown']);
export type ObservedSettingValueType = z.infer<typeof observedSettingValueTypeSchema>;

export const observedSettingChangeRiskSchema = z.enum([
  'safe_display',
  'likely_restart_required',
  'dangerous_access_related',
  'gameplay_balance',
  'unknown'
]);
export type ObservedSettingChangeRisk = z.infer<typeof observedSettingChangeRiskSchema>;

export const observedSettingRecommendedHandlingSchema = z.enum([
  'read_only',
  'template_candidate',
  'manual_review',
  'never_auto_change',
  'unknown'
]);
export type ObservedSettingRecommendedHandling = z.infer<typeof observedSettingRecommendedHandlingSchema>;

export const observedSettingValueSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  group: supportedSettingGroupSchema,
  value: z.unknown(),
  valueType: observedSettingValueTypeSchema,
  sensitive: z.boolean(),
  safetyNote: z.string().min(1),
  writable: z.literal(false),
  requiresRestart: settingsCapabilityStateSchema,
  changeRisk: observedSettingChangeRiskSchema,
  riskLabel: z.string().min(1),
  riskNote: z.string().min(1),
  recommendedHandling: observedSettingRecommendedHandlingSchema
});
export type ObservedSettingValue = z.infer<typeof observedSettingValueSchema>;

export const observedSettingsGroupSchema = z.object({
  group: supportedSettingGroupSchema,
  settings: z.array(observedSettingValueSchema)
});
export type ObservedSettingsGroup = z.infer<typeof observedSettingsGroupSchema>;

export const observedSettingsResponseSchema = z.object({
  serverId: z.string().min(1),
  serverName: z.string().min(1).nullable(),
  game: gameKeySchema.nullable(),
  connectorMode: z.enum(['file', 'journal', 'rest', 'rcon', 'query']).nullable(),
  available: z.boolean(),
  source: settingsReadSourceSchema,
  snapshotAt: z.string().datetime().nullable(),
  groups: z.array(observedSettingsGroupSchema),
  safetyNotes: z.array(z.string().min(1)),
  emptyState: z.string().min(1).nullable()
});
export type ObservedSettingsResponse = z.infer<typeof observedSettingsResponseSchema>;

export const eventTemplateDraftMatchedSettingSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  group: supportedSettingGroupSchema,
  value: z.unknown(),
  valueType: observedSettingValueTypeSchema,
  changeRisk: observedSettingChangeRiskSchema,
  riskLabel: z.string().min(1),
  recommendedHandling: observedSettingRecommendedHandlingSchema
});
export type EventTemplateDraftMatchedSetting = z.infer<typeof eventTemplateDraftMatchedSettingSchema>;

export const eventTemplateDraftChangePreviewSchema = z.object({
  settingKey: z.string().min(1),
  settingLabel: z.string().min(1),
  currentValue: z.unknown(),
  proposedValue: z.unknown().nullable(),
  proposedLabel: z.string().min(1),
  differenceLabel: z.string().min(1),
  changeRisk: observedSettingChangeRiskSchema,
  riskLabel: z.string().min(1),
  recommendedHandling: observedSettingRecommendedHandlingSchema,
  canPreview: z.boolean(),
  previewWarnings: z.array(z.string().min(1))
});
export type EventTemplateDraftChangePreview = z.infer<typeof eventTemplateDraftChangePreviewSchema>;

export const eventTemplateDraftSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  status: z.literal('draft_only'),
  enabledInDashboard: z.boolean(),
  displayName: z.string().min(1).nullable(),
  targetMultiplier: z.number().positive().nullable(),
  targetValue: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  durationHours: z.number().positive().nullable(),
  notes: z.string().nullable(),
  scheduleLabel: z.string().nullable(),
  updatedAt: z.string().datetime().nullable(),
  matchedSettings: z.array(eventTemplateDraftMatchedSettingSchema),
  changePreviews: z.array(eventTemplateDraftChangePreviewSchema),
  missingSettings: z.array(z.string().min(1)),
  safetyNotes: z.array(z.string().min(1)),
  requiresRestart: z.enum(['unknown', 'manual_review']),
  canApply: z.literal(false),
  reasonApplyDisabled: z.string().min(1)
});
export type EventTemplateDraft = z.infer<typeof eventTemplateDraftSchema>;

export const eventTemplateDraftCatalogSchema = z.object({
  serverId: z.string().min(1),
  serverName: z.string().min(1).nullable(),
  game: gameKeySchema.nullable(),
  sourceSnapshotAt: z.string().datetime().nullable(),
  status: z.enum(['available', 'empty', 'unavailable']),
  explanation: z.string().min(1),
  drafts: z.array(eventTemplateDraftSchema),
  safetyNotes: z.array(z.string().min(1))
});
export type EventTemplateDraftCatalog = z.infer<typeof eventTemplateDraftCatalogSchema>;

export const eventTemplateDraftOverrideRequestSchema = z.object({
  enabledInDashboard: z.boolean().optional(),
  displayName: z.string().trim().min(1).max(120).nullable().optional(),
  targetMultiplier: z.number().positive().max(1000).nullable().optional(),
  targetValue: z.union([z.string().trim().max(200), z.number(), z.boolean()]).nullable().optional(),
  durationHours: z.number().positive().max(24 * 30).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  scheduleLabel: z.string().trim().max(120).nullable().optional()
});
export type EventTemplateDraftOverrideRequest = z.infer<typeof eventTemplateDraftOverrideRequestSchema>;

export const playerDetailEvidenceSchema = z.object({
  type: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  confidence: playerIntelligenceConfidenceSchema,
  observedAt: z.string().datetime().nullable()
});
export type PlayerDetailEvidence = z.infer<typeof playerDetailEvidenceSchema>;

export const playerDetailSummarySchema = z.object({
  playerId: z.string().min(1),
  serverId: z.string().min(1),
  displayName: z.string().min(1),
  aliases: z.array(z.string()),
  game: gameKeySchema,
  isOnline: z.boolean(),
  activeSessionId: z.string().nullable(),
  firstSeenAt: z.string().datetime().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
  trackedPlaytimeSeconds: z.number().int().min(0),
  sessionCount: z.number().int().min(0),
  averageSessionSeconds: z.number().int().min(0),
  identityConfidence: playerIntelligenceConfidenceSchema,
  identityExplanation: z.string().min(1),
  sourceSummary: z.array(z.string()),
  gameFields: z.record(z.string(), z.unknown()).optional()
});
export type PlayerDetailSummary = z.infer<typeof playerDetailSummarySchema>;

export const playerDetailResponseSchema = z.object({
  serverId: z.string().min(1),
  player: playerDetailSummarySchema,
  recentSessions: z.array(playerDetailSessionSchema),
  evidence: z.array(playerDetailEvidenceSchema),
  status: z.string().min(1),
  explanation: z.string().min(1)
});
export type PlayerDetailResponse = z.infer<typeof playerDetailResponseSchema>;

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

export const connectorModeSchema = z.enum(['file', 'journal', 'rest', 'rcon', 'query']);
export type ConnectorMode = z.infer<typeof connectorModeSchema>;

export const connectorHeartbeatStatusSchema = z.enum(['running', 'degraded', 'error']);
export type ConnectorHeartbeatStatus = z.infer<typeof connectorHeartbeatStatusSchema>;

export const connectorHeartbeatSchema = z.object({
  serverId: z.string().min(1),
  game: gameKeySchema,
  connectorMode: connectorModeSchema,
  observedAt: z.string().datetime(),
  status: connectorHeartbeatStatusSchema,
  message: z.string().min(1),
  lastSuccessfulPollAt: z.string().datetime().optional(),
  consecutiveFailureCount: z.number().int().min(0).optional(),
  capabilities: z.array(z.string().min(1)).default([])
});
export type ConnectorHeartbeat = z.infer<typeof connectorHeartbeatSchema>;

export const connectorHeartbeatRequestSchema = connectorHeartbeatSchema;
export type ConnectorHeartbeatRequest = z.infer<typeof connectorHeartbeatRequestSchema>;

export const connectorHeartbeatResponseSchema = z.object({
  ok: z.literal(true),
  accepted: z.literal(true)
});
export type ConnectorHeartbeatResponse = z.infer<typeof connectorHeartbeatResponseSchema>;

export const connectorOperationalStatusSchema = z.enum(['unknown', 'running', 'stale', 'degraded', 'error']);
export type ConnectorOperationalStatus = z.infer<typeof connectorOperationalStatusSchema>;

export const serverOperationalStatusSchema = z.object({
  serverId: z.string().min(1),
  configured: z.boolean(),
  connectorStatus: connectorOperationalStatusSchema,
  lastHeartbeatAt: z.string().datetime().nullable(),
  lastSuccessfulPollAt: z.string().datetime().nullable(),
  explanation: z.string().min(1),
  heartbeatAgeSeconds: z.number().int().min(0).nullable(),
  consecutiveFailureCount: z.number().int().min(0).nullable(),
  connectorMode: connectorModeSchema.nullable(),
  capabilities: z.array(z.string())
});
export type ServerOperationalStatus = z.infer<typeof serverOperationalStatusSchema>;

export const dataFreshnessStatusSchema = z.enum(['live', 'stale', 'historical', 'not_started', 'error']);
export type DataFreshnessStatus = z.infer<typeof dataFreshnessStatusSchema>;

export const dataFreshnessResponseSchema = z.object({
  serverId: z.string().min(1),
  status: dataFreshnessStatusSchema,
  headline: z.string().min(1),
  explanation: z.string().min(1),
  lastHeartbeatAt: z.string().datetime().nullable(),
  heartbeatAgeSeconds: z.number().int().min(0).nullable(),
  lastSuccessfulPollAt: z.string().datetime().nullable(),
  lastEventAt: z.string().datetime().nullable(),
  lastSessionActivityAt: z.string().datetime().nullable(),
  connectorStatus: connectorOperationalStatusSchema,
  confidence: identityConfidenceSchema,
  trustWarnings: z.array(z.string().min(1)),
  recommendedAction: z.string().min(1)
});
export type DataFreshnessResponse = z.infer<typeof dataFreshnessResponseSchema>;

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

export const operatorSignalStatusSchema = z.enum(['ok', 'warning', 'critical', 'unknown']);
export type OperatorSignalStatus = z.infer<typeof operatorSignalStatusSchema>;

export const operatorCommandProbeStatusSchema = z.enum(['available', 'unavailable', 'error']);
export type OperatorCommandProbeStatus = z.infer<typeof operatorCommandProbeStatusSchema>;

export const operatorPm2ProcessSchema = z.object({
  name: z.string().min(1),
  pid: z.number().int().nullable(),
  status: z.string().min(1),
  restarts: z.number().int().min(0),
  uptimeMs: z.number().int().min(0).nullable(),
  memoryBytes: z.number().int().min(0).nullable(),
  cpuPercent: z.number().min(0).nullable()
});
export type OperatorPm2Process = z.infer<typeof operatorPm2ProcessSchema>;

export const operatorPm2StatusSchema = z.object({
  status: operatorCommandProbeStatusSchema,
  processCount: z.number().int().min(0),
  processes: z.array(operatorPm2ProcessSchema),
  message: z.string().min(1).optional()
});
export type OperatorPm2Status = z.infer<typeof operatorPm2StatusSchema>;

export const operatorSystemStatusSchema = z.object({
  uptimeSeconds: z.number().int().min(0),
  loadAverage: z.tuple([z.number(), z.number(), z.number()]),
  cpuCount: z.number().int().min(1),
  memory: z.object({
    totalBytes: z.number().int().min(0),
    freeBytes: z.number().int().min(0),
    usedBytes: z.number().int().min(0),
    usedPercent: z.number().min(0).max(100)
  })
});
export type OperatorSystemStatus = z.infer<typeof operatorSystemStatusSchema>;

export const operatorDiskUsageSchema = z.object({
  label: z.string().min(1),
  status: operatorCommandProbeStatusSchema,
  sizeBytes: z.number().int().min(0).nullable(),
  usedBytes: z.number().int().min(0).nullable(),
  availableBytes: z.number().int().min(0).nullable(),
  usedPercent: z.number().min(0).max(100).nullable(),
  message: z.string().min(1).optional()
});
export type OperatorDiskUsage = z.infer<typeof operatorDiskUsageSchema>;

export const operatorLogSourceSchema = z.object({
  label: z.string().min(1),
  status: z.enum(['available', 'missing', 'unreadable']),
  lines: z.array(z.string()),
  message: z.string().min(1).optional()
});
export type OperatorLogSource = z.infer<typeof operatorLogSourceSchema>;

export const operatorGitRepoStatusSchema = z.object({
  label: z.string().min(1),
  status: operatorCommandProbeStatusSchema,
  branch: z.string().min(1).nullable(),
  upstream: z.string().min(1).nullable().default(null),
  isDirty: z.boolean(),
  ahead: z.number().int().min(0),
  behind: z.number().int().min(0),
  modifiedCount: z.number().int().min(0).default(0),
  stagedCount: z.number().int().min(0).default(0),
  untrackedCount: z.number().int().min(0).default(0),
  changedFilePaths: z.array(z.string()).default([]),
  changes: z.array(z.string()),
  lastCommit: z.object({
    hash: z.string().min(1),
    date: z.string().min(1),
    message: z.string().min(1)
  }).nullable().default(null),
  recommendations: z.array(z.enum([
    'clean',
    'local-changes-review',
    'untracked-files-review',
    'behind-upstream',
    'ahead-of-upstream',
    'detached-head',
    'unavailable'
  ])).default([]),
  message: z.string().min(1).optional()
});
export type OperatorGitRepoStatus = z.infer<typeof operatorGitRepoStatusSchema>;

export const operatorHealthCheckSchema = z.object({
  label: z.string().min(1),
  status: operatorSignalStatusSchema,
  urlConfigured: z.boolean(),
  httpStatus: z.number().int().min(100).max(599).nullable(),
  responseMs: z.number().int().min(0).nullable(),
  message: z.string().min(1).optional()
});
export type OperatorHealthCheck = z.infer<typeof operatorHealthCheckSchema>;

export const operatorContextSchema = z.object({
  generatedAt: z.string().datetime(),
  readOnly: z.literal(true),
  pm2: operatorPm2StatusSchema,
  system: operatorSystemStatusSchema,
  disks: z.array(operatorDiskUsageSchema),
  logs: z.array(operatorLogSourceSchema),
  repos: z.array(operatorGitRepoStatusSchema),
  healthChecks: z.array(operatorHealthCheckSchema),
  collectionWarnings: z.array(z.string().min(1))
});
export type OperatorContext = z.infer<typeof operatorContextSchema>;

export const operatorBriefSchema = z.object({
  generatedAt: z.string().datetime(),
  readOnly: z.literal(true),
  health: operatorSignalStatusSchema,
  summary: z.string().min(1),
  risks: z.array(z.string().min(1)),
  recentEvents: z.array(z.string().min(1)),
  recommendations: z.array(z.string().min(1))
});
export type OperatorBrief = z.infer<typeof operatorBriefSchema>;

export const operatorBriefResponseSchema = operatorBriefSchema;
export type OperatorBriefResponse = z.infer<typeof operatorBriefResponseSchema>;

export const operatorTimelineEventTypeSchema = z.enum([
  'server',
  'deployment',
  'git',
  'disk',
  'pm2',
  'operator'
]);
export type OperatorTimelineEventType = z.infer<typeof operatorTimelineEventTypeSchema>;

export const operatorTimelineEventSeveritySchema = z.enum(['info', 'warning', 'critical']);
export type OperatorTimelineEventSeverity = z.infer<typeof operatorTimelineEventSeveritySchema>;

export const operatorTimelineEventSchema = z.object({
  id: z.string().min(1),
  type: operatorTimelineEventTypeSchema,
  severity: operatorTimelineEventSeveritySchema,
  occurredAt: z.string().datetime(),
  title: z.string().min(1),
  summary: z.string().min(1),
  fingerprint: z.string().min(1),
  metadata: z.record(z.string(), z.string().or(z.number()).or(z.boolean()).or(z.null())).default({})
});
export type OperatorTimelineEvent = z.infer<typeof operatorTimelineEventSchema>;

export const operatorTimelineResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  readOnly: z.literal(true),
  events: z.array(operatorTimelineEventSchema)
});
export type OperatorTimelineResponse = z.infer<typeof operatorTimelineResponseSchema>;

export const operatorDailyBriefConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type OperatorDailyBriefConfidence = z.infer<typeof operatorDailyBriefConfidenceSchema>;

export const operatorDailyBriefSchema = z.object({
  generatedAt: z.string().datetime(),
  readOnly: z.literal(true),
  range: z.object({
    from: z.string().datetime(),
    to: z.string().datetime()
  }),
  headline: z.string().min(1),
  healthSummary: z.string().min(1),
  keyChanges: z.array(z.string().min(1)),
  warnings: z.array(z.string().min(1)),
  recommendations: z.array(z.string().min(1)),
  confidence: operatorDailyBriefConfidenceSchema
});
export type OperatorDailyBrief = z.infer<typeof operatorDailyBriefSchema>;

export const operatorDailyBriefResponseSchema = operatorDailyBriefSchema;
export type OperatorDailyBriefResponse = z.infer<typeof operatorDailyBriefResponseSchema>;

export const operatorChangesSummarySchema = z.object({
  generatedAt: z.string().datetime(),
  readOnly: z.literal(true),
  range: z.object({
    from: z.string().datetime(),
    to: z.string().datetime()
  }),
  headline: z.string().min(1),
  meaningfulChanges: z.array(z.string().min(1)),
  unchangedSignals: z.array(z.string().min(1)),
  newWarnings: z.array(z.string().min(1)),
  resolvedWarnings: z.array(z.string().min(1)),
  recommendedNextAction: z.string().min(1),
  confidence: operatorDailyBriefConfidenceSchema
});
export type OperatorChangesSummary = z.infer<typeof operatorChangesSummarySchema>;

export const operatorChangesSummaryResponseSchema = operatorChangesSummarySchema;
export type OperatorChangesSummaryResponse = z.infer<typeof operatorChangesSummaryResponseSchema>;

export const operatorInsightSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  severity: operatorTimelineEventSeveritySchema,
  confidence: operatorDailyBriefConfidenceSchema,
  evidence: z.array(z.string().min(1)).max(5),
  recommendedAction: z.string().min(1).optional()
});
export type OperatorInsight = z.infer<typeof operatorInsightSchema>;

export const operatorInsightsResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  readOnly: z.literal(true),
  insights: z.array(operatorInsightSchema).min(1).max(5)
});
export type OperatorInsightsResponse = z.infer<typeof operatorInsightsResponseSchema>;

export const operatorAskIntentSchema = z.enum([
  'changes',
  'daily-brief',
  'insights',
  'timeline',
  'current-state',
  'unsupported'
]);
export type OperatorAskIntent = z.infer<typeof operatorAskIntentSchema>;

export const operatorAskSourceSchema = z.enum([
  'daily-brief',
  'changes',
  'insights',
  'timeline',
  'current-state'
]);
export type OperatorAskSource = z.infer<typeof operatorAskSourceSchema>;

export const operatorAskRequestSchema = z.object({
  question: z.string().min(1).max(240)
});
export type OperatorAskRequest = z.infer<typeof operatorAskRequestSchema>;

export const operatorAskResponseSchema = z.object({
  question: z.string().min(1),
  intent: operatorAskIntentSchema,
  headline: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1).max(6),
  confidence: operatorDailyBriefConfidenceSchema,
  source: operatorAskSourceSchema,
  readOnly: z.literal(true)
});
export type OperatorAskResponse = z.infer<typeof operatorAskResponseSchema>;

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

export const palworldHighlightImportanceSchema = z.enum(['high', 'medium', 'low']);
export type PalworldHighlightImportance = z.infer<typeof palworldHighlightImportanceSchema>;

export const palworldHighlightSchema = z.object({
  type: z.string().min(1),
  message: z.string().min(1),
  importance: palworldHighlightImportanceSchema
});
export type PalworldHighlight = z.infer<typeof palworldHighlightSchema>;

export const palworldHighlightsResponseSchema = z.object({
  serverId: z.string().min(1),
  highlights: z.array(palworldHighlightSchema).max(5)
});
export type PalworldHighlightsResponse = z.infer<typeof palworldHighlightsResponseSchema>;

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
export type PalworldManualIdentityLinkAction = z.infer<typeof palworldManualIdentityLinkActionSchema>;

export const palworldIdentityReviewStateSchema = z.enum(['approved', 'rejected', 'unresolved']);
export type PalworldIdentityReviewState = z.infer<typeof palworldIdentityReviewStateSchema>;

export const palworldPlayerSaveArtifactSchema = z.object({
  present: z.boolean(),
  path: z.string().nullable(),
  modifiedAt: z.string().datetime().nullable(),
  sizeBytes: z.number().int().min(0).nullable(),
  parseStatus: z.string().nullable(),
  savePlayerSaveId: z.string().nullable(),
  savePlayerFileName: z.string().nullable()
});
export type PalworldPlayerSaveArtifact = z.infer<typeof palworldPlayerSaveArtifactSchema>;

export const palworldPlayerReviewMetadataSchema = z.object({
  state: palworldIdentityReviewStateSchema,
  savePlayerSaveId: z.string().nullable(),
  savePlayerFileName: z.string().nullable(),
  telemetryLookupKey: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  reviewedBy: z.string().nullable(),
  notes: z.string().default('')
});
export type PalworldPlayerReviewMetadata = z.infer<typeof palworldPlayerReviewMetadataSchema>;

export const palworldSessionTierSchema = z.enum(['short', 'active', 'grinding', 'marathon']);
export type PalworldSessionTier = z.infer<typeof palworldSessionTierSchema>;

export const palworldLevelTierSchema = z.enum(['new', 'mid', 'high', 'elite']);
export type PalworldLevelTier = z.infer<typeof palworldLevelTierSchema>;

export const palworldMilestoneSignalKeySchema = z.enum([
  'entered_elite_level_tier',
  'reached_marathon_session_tier',
  'top_online_level',
  'top_online_session_duration'
]);
export type PalworldMilestoneSignalKey = z.infer<typeof palworldMilestoneSignalKeySchema>;

export const palworldMilestoneSignalStrengthSchema = z.enum(['verified', 'provisional']);
export type PalworldMilestoneSignalStrength = z.infer<typeof palworldMilestoneSignalStrengthSchema>;

export const palworldMilestoneSignalSchema = z.object({
  key: palworldMilestoneSignalKeySchema,
  label: z.string().min(1),
  reason: z.string().min(1),
  strength: palworldMilestoneSignalStrengthSchema
});
export type PalworldMilestoneSignal = z.infer<typeof palworldMilestoneSignalSchema>;

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
export type PalworldMilestoneFeedEntry = z.infer<typeof palworldMilestoneFeedEntrySchema>;

export const palworldMilestoneFeedResponseSchema = z.object({
  serverId: z.string().min(1),
  milestones: z.array(palworldMilestoneFeedEntrySchema)
});
export type PalworldMilestoneFeedResponse = z.infer<typeof palworldMilestoneFeedResponseSchema>;

export const palworldTransitionMilestoneEventTypeSchema = z.enum([
  'PALWORLD_LEVEL_TIER_ENTERED',
  'PALWORLD_SESSION_TIER_ENTERED',
  'PALWORLD_IDENTITY_APPROVED'
]);
export type PalworldTransitionMilestoneEventType = z.infer<typeof palworldTransitionMilestoneEventTypeSchema>;

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
export type PalworldTransitionMilestoneEvent = z.infer<typeof palworldTransitionMilestoneEventSchema>;

export const palworldTransitionMilestoneEventsResponseSchema = z.object({
  serverId: z.string().min(1),
  events: z.array(palworldTransitionMilestoneEventSchema)
});
export type PalworldTransitionMilestoneEventsResponse = z.infer<typeof palworldTransitionMilestoneEventsResponseSchema>;

export const palworldManualTransitionPostActionSchema = z.object({
  serverId: z.string().min(1),
  playerId: z.string().min(1),
  eventType: palworldTransitionMilestoneEventTypeSchema,
  occurredAt: z.string().datetime(),
  fromValue: z.string().nullable().optional(),
  toValue: z.string().nullable().optional()
});
export type PalworldManualTransitionPostAction = z.infer<typeof palworldManualTransitionPostActionSchema>;

export const palworldManualTransitionPostResponseSchema = z.object({
  ok: z.literal(true),
  channelId: z.string().min(1),
  messagePreview: z.string().min(1)
});
export type PalworldManualTransitionPostResponse = z.infer<typeof palworldManualTransitionPostResponseSchema>;

export const palworldPlayerClassificationSchema = z.enum([
  'Core Player',
  'Active Player',
  'New / Light Player'
]);
export type PalworldPlayerClassification = z.infer<typeof palworldPlayerClassificationSchema>;

export const palworldPlayerImpactLevelSchema = z.enum([
  'High Impact',
  'Core',
  'Active',
  'Low'
]);
export type PalworldPlayerImpactLevel = z.infer<typeof palworldPlayerImpactLevelSchema>;

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
export type PalworldPlayerIntelligence = z.infer<typeof palworldPlayerIntelligenceSchema>;

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
export type PalworldUnifiedPlayerProfile = z.infer<typeof palworldUnifiedPlayerProfileSchema>;

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
export type PalworldPlayerProfileSessionSummary = z.infer<typeof palworldPlayerProfileSessionSummarySchema>;

export const palworldPlayerProfileSessionSummariesResponseSchema = z.object({
  serverId: z.string().min(1),
  profiles: z.array(palworldPlayerProfileSessionSummarySchema)
});
export type PalworldPlayerProfileSessionSummariesResponse = z.infer<typeof palworldPlayerProfileSessionSummariesResponseSchema>;

export const palworldGuildActivityRiskLevelSchema = z.enum(['active', 'watch', 'risk', 'expired', 'unknown']);
export type PalworldGuildActivityRiskLevel = z.infer<typeof palworldGuildActivityRiskLevelSchema>;

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
export type PalworldGuildActivityMember = z.infer<typeof palworldGuildActivityMemberSchema>;

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
export type PalworldGuildActivityEntry = z.infer<typeof palworldGuildActivityEntrySchema>;

export const palworldGuildActivityResponseSchema = z.object({
  serverId: z.string().min(1),
  guilds: z.array(palworldGuildActivityEntrySchema)
});
export type PalworldGuildActivityResponse = z.infer<typeof palworldGuildActivityResponseSchema>;

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
