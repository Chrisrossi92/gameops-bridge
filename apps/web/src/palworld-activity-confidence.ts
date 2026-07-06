import type {
  DataFreshnessResponse,
  ObservedSettingsResponse,
  PalworldGuildActivityEntry,
  PalworldLatestPlayerTelemetry,
  PalworldMetricsSummary,
  PalworldMilestoneFeedEntry,
  PalworldTransitionMilestoneEvent,
  ServerHealthSummary,
  ServerOperationalStatus,
  ServerSettingsCapabilitySummary,
  SessionTimelineResponse
} from '@gameops/shared';
import type { WorldChronicleEvent } from './world-memory.ts';

export type PalworldActivityConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface PalworldActivityConfidenceArea {
  name: string;
  confidence: PalworldActivityConfidenceLevel;
  supportingEvidence: string[];
  missingEvidence: string[];
  operatorNote: string;
}

export interface PalworldActivityConfidenceReport {
  overall: PalworldActivityConfidenceArea;
  areas: PalworldActivityConfidenceArea[];
}

export interface BuildPalworldActivityConfidenceInput {
  operationalStatus: ServerOperationalStatus;
  dataFreshness: DataFreshnessResponse;
  serverHealth: ServerHealthSummary;
  settingsCapabilities: ServerSettingsCapabilitySummary;
  observedSettings: ObservedSettingsResponse | null;
  latestPlayers: PalworldLatestPlayerTelemetry[];
  sessionTimeline: SessionTimelineResponse;
  guildActivity: PalworldGuildActivityEntry[];
  hasBaseTelemetry: boolean;
  recentMetrics: PalworldMetricsSummary[];
  chronicleEvents: WorldChronicleEvent[];
  worldHistoryUsesPreview: boolean;
  milestoneFeed: PalworldMilestoneFeedEntry[];
  transitionEvents: PalworldTransitionMilestoneEvent[];
}

function readableSettingsCount(observedSettings: ObservedSettingsResponse | null): number {
  return observedSettings?.available
    ? observedSettings.groups.reduce((sum, group) => sum + group.settings.length, 0)
    : 0;
}

function area(input: PalworldActivityConfidenceArea): PalworldActivityConfidenceArea {
  return input;
}

function levelScore(level: PalworldActivityConfidenceLevel): number {
  if (level === 'high') {
    return 3;
  }

  if (level === 'medium') {
    return 2;
  }

  if (level === 'low') {
    return 1;
  }

  return 0;
}

function buildServerReachability(input: BuildPalworldActivityConfidenceInput): PalworldActivityConfidenceArea {
  const evidence: string[] = [];
  const missing: string[] = [];

  if (input.operationalStatus.connectorStatus === 'running') {
    evidence.push('Connector healthy');
  } else if (input.operationalStatus.connectorStatus === 'stale') {
    missing.push('Connector heartbeat is stale');
  } else if (input.operationalStatus.connectorStatus === 'error' || input.operationalStatus.connectorStatus === 'degraded') {
    missing.push('Connector is not healthy');
  } else {
    missing.push('Connector state is unknown');
  }

  if (input.dataFreshness.status === 'live') {
    evidence.push('REST responding');
  } else if (input.dataFreshness.status === 'stale') {
    missing.push('REST data is stale');
  } else if (input.dataFreshness.status === 'error') {
    missing.push('REST data has an error');
  } else {
    missing.push('REST freshness is not live');
  }

  if (input.serverHealth.telemetryHealth.status === 'healthy') {
    evidence.push('Telemetry health is healthy');
  } else {
    missing.push(input.serverHealth.telemetryHealth.explanation);
  }

  const confidence: PalworldActivityConfidenceLevel = input.operationalStatus.connectorStatus === 'running'
    && input.dataFreshness.status === 'live'
    && input.serverHealth.telemetryHealth.status === 'healthy'
    ? 'high'
    : input.operationalStatus.connectorStatus === 'error' || input.dataFreshness.status === 'error'
      ? 'low'
      : evidence.length > 0 ? 'medium' : 'unknown';

  return area({
    name: 'Server Reachability',
    confidence,
    supportingEvidence: evidence,
    missingEvidence: missing,
    operatorNote: confidence === 'high'
      ? 'The server is reachable through the current GameOps telemetry path.'
      : 'Reachability should be treated carefully until the missing evidence clears.'
  });
}

