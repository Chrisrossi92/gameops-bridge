import type {
  ActivityLogItem,
  CommunityActivityResponse,
  ConfiguredServersResponse,
  DataFreshnessResponse,
  EventTemplateDraftCatalog,
  NormalizedEvent,
  ObservedSettingsResponse,
  PalworldBackupReadiness,
  PalworldConfigAudit,
  PalworldLatestPlayerTelemetry,
  PalworldMetricsSummary,
  PalworldRuntimeAudit,
  PlayerActivityCaptureVerification,
  PlayerEngagementSummary,
  PlayerIntelligenceRecord,
  PlayerIntelligenceSummaryResponse,
  ServerAliveRhythmSummary,
  ServerHealthSummary,
  ServerOperationalStatus,
  ServerSettingsCapabilitySummary,
  SessionTimelineResponse
} from '@gameops/shared';

export interface KnownPlayerEntry {
  displayName: string;
  normalizedPlayerKey: string;
  confidence: 'low' | 'medium' | 'high';
  firstSeenAt: string;
  lastSeenAt: string;
  observationCount: number;
}

export interface ServerOption {
  id: string;
  displayName: string;
  game: ConfiguredServersResponse['servers'][number]['game'];
}

export interface ServerSummary {
  serverId: string;
  displayName: string;
  game: ServerOption['game'];
  reportedState: 'online' | 'offline' | 'starting' | 'stopping' | 'restarting' | 'degraded';
  state: 'online' | 'offline' | 'starting' | 'stopping' | 'restarting' | 'degraded';
  statusMessage?: string;
  operationalStatus: ServerOperationalStatus;
  dataFreshness: DataFreshnessResponse;
  activePlayers: number;
  knownPlayerCount: number;
  recentEvents: NormalizedEvent[];
  recentWarnings: NormalizedEvent[];
  activityLog: ActivityLogItem[];
  playerIntelligence: PlayerIntelligenceRecord[];
  playerIntelligenceExplanation: string;
  playerIntelligenceSummary: PlayerIntelligenceSummaryResponse;
  playerActivityCapture: PlayerActivityCaptureVerification;
  playerEngagement: PlayerEngagementSummary;
  communityActivity: CommunityActivityResponse;
  serverAliveRhythm: ServerAliveRhythmSummary;
  serverHealth: ServerHealthSummary;
  settingsCapabilities: ServerSettingsCapabilitySummary;
  observedSettings: ObservedSettingsResponse | null;
  eventTemplateDrafts: EventTemplateDraftCatalog;
  palworldConfigAudit: PalworldConfigAudit | null;
  palworldBackupReadiness: PalworldBackupReadiness | null;
  palworldRuntimeAudit: PalworldRuntimeAudit | null;
  sessionTimeline: SessionTimelineResponse;
  knownPlayers: KnownPlayerEntry[];
  palworldLatestPlayers: PalworldLatestPlayerTelemetry[];
  palworldRecentMetrics: PalworldMetricsSummary[];
}

export type DashboardTab = 'overview' | 'players' | 'settings' | 'backups' | 'history' | 'capabilities';

export interface WorldCard {
  server: ServerOption;
  summary: ServerSummary | undefined;
}
