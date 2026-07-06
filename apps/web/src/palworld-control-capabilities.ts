import type {
  ObservedSettingsResponse,
  PalworldGuildActivityEntry,
  PalworldLatestPlayerTelemetry,
  PalworldMetricsSummary,
  PalworldMilestoneFeedEntry,
  PalworldRuntimeAudit,
  PalworldTransitionMilestoneEvent,
  ServerHealthSummary,
  ServerSettingsCapabilitySummary,
  SessionTimelineResponse
} from '@gameops/shared';

export type PalworldControlCapabilityGroup =
  | 'Server status'
  | 'Settings'
  | 'Players / sessions'
  | 'Guilds'
  | 'Server lifecycle'
  | 'Admin messaging'
  | 'Moderation'
  | 'Items'
  | 'Pals'
  | 'Teleport'
  | 'Bases'
  | 'Inventories'
  | 'Milestones / telemetry';

export type PalworldControlCapabilityStatus = 'verified' | 'unsupported' | 'unknown' | 'planned';
export type PalworldControlCapabilityConfidence = 'high' | 'medium' | 'low' | 'unknown';

export interface PalworldControlCapability {
  group: PalworldControlCapabilityGroup;
  name: string;
  status: PalworldControlCapabilityStatus;
  confidence: PalworldControlCapabilityConfidence;
  evidenceSummary: string;
  lastVerifiedAt: string | null;
  operatorNote: string;
}

export interface PalworldControlCapabilitySection {
  group: PalworldControlCapabilityGroup;
  capabilities: PalworldControlCapability[];
}

export interface BuildPalworldControlCapabilitiesInput {
  serverName: string;
  serverState: string;
  serverHealth: ServerHealthSummary;
  settingsCapabilities: ServerSettingsCapabilitySummary;
  observedSettings: ObservedSettingsResponse | null;
  runtimeAudit: PalworldRuntimeAudit | null;
  latestPlayers: PalworldLatestPlayerTelemetry[];
  sessionTimeline: SessionTimelineResponse;
  guildActivity: PalworldGuildActivityEntry[];
  recentMetrics: PalworldMetricsSummary[];
  milestoneFeed: PalworldMilestoneFeedEntry[];
  transitionEvents: PalworldTransitionMilestoneEvent[];
  hasBaseTelemetry: boolean;
}

const GROUP_ORDER: PalworldControlCapabilityGroup[] = [
  'Server status',
  'Settings',
  'Players / sessions',
  'Guilds',
  'Server lifecycle',
  'Admin messaging',
  'Moderation',
  'Items',
  'Pals',
  'Teleport',
  'Bases',
  'Inventories',
  'Milestones / telemetry'
];

function verifiedCapability(input: Omit<PalworldControlCapability, 'status'>): PalworldControlCapability {
  return {
    ...input,
    status: 'verified'
  };
}

function plannedCapability(input: Omit<PalworldControlCapability, 'status' | 'confidence' | 'lastVerifiedAt'>): PalworldControlCapability {
  return {
    ...input,
    status: 'planned',
    confidence: 'low',
    lastVerifiedAt: null
  };
}

function unknownCapability(input: Omit<PalworldControlCapability, 'status' | 'confidence' | 'lastVerifiedAt'>): PalworldControlCapability {
  return {
    ...input,
    status: 'unknown',
    confidence: 'unknown',
    lastVerifiedAt: null
  };
}

function unsupportedCapability(input: Omit<PalworldControlCapability, 'status' | 'confidence' | 'lastVerifiedAt'>): PalworldControlCapability {
  return {
    ...input,
    status: 'unsupported',
    confidence: 'medium',
    lastVerifiedAt: null
  };
}

function lastPlayerSeen(players: PalworldLatestPlayerTelemetry[]): string | null {
  return players
    .map((player) => player.lastSeenAt)
    .sort()
    .at(-1) ?? null;
}

function latestMetricAt(metrics: PalworldMetricsSummary[]): string | null {
  return metrics
    .map((metric) => metric.observedAt)
    .sort()
    .at(-1) ?? null;
}