function buildSettingsConfidence(input: BuildPalworldActivityConfidenceInput): PalworldActivityConfidenceArea {
  const count = readableSettingsCount(input.observedSettings);
  const evidence: string[] = [];
  const missing: string[] = [];

  if (input.settingsCapabilities.canReadSettings === 'yes' && count > 0) {
    evidence.push(`${count} readable settings loaded`);
  } else if (input.settingsCapabilities.canReadSettings === 'yes') {
    missing.push('Settings read path exists, but no setting values are loaded');
  } else if (input.settingsCapabilities.canReadSettings === 'no') {
    missing.push('Settings are not readable from the current connector state');
  } else {
    missing.push('Settings read confidence is unknown');
  }

  if (input.settingsCapabilities.lastSettingsSnapshotAt) {
    evidence.push('Settings snapshot is available');
  } else {
    missing.push('No settings snapshot timestamp is available');
  }

  const confidence: PalworldActivityConfidenceLevel = input.settingsCapabilities.canReadSettings === 'yes' && count > 0 && Boolean(input.settingsCapabilities.lastSettingsSnapshotAt)
    ? 'high'
    : input.settingsCapabilities.canReadSettings === 'yes' ? 'medium'
      : input.settingsCapabilities.canReadSettings === 'no' ? 'low'
        : 'unknown';

  return area({
    name: 'Settings Confidence',
    confidence,
    supportingEvidence: evidence,
    missingEvidence: missing,
    operatorNote: confidence === 'high'
      ? 'Settings are reliable enough for read-only review and preset previews.'
      : 'Do not treat settings as verified until readable values and a snapshot exist.'
  });
}

function buildPlayerTracking(input: BuildPalworldActivityConfidenceInput): PalworldActivityConfidenceArea {
  const evidence: string[] = [];
  const missing: string[] = [];

  if (input.latestPlayers.length > 0) {
    evidence.push(`${input.latestPlayers.length} player telemetry records loaded`);
  } else {
    missing.push('No player telemetry records are loaded in this view');
  }

  if (input.dataFreshness.status === 'live') {
    evidence.push('Live player polling');
  } else {
    missing.push(`Player polling is ${input.dataFreshness.status}`);
  }

  const confidence: PalworldActivityConfidenceLevel = input.latestPlayers.length > 0 && input.dataFreshness.status === 'live'
    ? 'high'
    : input.dataFreshness.status === 'live' ? 'medium'
      : input.latestPlayers.length > 0 ? 'medium'
        : input.dataFreshness.status === 'error' ? 'low'
          : 'unknown';

  return area({
    name: 'Player Tracking',
    confidence,
    supportingEvidence: evidence,
    missingEvidence: missing,
    operatorNote: confidence === 'high'
      ? 'Player tracking is active from current telemetry.'
      : 'Player activity may be incomplete until polling and records are both present.'
  });
}

function buildSessionTracking(input: BuildPalworldActivityConfidenceInput): PalworldActivityConfidenceArea {
  const evidence: string[] = [];
  const missing: string[] = [];

  if (input.sessionTimeline.sessions.length > 0) {
    evidence.push(`${input.sessionTimeline.sessions.length} session timeline records loaded`);
  } else {
    missing.push('No session timeline records are loaded');
  }

  if (!input.serverHealth.sessionHealth.stale && input.serverHealth.sessionHealth.status === 'healthy') {
    evidence.push('Session continuity is current');
  } else if (input.serverHealth.sessionHealth.stale) {
    missing.push('Session continuity is stale');
  } else {
    missing.push(input.serverHealth.sessionHealth.explanation);
  }

  const confidence: PalworldActivityConfidenceLevel = input.sessionTimeline.sessions.length > 0
    && input.serverHealth.sessionHealth.status === 'healthy'
    && !input.serverHealth.sessionHealth.stale
    ? 'high'
    : input.sessionTimeline.sessions.length > 0 ? 'medium'
      : input.serverHealth.sessionHealth.status === 'unhealthy' ? 'low'
        : 'unknown';

  return area({
    name: 'Session Tracking',
    confidence,
    supportingEvidence: evidence,
    missingEvidence: missing,
    operatorNote: confidence === 'high'
      ? 'Session tracking is reliable for current operations review.'
      : 'Session continuity should be considered uncertain.'
  });
}

function buildGuildIntelligence(input: BuildPalworldActivityConfidenceInput): PalworldActivityConfidenceArea {
  return input.guildActivity.length > 0
    ? area({
      name: 'Guild Intelligence',
      confidence: 'high',
      supportingEvidence: [`${input.guildActivity.length} guild activity records loaded`, 'Guild data available'],
      missingEvidence: [],
      operatorNote: 'Guild intelligence is backed by existing read-only telemetry.'
    })
    : area({
      name: 'Guild Intelligence',
      confidence: 'unknown',
      supportingEvidence: [],
      missingEvidence: ['No guild telemetry is loaded'],
      operatorNote: 'Guild trust is unknown until GameOps has guild evidence.'
    });
}

function buildBaseTelemetry(input: BuildPalworldActivityConfidenceInput): PalworldActivityConfidenceArea {
  return input.hasBaseTelemetry
    ? area({
      name: 'Base Telemetry',
      confidence: 'medium',
      supportingEvidence: ['Base telemetry available'],
      missingEvidence: ['Base data is parser-derived and should be treated as read-only confidence evidence'],
      operatorNote: 'Base telemetry can inform operations, but it is not a live server control signal.'
    })
    : area({
      name: 'Base Telemetry',
      confidence: 'unknown',
      supportingEvidence: [],
      missingEvidence: ['No base telemetry is loaded'],
      operatorNote: 'Base confidence is unknown until the parser reports base signals.'
    });
}

function buildWorldHistory(input: BuildPalworldActivityConfidenceInput): PalworldActivityConfidenceArea {
  if (input.chronicleEvents.length > 0 && !input.worldHistoryUsesPreview) {
    return area({
      name: 'World History',
      confidence: 'high',
      supportingEvidence: [`${input.chronicleEvents.length} trusted Chronicle entries loaded`, 'Chronicle recording', 'No estimated events'],
      missingEvidence: [],
      operatorNote: 'World history is backed by trusted Chronicle and World Memory records.'
    });
  }

  if (input.worldHistoryUsesPreview) {
    return area({
      name: 'World History',
      confidence: 'low',
      supportingEvidence: [],
      missingEvidence: ['World History is currently showing preview history instead of trusted records'],
      operatorNote: 'Do not treat preview history as current server truth.'
    });
  }

  return area({
    name: 'World History',
    confidence: 'unknown',
    supportingEvidence: [],
    missingEvidence: ['No trusted Chronicle entries are loaded'],
    operatorNote: 'World history confidence is unknown until trusted records exist.'
  });
}

function buildMilestoneRecording(input: BuildPalworldActivityConfidenceInput): PalworldActivityConfidenceArea {
  const milestoneCount = input.milestoneFeed.length + input.transitionEvents.length;

  if (milestoneCount > 0) {
    return area({
      name: 'Milestone Recording',
      confidence: 'high',
      supportingEvidence: [`${milestoneCount} milestone signals loaded`, 'Milestone recording'],
      missingEvidence: [],
      operatorNote: 'Milestone signals are available for read-only review.'
    });
  }

  if (input.recentMetrics.length > 0 || input.latestPlayers.length > 0) {
    return area({
      name: 'Milestone Recording',
      confidence: 'medium',
      supportingEvidence: ['Telemetry is available for milestone checks'],
      missingEvidence: ['No milestone signals are currently loaded'],
      operatorNote: 'Milestone recording may be quiet because no player has crossed a tracked threshold.'
    });
  }

  return area({
    name: 'Milestone Recording',
    confidence: 'unknown',
    supportingEvidence: [],
    missingEvidence: ['No telemetry or milestone signals are loaded'],
    operatorNote: 'Milestone confidence is unknown until telemetry appears.'
  });
}

function buildOverall(areas: PalworldActivityConfidenceArea[]): PalworldActivityConfidenceArea {
  const server = areas.find((item) => item.name === 'Server Reachability');
  const lowCount = areas.filter((item) => item.confidence === 'low').length;
  const unknownCount = areas.filter((item) => item.confidence === 'unknown').length;
  const average = areas.reduce((sum, item) => sum + levelScore(item.confidence), 0) / Math.max(1, areas.length);
  const strongEvidence = areas
    .filter((item) => item.confidence === 'high')
    .flatMap((item) => item.supportingEvidence.slice(0, 1));
  const missingEvidence = areas
    .filter((item) => item.confidence === 'low' || item.confidence === 'unknown')
    .flatMap((item) => item.missingEvidence.slice(0, 1));
  const confidence: PalworldActivityConfidenceLevel = server?.confidence === 'unknown'
    ? 'unknown'
    : server?.confidence === 'low'
      ? 'low'
      : lowCount === 0 && unknownCount === 0 && average >= 2.5
        ? 'high'
        : average >= 1.5 ? 'medium'
          : lowCount > 0 ? 'low' : 'unknown';

  return area({
    name: 'Overall Operations Confidence',
    confidence,
    supportingEvidence: strongEvidence.slice(0, 5),
    missingEvidence: missingEvidence.slice(0, 4),
    operatorNote: confidence === 'high'
      ? 'The current Palworld operations view is well supported by existing telemetry.'
      : confidence === 'medium'
        ? 'Most operations data is useful, but at least one confidence area needs attention.'
        : confidence === 'low'
          ? 'Use caution. Important operations evidence is weak or missing.'
          : 'GameOps does not have enough evidence to rate operations confidence yet.'
  });
}

export function buildPalworldActivityConfidenceReport(
  input: BuildPalworldActivityConfidenceInput
): PalworldActivityConfidenceReport {
  const areas = [
    buildServerReachability(input),
    buildSettingsConfidence(input),
    buildPlayerTracking(input),
    buildSessionTracking(input),
    buildGuildIntelligence(input),
    buildBaseTelemetry(input),
    buildWorldHistory(input),
    buildMilestoneRecording(input)
  ];

  return {
    overall: buildOverall(areas),
    areas
  };
}