export function buildPalworldControlCapabilitySections(
  input: BuildPalworldControlCapabilitiesInput
): PalworldControlCapabilitySection[] {
  const observedSettingsCount = input.observedSettings?.available
    ? input.observedSettings.groups.reduce((sum, group) => sum + group.settings.length, 0)
    : 0;
  const latestPlayerSeenAt = lastPlayerSeen(input.latestPlayers);
  const latestMetricSeenAt = latestMetricAt(input.recentMetrics);
  const milestoneSignals = input.milestoneFeed.length + input.transitionEvents.length;

  const capabilities: PalworldControlCapability[] = [
    verifiedCapability({
      group: 'Server status',
      name: 'Read server status',
      confidence: input.serverHealth.telemetry.status === 'live' ? 'high' : 'medium',
      evidenceSummary: `Dashboard receives ${input.serverState} state and server health for ${input.serverName}.`,
      lastVerifiedAt: input.serverHealth.generatedAt,
      operatorNote: 'Read-only status is available. This does not control the server.'
    }),
    input.settingsCapabilities.canReadSettings === 'yes' && observedSettingsCount > 0
      ? verifiedCapability({
        group: 'Settings',
        name: 'Read current settings',
        confidence: 'high',
        evidenceSummary: `${observedSettingsCount} readable Palworld settings are available from ${input.settingsCapabilities.readSource}.`,
        lastVerifiedAt: input.settingsCapabilities.lastSettingsSnapshotAt,
        operatorNote: 'Settings can be inspected and used for preview planning.'
      })
      : unknownCapability({
        group: 'Settings',
        name: 'Read current settings',
        evidenceSummary: 'No readable settings snapshot is available yet.',
        operatorNote: 'Wait for a settings snapshot before claiming this is verified.'
      }),
    plannedCapability({
      group: 'Settings',
      name: 'Change settings',
      evidenceSummary: 'GameOps has preview and draft plan screens, but no server-change method is implemented.',
      operatorNote: 'Future work needs double confirmation, backup, change, restart decision, and verification.'
    }),
    verifiedCapability({
      group: 'Players / sessions',
      name: 'Read players',
      confidence: input.latestPlayers.length > 0 ? 'high' : 'medium',
      evidenceSummary: `${input.latestPlayers.length} Palworld player telemetry records are loaded.`,
      lastVerifiedAt: latestPlayerSeenAt ?? input.serverHealth.generatedAt,
      operatorNote: 'Player telemetry is read-only and may be empty when nobody has reported recently.'
    }),
    verifiedCapability({
      group: 'Players / sessions',
      name: 'Track sessions',
      confidence: input.serverHealth.sessionHealth.stale ? 'medium' : 'high',
      evidenceSummary: `${input.sessionTimeline.sessions.length} timeline sessions loaded; ${input.serverHealth.sessionHealth.activeSessions} active now.`,
      lastVerifiedAt: input.serverHealth.generatedAt,
      operatorNote: input.serverHealth.sessionHealth.stale
        ? 'Session data is available, but current freshness needs attention.'
        : 'Session tracking is available from read-only telemetry.'
    }),
    input.guildActivity.length > 0
      ? verifiedCapability({
        group: 'Guilds',
        name: 'Read guilds',
        confidence: 'high',
        evidenceSummary: `${input.guildActivity.length} guild activity records are loaded.`,
        lastVerifiedAt: input.guildActivity.map((guild) => guild.lastMemberSeenAt).filter(Boolean).sort().at(-1) ?? input.serverHealth.generatedAt,
        operatorNote: 'Guild activity is read-only and comes from existing telemetry/parsing.'
      })
      : unknownCapability({
        group: 'Guilds',
        name: 'Read guilds',
        evidenceSummary: 'No guild activity records are loaded for this server view.',
        operatorNote: 'Do not claim guild control until GameOps has direct guild evidence.'
      }),
    plannedCapability({
      group: 'Server lifecycle',
      name: 'Restart server',
      evidenceSummary: 'No restart control is implemented or exposed in the dashboard.',
      operatorNote: 'Restart planning must stay manual until GameOps can verify the command and recovery checks.'
    }),
    unknownCapability({
      group: 'Admin messaging',
      name: 'Send admin message',
      evidenceSummary: 'No verified Palworld server broadcast or chat message capability is exposed.',
      operatorNote: 'Milestone posting is separate from live server admin messaging.'
    }),
    unsupportedCapability({
      group: 'Moderation',
      name: 'Kick or ban player',
      evidenceSummary: 'No moderation endpoint or dashboard control exists in GameOps.',
      operatorNote: 'Treat moderation as unavailable until a safe, audited path exists.'
    }),
    unknownCapability({
      group: 'Items',
      name: 'Spawn item',
      evidenceSummary: 'No item spawning evidence exists in GameOps.',
      operatorNote: 'The Palworld server may support actions GameOps has not verified.'
    }),
    unknownCapability({
      group: 'Pals',
      name: 'Spawn pal',
      evidenceSummary: 'No Pal spawning evidence exists in GameOps.',
      operatorNote: 'Keep this unknown until GameOps proves it directly.'
    }),
    unknownCapability({
      group: 'Teleport',
      name: 'Teleport player',
      evidenceSummary: 'No teleport evidence exists in GameOps.',
      operatorNote: 'No operator teleport controls should be exposed.'
    }),
    input.hasBaseTelemetry
      ? verifiedCapability({
        group: 'Bases',
        name: 'Read base telemetry',
        confidence: 'medium',
        evidenceSummary: 'Base capacity signals are visible from the Palworld parser.',
        lastVerifiedAt: input.serverHealth.generatedAt,
        operatorNote: 'This is read-only base visibility, not base control.'
      })
      : unknownCapability({
        group: 'Bases',
        name: 'Read base telemetry',
        evidenceSummary: 'No base telemetry is loaded in this view.',
        operatorNote: 'Base control is not verified.'
      }),
    unknownCapability({
      group: 'Inventories',
      name: 'Read or change inventories',
      evidenceSummary: 'No inventory capability evidence exists in GameOps.',
      operatorNote: 'Do not expose inventory controls without a verified safe path.'
    }),
    input.recentMetrics.length > 0 || milestoneSignals > 0
      ? verifiedCapability({
        group: 'Milestones / telemetry',
        name: 'Read milestones and telemetry',
        confidence: input.recentMetrics.length > 0 ? 'high' : 'medium',
        evidenceSummary: `${input.recentMetrics.length} metric snapshots and ${milestoneSignals} milestone signals are loaded.`,
        lastVerifiedAt: latestMetricSeenAt ?? input.serverHealth.generatedAt,
        operatorNote: 'Milestone and telemetry views are read-only.'
      })
      : unknownCapability({
        group: 'Milestones / telemetry',
        name: 'Read milestones and telemetry',
        evidenceSummary: 'No Palworld metrics or milestone signals are loaded yet.',
        operatorNote: 'Wait for telemetry before marking this verified.'
      })
  ];

  return GROUP_ORDER.map((group) => ({
    group,
    capabilities: capabilities.filter((capability) => capability.group === group)
  }));
}
