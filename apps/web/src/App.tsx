import {
  activityLogResponseSchema,
  activeSessionsResponseSchema,
  communityActivityResponseSchema,
  configuredServersResponseSchema,
  dataFreshnessResponseSchema,
  eventTemplateDraftCatalogSchema,
  eventTemplateConfigDiffPreviewSchema,
  eventTemplateManualEditPlanSchema,
  eventTemplateManualChangeChecklistSchema,
  knownPlayerProfileResponseSchema,
  knownPlayersResponseSchema,
  observedSettingsResponseSchema,
  operatorChangesSummaryResponseSchema,
  operatorDailyBriefResponseSchema,
  operatorInsightsResponseSchema,
  operatorMemoryIndexResponseSchema,
  operatorBriefResponseSchema,
  operatorTimelineResponseSchema,
  palworldBackupReadinessSchema,
  palworldIdentityApprovalsResponseSchema,
  palworldIdentityLinksResponseSchema,
  palworldGuildActivityResponseSchema,
  palworldConfigAuditSchema,
  palworldRuntimeAuditSchema,
  palworldLatestPlayersResponseSchema,
  palworldMilestoneFeedResponseSchema,
  palworldMetricsSummariesResponseSchema,
  palworldPlayerSnapshotsResponseSchema,
  palworldPlayerProfileSessionSummariesResponseSchema,
  playerEngagementDetailSchema,
  playerEngagementSummarySchema,
  playerActivityCaptureVerificationSchema,
  playerIntelligenceResponseSchema,
  playerIntelligenceSummaryResponseSchema,
  playerDetailResponseSchema,
  serverAliveRhythmSummarySchema,
  serverHealthSummarySchema,
  serverSettingsCapabilitySummarySchema,
  sessionTimelineResponseSchema,
  palworldTransitionMilestoneEventsResponseSchema,
  palworldUnifiedPlayerProfileSchema,
  recentEventsResponseSchema,
  serverStatusSchema,
  serverOperationalStatusSchema,
  type ConfiguredServersResponse,
  type ActivityLogItem,
  type CommunityActivityResponse,
  type DataFreshnessResponse,
  type EventTemplateDraftCatalog,
  type EventTemplateConfigDiffPreview,
  type EventTemplateManualEditPlan,
  type EventTemplateManualChangeChecklist,
  type ServerOperationalStatus,
  type PalworldGuildActivityEntry,
  type PalworldGuildActivityMember,
  type PalworldConfigAudit,
  type PalworldRuntimeAudit,
  type KnownPlayerProfileResponse,
  type NormalizedEvent,
  type ObservedSettingsResponse,
  type OperatorChangesSummaryResponse,
  type OperatorDailyBriefResponse,
  type OperatorInsightsResponse,
  type OperatorMemoryIndexResponse,
  type OperatorBriefResponse,
  type OperatorTimelineEvent,
  type PalworldBackupReadiness,
  type PalworldApprovedIdentity,
  type PalworldIdentityLinkCandidate,
  type PalworldIdentityLinkFailure,
  type PalworldLatestPlayerTelemetry,
  type PalworldManualTransitionPostResponse,
  type PalworldMilestoneFeedEntry,
  type PalworldMetricsSummary,
  type PalworldPlayerProfileSessionSummary,
  type PalworldPlayerSnapshot,
  type PlayerIntelligenceRecord,
  type PlayerIntelligenceSummaryResponse,
  type PlayerEngagementDetail,
  type PlayerEngagementSummary,
  type PlayerActivityCaptureVerification,
  type PlayerDetailResponse,
  type ServerAliveRhythmSummary,
  type ServerHealthSummary,
  type ServerSettingsCapabilitySummary,
  type SessionRecord,
  type SessionTimelineItem,
  type SessionTimelineResponse,
  type PalworldRejectedIdentity,
  type PalworldTransitionMilestoneEvent,
  type PalworldUnifiedPlayerProfile,
  type WorldEvent
} from '@gameops/shared';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { resolveApiBaseUrl } from './api-base-url.ts';
import { OperatorWorkspace } from './operator-workspace.tsx';
import { WorldEventDetailDrawer, WorldEventRenderer } from './world-event-renderer.tsx';
import {
  createWorldEventRegistry,
  worldEventPreviewEvents,
  worldEventsToChronicleEntries,
  worldMemoryChronicleToWorldEvents
} from './world-events.ts';
import {
  createWorldMemoryRegistry,
  getGuildConfidence,
  getPalworldBaseLifecycleState,
  getPalworldGuildActivityState,
  getPalworldGuildIntelligenceFromMemory,
  getValheimCharactersFromMemory,
  searchWorldMemoryRecords,
  type PalworldGuildIntelligence,
  type ValheimCharacterEntry,
  type WorldChronicleEvent,
  type WorldChronicleEventKind,
  type WorldMemoryDetailModel,
  type WorldMemoryRecord,
  type WorldMemoryRecordType,
  type WorldMemoryRelationship
} from './world-memory.ts';
import './App.css';

interface HealthResponse {
  ok: boolean;
  service: string;
  timestamp: string;
}

interface KnownPlayerEntry {
  displayName: string;
  normalizedPlayerKey: string;
  confidence: 'low' | 'medium' | 'high';
  firstSeenAt: string;
  lastSeenAt: string;
  observationCount: number;
}

interface ServerOption {
  id: string;
  displayName: string;
  game: ConfiguredServersResponse['servers'][number]['game'];
}

interface ServerSummary {
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
  eventTemplateDrafts: EventTemplateDraftCatalog;
  palworldConfigAudit: PalworldConfigAudit | null;
  palworldBackupReadiness: PalworldBackupReadiness | null;
  palworldRuntimeAudit: PalworldRuntimeAudit | null;
  sessionTimeline: SessionTimelineResponse;
  knownPlayers: KnownPlayerEntry[];
  palworldLatestPlayers: PalworldLatestPlayerTelemetry[];
  palworldRecentMetrics: PalworldMetricsSummary[];
}

const OPTIONAL_DASHBOARD_FETCH_TIMEOUT_MS = 5_000;

async function fetchOptionalDashboardResource(url: string): Promise<Response | null> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(OPTIONAL_DASHBOARD_FETCH_TIMEOUT_MS) });
  } catch {
    return null;
  }
}

type WarningCategory = 'network' | 'disconnect' | 'save_storage' | 'general';
type GameFilter = 'all' | ConfiguredServersResponse['servers'][number]['game'];

interface WarningSummaryEntry {
  category: WarningCategory;
  snippet: string;
  latestAt: string;
  count: number;
  signature: string;
}

type PalworldIdentityListState = 'approved' | 'candidate' | 'unresolved' | 'rejected';

interface PalworldPlayerListEntry {
  player: PalworldLatestPlayerTelemetry;
  identityState: PalworldIdentityListState;
}

type PalworldReviewAction = 'approve' | 'reject';

interface PalworldGuildHint {
  guildName?: string | null;
  guildId?: string | null;
  memberCount?: number | null;
  members?: string[] | null;
}

type GuildRiskLevel = 'active' | 'watch' | 'risk' | 'expired' | 'unknown';
type GuildActivityFilter = 'all' | 'at-risk' | 'missing-activity' | 'low-confidence' | 'reviewed';

interface PalworldNextAction {
  label: string;
  cta: string;
  targetTab: DashboardTab;
}

interface PlayerProfileCardProps {
  profile: PalworldPlayerProfileSessionSummary;
}

function getProfileDisplayName(profile: PalworldPlayerProfileSessionSummary): string {
  return profile.playerName ?? profile.accountName ?? 'Unknown player';
}

function formatSaveLinkLabel(isPresent: boolean): string {
  return isPresent ? 'Save linked' : 'Save link needed';
}

interface PlayerRowProps extends PlayerProfileCardProps {
  onDetails: () => void;
}

function OnlinePlayerRow({ profile, onDetails }: PlayerRowProps) {
  return (
    <li className="homepage-player-row homepage-player-row-interactive">
      <div className="homepage-player-main">
        <div className="homepage-player-title">
          <span className="homepage-player-name">{getProfileDisplayName(profile)}</span>
          <span className="homepage-online-badge">online</span>
        </div>
        <div className="homepage-player-meta">
          <span>current session {formatDurationMaybe(profile.currentSessionDurationSeconds ?? undefined)}</span>
          {profile.inferredGuildName ? <span>{profile.inferredGuildName}</span> : null}
        </div>
      </div>
      {profile.profile.level !== null ? <span className="homepage-player-level">lvl {profile.profile.level}</span> : null}
      <button type="button" className="homepage-player-detail-button" onClick={onDetails}>Details</button>
    </li>
  );
}

interface TopPlayerRowProps {
  profile: PalworldPlayerProfileSessionSummary;
  rank: number;
}

interface TopPlayerRowWithDetailsProps extends TopPlayerRowProps {
  onDetails: () => void;
}

function TopPlayerRow({ profile, rank, onDetails }: TopPlayerRowWithDetailsProps) {
  return (
    <li className="homepage-player-row homepage-player-row-interactive">
      <span className="homepage-player-rank">{rank}</span>
      <div className="homepage-player-main">
        <div className="homepage-player-title">
          <span className="homepage-player-name">{getProfileDisplayName(profile)}</span>
          {profile.profile.level !== null ? <span className="homepage-player-level">lvl {profile.profile.level}</span> : null}
        </div>
        <div className="homepage-player-meta">
          <span>{formatDurationFromSeconds(profile.trackedSeconds7d)} recent playtime</span>
          {profile.inferredGuildName ? <span>{profile.inferredGuildName}</span> : null}
          <span>{formatSaveLinkLabel(profile.saveArtifact.present)}</span>
        </div>
      </div>
      <button type="button" className="homepage-player-detail-button" onClick={onDetails}>Details</button>
    </li>
  );
}

function SaveLinkNeededRow({ profile }: PlayerProfileCardProps) {
  return (
    <li className="save-link-needed-row">
      <div className="save-link-needed-main">
        <span className="homepage-player-name">{getProfileDisplayName(profile)}</span>
        <span className="homepage-player-meta">
          {profile.profile.level !== null ? <span>lvl {profile.profile.level}</span> : null}
          <span>{formatDurationFromSeconds(profile.recentTrackedSeconds)}</span>
        </span>
      </div>
    </li>
  );
}

interface ActivityLogPanelProps {
  items: ActivityLogItem[];
}

interface DataFreshnessBannerProps {
  freshness: DataFreshnessResponse;
}

function getFreshnessTone(status: DataFreshnessResponse['status']): string {
  if (status === 'live') {
    return 'live';
  }

  if (status === 'stale' || status === 'historical') {
    return 'warning';
  }

  if (status === 'error') {
    return 'critical';
  }

  return 'neutral';
}

function DataFreshnessBanner({ freshness }: DataFreshnessBannerProps) {
  const lastActivityAt = freshness.lastSessionActivityAt ?? freshness.lastEventAt;

  return (
    <article className={`card trust-banner trust-banner-${getFreshnessTone(freshness.status)}`}>
      <div className="trust-banner-main">
        <div>
          <span className="summary-label">Data Trust</span>
          <h2>{freshness.headline}</h2>
          <p>{freshness.explanation}</p>
        </div>
        <span className={`confidence-badge confidence-${freshness.confidence}`}>{freshness.confidence}</span>
      </div>
      <div className="trust-banner-meta">
        <span>Connector: {freshness.connectorStatus}</span>
        <span>Last heard: {freshness.lastHeartbeatAt ? `${formatDurationFromSeconds(freshness.heartbeatAgeSeconds ?? 0)} ago` : 'never'}</span>
        <span>Last poll: {freshness.lastSuccessfulPollAt ? formatTimestamp(freshness.lastSuccessfulPollAt) : 'none yet'}</span>
        <span>Last activity: {lastActivityAt ? formatTimestamp(lastActivityAt) : 'none observed'}</span>
        <span>Action: {freshness.recommendedAction}</span>
      </div>
      {freshness.trustWarnings.length > 0 ? (
        <div className="trust-warning-row">
          {freshness.trustWarnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function FreshnessInlineLabel({ freshness }: DataFreshnessBannerProps) {
  return (
    <span className={`source-badge freshness-source-${getFreshnessTone(freshness.status)}`}>
      {freshness.status === 'live' ? 'live data' : freshness.status === 'not_started' ? 'not started' : `${freshness.status} data`}
    </span>
  );
}

function ActivityLogPanel({ items }: ActivityLogPanelProps) {
  return (
    <article className="card activity-log-card">
      <h2>Operations Journal</h2>
      <ul className="list activity-list">
        {items.length === 0 ? <li>This server has not recorded operational activity for this view yet.</li> : null}
        {items.map((item) => (
          <li key={item.id} className="activity-row activity-row-rich">
            <div className="activity-main activity-main-rich">
              <div className="activity-title-row">
                <span className={`activity-badge activity-severity-${item.severity}`}>{item.severity}</span>
                <strong>{item.title}</strong>
                <span className={`confidence-badge confidence-${item.confidence}`}>{item.confidence}</span>
              </div>
              <div>{item.description}</div>
              <div className="subtle activity-explanation">{item.explanation}</div>
            </div>
            <span className="subtle activity-time">{formatClock(item.timestamp)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

interface WorldChroniclePanelProps {
  title: string;
  events: WorldChronicleEvent[];
  emptyMessage?: string;
  compact?: boolean;
  onOpenWorldEvent?: (worldEventId: string) => void;
  getWorldEventIdForChronicleEvent?: (event: WorldChronicleEvent) => string | null;
}

function getChronicleKindLabel(kind: WorldChronicleEventKind): string {
  switch (kind) {
    case 'arrival':
      return 'Arrival';
    case 'return':
      return 'Return';
    case 'join':
      return 'Joined';
    case 'leave':
      return 'Left';
    case 'restart':
      return 'Restart';
    case 'imported_character':
      return 'Character';
    case 'world_event':
      return 'World event';
    case 'guild_active':
      return 'Guild active';
    case 'guild_quiet':
      return 'Guild quiet';
    case 'base_lifecycle':
      return 'Base lifecycle';
  }
}

function getChronicleWorldEventId(event: WorldChronicleEvent): string | null {
  return event.id.startsWith('world-event:') ? event.id.slice('world-event:'.length) : null;
}

function WorldChroniclePanel({
  title,
  events,
  emptyMessage = 'This realm is still writing its story. More adventures will appear as players explore.',
  compact = false,
  onOpenWorldEvent,
  getWorldEventIdForChronicleEvent
}: WorldChroniclePanelProps) {
  const visibleEvents = compact ? events.slice(0, 5) : events;

  return (
    <article className={`card world-chronicle-card ${compact ? 'world-chronicle-card-compact' : ''}`}>
      <div className="world-chronicle-heading">
        <div>
          <span className="summary-label">Chronicle</span>
          <h2>{title}</h2>
        </div>
        <span className="source-badge">{events.length} entries</span>
      </div>

      {events.length === 0 ? (
        <p className="world-chronicle-empty">{emptyMessage}</p>
      ) : null}

      <ol className="world-chronicle-list">
        {visibleEvents.map((event) => {
          const worldEventId = getChronicleWorldEventId(event) ?? getWorldEventIdForChronicleEvent?.(event) ?? null;
          const canOpenWorldEvent = Boolean(worldEventId && onOpenWorldEvent);

          return (
            <li key={event.id} className={`world-chronicle-row world-chronicle-${event.kind}`}>
              <div className="world-chronicle-marker" aria-hidden="true" />
              <button
                type="button"
                className="world-chronicle-row-button"
                disabled={!canOpenWorldEvent}
                onClick={() => {
                  if (worldEventId) {
                    onOpenWorldEvent?.(worldEventId);
                  }
                }}
              >
                <div className="world-chronicle-title-row">
                  <span className="source-badge">{getChronicleKindLabel(event.kind)}</span>
                  <strong>{event.title}</strong>
                </div>
                {event.detail ? <p>{event.detail}</p> : null}
                <div className="world-chronicle-meta">
                  <span>{formatRelativeTime(event.occurredAt)}</span>
                  <span>{event.sourceLabel}</span>
                  <span className={`confidence-badge confidence-${event.confidence}`}>{event.confidence}</span>
                  {canOpenWorldEvent ? <span>Inspect evidence</span> : null}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

interface WorldMemorySearchResult {
  record: WorldMemoryRecord;
  typeLabel: string;
  context: string;
  lastActivityLabel: string;
}

interface WorldMemorySearchProps {
  game: ServerOption['game'];
  query: string;
  results: WorldMemorySearchResult[];
  totalMemories: number;
  onQueryChange: (value: string) => void;
  onOpenResult: (record: WorldMemoryRecord) => void;
}

function getWorldMemoryTypeLabel(type: WorldMemoryRecordType): string {
  switch (type) {
    case 'person':
      return 'Player';
    case 'character':
      return 'Character';
    case 'guild':
      return 'Guild';
    case 'base':
      return 'Base';
    case 'world_event':
      return 'World event';
    case 'settlement':
      return 'Settlement';
    case 'boss':
      return 'Boss';
    case 'village':
      return 'Village';
    case 'clan':
      return 'Clan';
  }
}

function getRelationshipTypeLabel(type: WorldMemoryRelationship['type']): string {
  switch (type) {
    case 'player_character':
      return 'Character link';
    case 'character_realm':
      return 'Realm activity';
    case 'guild_member':
      return 'Guild member';
    case 'guild_base':
      return 'Base link';
    case 'base_world':
      return 'World base';
    case 'event_subject':
      return 'World activity';
  }
}

function getRelatedRecord(relationship: WorldMemoryRelationship, subjectRecordId: string, records: WorldMemoryRecord[]): WorldMemoryRecord | null {
  const relatedRecordId = relationship.fromRecordId === subjectRecordId
    ? relationship.toRecordId
    : relationship.fromRecordId;

  return records.find((record) => record.id === relatedRecordId) ?? null;
}

function getRelationshipOwnerLabel(relationship: WorldMemoryRelationship, subject: WorldMemoryRecord, related: WorldMemoryRecord | null): string {
  if (relationship.type === 'character_realm') {
    return subject.type === 'character' ? 'Character belongs to this realm' : 'Realm includes this character';
  }

  if (relationship.type === 'guild_member') {
    return subject.type === 'guild' ? 'Guild member' : `Member of ${related?.displayName ?? 'this guild'}`;
  }

  if (relationship.type === 'event_subject') {
    return subject.type === 'guild' ? 'Guild belongs to this archipelago' : 'World activity';
  }

  if (relationship.type === 'guild_base') {
    return subject.type === 'guild' ? 'Future base relationship' : 'Base belongs to guild';
  }

  if (relationship.type === 'base_world') {
    return subject.type === 'base' ? 'Base belongs to this world' : 'World base relationship';
  }

  return getRelationshipTypeLabel(relationship.type);
}

function getChronicleReferenceSummary(count: number): string {
  if (count === 0) {
    return 'No Chronicle references yet';
  }

  return `Appears in ${count} Chronicle ${count === 1 ? 'entry' : 'entries'}`;
}

function normalizeMemorySearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function getWorldMemorySearchContext(record: WorldMemoryRecord): string {
  if (record.game === 'valheim' && record.type === 'character') {
    const sessionCount = Number(record.metadata.sessionCount ?? 0);
    return sessionCount > 0
      ? `Linked to realm activity · ${sessionCount} adventure${sessionCount === 1 ? '' : 's'} remembered`
      : 'Linked to realm activity';
  }

  if (record.game === 'palworld' && record.type === 'guild') {
    const activeMemberCount = Number(record.metadata.activeMemberCount ?? 0);
    const guild = record.metadata.guild as PalworldGuildActivityEntry | undefined;
    const memberCount = guild?.memberCount ?? Number(record.metadata.guildMemberCount ?? 0);
    return `${memberCount} member${memberCount === 1 ? '' : 's'} · ${activeMemberCount} active this week`;
  }

  if (record.game === 'palworld' && record.type === 'person') {
    const member = record.metadata.member as PalworldGuildActivityMember | undefined;
    const guildName = typeof record.metadata.guildName === 'string' ? record.metadata.guildName : null;
    return guildName
      ? `Member of ${guildName}`
      : member?.matched ? 'Matched from guild member activity' : 'Remembered from trusted Palworld activity';
  }

  return record.sourceLabel;
}

function getWorldMemoryLastActivityLabel(record: WorldMemoryRecord): string {
  const lastSeenAt = record.lastSeenAt ?? record.chronicleReferences[0]?.occurredAt ?? null;

  if (!lastSeenAt) {
    return 'Last activity unknown';
  }

  return `Last activity ${formatRelativeTime(lastSeenAt)}`;
}

function getWorldMemoryStatusTone(record: WorldMemoryRecord): string {
  switch (record.currentStatus) {
    case 'online':
    case 'active':
      return 'active';
    case 'offline':
    case 'quiet':
      return 'offline';
    case 'watch':
    case 'risk':
      return 'warning';
    case 'unknown':
      return 'unknown';
  }
}

function buildWorldMemorySearchResults(records: WorldMemoryRecord[], query: string, game: ServerOption['game']): WorldMemorySearchResult[] {
  return searchWorldMemoryRecords(records, query, game)
    .map((record) => {
      const typeLabel = getWorldMemoryTypeLabel(record.type);

      return {
        record,
        typeLabel,
        context: getWorldMemorySearchContext(record),
        lastActivityLabel: getWorldMemoryLastActivityLabel(record)
      };
    })
    .slice(0, 8);
}

function WorldMemorySearch({ game, query, results, totalMemories, onQueryChange, onOpenResult }: WorldMemorySearchProps) {
  const placeholder = game === 'palworld'
    ? 'Search players, guilds, and this archipelago...'
    : "Search this realm's memory...";
  const hasQuery = normalizeMemorySearchValue(query).length > 0;

  return (
    <section className={`world-memory-search world-memory-search-${game}`} aria-label="World memory search">
      <label className="world-memory-search-field">
        <span>World Memory</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
      </label>
      <div className="world-memory-search-count">{totalMemories} remembered</div>

      {hasQuery ? (
        <div className="world-memory-search-results" role="list">
          {results.length === 0 ? <p className="world-memory-search-empty">No memories found in this world.</p> : null}
          {results.map(({ record, typeLabel, context, lastActivityLabel }) => (
            <button
              key={record.id}
              type="button"
              className="world-memory-search-result"
              onClick={() => onOpenResult(record)}
            >
              <span className="world-memory-result-main">
                <strong>{record.displayName}</strong>
                <span>{typeLabel} · {lastActivityLabel}</span>
                <small>{context}</small>
              </span>
              <span className="world-memory-result-badges">
                <span className={`state-pill state-${getWorldMemoryStatusTone(record)}`}>{record.currentStatus}</span>
                <span className={`confidence-badge confidence-${record.confidence === 'unknown' ? 'low' : record.confidence}`}>{record.confidence}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface WorldMemoryDetailDrawerProps {
  detail: WorldMemoryDetailModel;
  records: WorldMemoryRecord[];
  onClose: () => void;
}

interface WorldMemoryRelationshipPanelProps {
  detail: WorldMemoryDetailModel;
  records: WorldMemoryRecord[];
  title?: string;
  emptyMessage?: string;
}

interface WorldMemoryFact {
  label: string;
  value: ReactNode;
}

interface WorldMemoryTimelineItem {
  id: string;
  occurredAt: string;
  title: string;
  detail?: string;
  tone?: 'story' | 'activity' | 'connection' | 'origin';
}

interface WorldMemoryDrawerSectionProps {
  title: string;
  children: ReactNode;
  quiet?: boolean;
}

function WorldMemoryDrawerSection({ title, children, quiet = false }: WorldMemoryDrawerSectionProps) {
  return (
    <section className={`player-drawer-sessions world-memory-drawer-section${quiet ? ' world-memory-drawer-section-quiet' : ''}`}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function WorldMemoryFactGrid({ facts }: { facts: WorldMemoryFact[] }) {
  return (
    <dl className="player-drawer-grid world-memory-fact-grid">
      {facts.map((fact) => (
        <div key={fact.label} className="world-memory-fact">
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function getTimelineDayKey(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function getTimelineGroupLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Earlier';
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDelta = Math.floor((today.getTime() - eventDay.getTime()) / (24 * 60 * 60 * 1000));

  if (dayDelta === 0) {
    return 'Today';
  }

  if (dayDelta === 1) {
    return 'Yesterday';
  }

  if (dayDelta > 1 && dayDelta <= 7) {
    return 'Last Week';
  }

  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

function sortTimelineItems(items: WorldMemoryTimelineItem[]): WorldMemoryTimelineItem[] {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.occurredAt);
    const rightTime = Date.parse(right.occurredAt);

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
      return left.title.localeCompare(right.title);
    }

    if (Number.isNaN(leftTime)) {
      return 1;
    }

    if (Number.isNaN(rightTime)) {
      return -1;
    }

    return rightTime - leftTime;
  });
}

function dedupeTimelineItems(items: WorldMemoryTimelineItem[]): WorldMemoryTimelineItem[] {
  const seen = new Set<string>();

  return sortTimelineItems(items).filter((item) => {
    const key = `${getTimelineDayKey(item.occurredAt)}:${item.title}:${item.detail ?? ''}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildMemoryTimeline(detail: WorldMemoryDetailModel): WorldMemoryTimelineItem[] {
  const { record, chronicleEvents } = detail;
  const items: WorldMemoryTimelineItem[] = chronicleEvents.map((event) => ({
    id: `chronicle:${event.id}`,
    occurredAt: event.occurredAt,
    title: event.title,
    detail: event.detail,
    tone: 'story'
  }));

  if (record.lastSeenAt) {
    items.push({
      id: `last-seen:${record.id}`,
      occurredAt: record.lastSeenAt,
      title: record.type === 'guild' ? 'Last trusted guild activity' : 'Last remembered activity',
      detail: getWorldMemorySearchContext(record),
      tone: 'activity'
    });
  }

  if (record.firstSeenAt && record.firstSeenAt !== record.lastSeenAt) {
    items.push({
      id: `first-seen:${record.id}`,
      occurredAt: record.firstSeenAt,
      title: record.type === 'guild' ? 'First remembered as a guild' : 'First remembered in this world',
      detail: record.sourceLabel,
      tone: 'origin'
    });
  }

  return dedupeTimelineItems(items);
}

function buildSessionTimelineItems(sessions: SessionRecord[], emptySubject: string): WorldMemoryTimelineItem[] {
  const items = sessions.map((session, index): WorldMemoryTimelineItem => {
    const duration = session.durationSeconds !== undefined ? formatDurationFromSeconds(session.durationSeconds) : null;

    return {
      id: `session:${session.startedAt}:${session.endedAt ?? 'open'}:${index}`,
      occurredAt: session.endedAt ?? session.startedAt,
      title: session.endedAt
        ? `Explored for ${duration ?? 'an unknown time'}`
        : 'Started exploring',
      detail: session.endedAt
        ? `Adventure began ${formatTimestamp(session.startedAt)}`
        : `${emptySubject} is exploring now`,
      tone: 'activity'
    };
  });

  return dedupeTimelineItems(items);
}

function buildPalworldGuildTimeline(
  guild: PalworldGuildActivityEntry,
  memoryDetail: WorldMemoryDetailModel | null
): WorldMemoryTimelineItem[] {
  const items = memoryDetail ? buildMemoryTimeline(memoryDetail) : [];

  guild.members
    .filter((member) => member.matched && member.lastSeenAt)
    .slice(0, 8)
    .forEach((member, index) => {
      items.push({
        id: `guild-member:${guild.guildName}:${member.memberName}:${index}`,
        occurredAt: member.lastSeenAt as string,
        title: `${member.memberName} returned to the guild`,
        detail: member.daysSinceSeen !== null ? `${member.daysSinceSeen}d since last activity` : 'Trusted member activity',
        tone: 'connection'
      });
    });

  if (!memoryDetail && guild.lastMemberSeenAt) {
    items.push({
      id: `guild-last:${guild.guildName}`,
      occurredAt: guild.lastMemberSeenAt,
      title: 'Guild activity was remembered',
      detail: guild.lastSeenMemberName ? `${guild.lastSeenMemberName} was the latest tracked member` : 'Trusted guild activity',
      tone: 'activity'
    });
  }

  return dedupeTimelineItems(items);
}

function WorldMemoryLivingTimeline({ items, emptyMessage = 'This story is just beginning.' }: { items: WorldMemoryTimelineItem[]; emptyMessage?: string }) {
  const groupedItems = sortTimelineItems(items).reduce<Array<{ label: string; items: WorldMemoryTimelineItem[] }>>((groups, item) => {
    const label = getTimelineGroupLabel(item.occurredAt);
    const currentGroup = groups[groups.length - 1];

    if (currentGroup?.label === label) {
      currentGroup.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }

    return groups;
  }, []);

  return (
    <WorldMemoryDrawerSection title="Living Timeline">
      {groupedItems.length === 0 ? <p className="world-memory-timeline-empty">{emptyMessage}</p> : null}
      {groupedItems.length > 0 ? (
        <div className="world-memory-timeline" aria-label="Living timeline">
          {groupedItems.map((group) => (
            <div key={group.label} className="world-memory-timeline-group">
              <h4>{group.label}</h4>
              <ol>
                {group.items.map((item) => (
                  <li key={item.id} className={`world-memory-timeline-item world-memory-timeline-${item.tone ?? 'story'}`}>
                    <span className="world-memory-timeline-marker" aria-hidden="true" />
                    <div>
                      <strong>{item.title}</strong>
                      {item.detail ? <p>{item.detail}</p> : null}
                      <time dateTime={item.occurredAt}>{formatRelativeTime(item.occurredAt)}</time>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ) : null}
    </WorldMemoryDrawerSection>
  );
}

function WorldMemoryOperatorDetails({ record, relationshipCount }: { record: WorldMemoryRecord; relationshipCount: number }) {
  return (
    <details className="world-memory-operator-details">
      <summary>Operator Details</summary>
      <dl>
        <dt>Source</dt>
        <dd>{record.sourceLabel}</dd>
        <dt>Memory ID</dt>
        <dd><code>{record.id}</code></dd>
        <dt>Server ID</dt>
        <dd><code>{record.serverId}</code></dd>
        <dt>Trusted links</dt>
        <dd>{relationshipCount}</dd>
        <dt>Chronicle references</dt>
        <dd>{record.chronicleReferences.length}</dd>
      </dl>
    </details>
  );
}

function WorldMemoryRelationshipPanel({
  detail,
  records,
  title = 'Related Memories',
  emptyMessage = 'No related memories have been recorded yet.'
}: WorldMemoryRelationshipPanelProps) {
  const { record, relationships, chronicleEvents } = detail;

  return (
    <WorldMemoryDrawerSection title={title}>
      <ul className="world-memory-relationship-list">
        {relationships.length === 0 ? <li>{emptyMessage}</li> : null}
        {relationships.map((relationship) => {
          const relatedRecord = getRelatedRecord(relationship, record.id, records);
          const relatedName = relatedRecord?.displayName ?? 'This world';
          const relatedType = relatedRecord ? getWorldMemoryTypeLabel(relatedRecord.type) : 'World';

          return (
            <li key={relationship.id}>
              <span>
                <strong>{getRelationshipOwnerLabel(relationship, record, relatedRecord)}</strong>
                <small>{relatedName} · {relatedType}</small>
              </span>
              <span className={`confidence-badge confidence-${relationship.confidence === 'unknown' ? 'low' : relationship.confidence}`}>
                {relationship.confidence}
              </span>
            </li>
          );
        })}
        <li>
          <span>
            <strong>{getChronicleReferenceSummary(chronicleEvents.length)}</strong>
            <small>{chronicleEvents[0] ? `Last Chronicle appearance ${formatRelativeTime(chronicleEvents[0].occurredAt)}` : 'This memory has not appeared in the Chronicle yet.'}</small>
          </span>
        </li>
      </ul>
    </WorldMemoryDrawerSection>
  );
}

function WorldMemoryDetailDrawer({ detail, records, onClose }: WorldMemoryDetailDrawerProps) {
  const { record, relationships } = detail;
  const timelineItems = buildMemoryTimeline(detail);
  const facts: WorldMemoryFact[] = [
    { label: 'Status', value: record.currentStatus },
    { label: 'Confidence', value: <span className={`confidence-badge confidence-${record.confidence === 'unknown' ? 'low' : record.confidence}`}>{record.confidence}</span> },
    { label: 'First seen', value: record.firstSeenAt ? formatTimestamp(record.firstSeenAt) : 'Not enough evidence' },
    { label: 'Last activity', value: record.lastSeenAt ? formatTimestamp(record.lastSeenAt) : 'Not enough evidence' }
  ];

  return (
    <div className="player-drawer-shell" role="presentation">
      <button type="button" className="player-drawer-backdrop" aria-label="Close memory details" onClick={onClose} />
      <aside className="player-drawer world-memory-detail-drawer" aria-label="Memory details">
        <div className="player-drawer-header">
          <div>
            <span className="summary-label">{getWorldMemoryTypeLabel(record.type)}</span>
            <h2>{record.displayName}</h2>
            <p>{getWorldMemorySearchContext(record)}</p>
          </div>
          <button type="button" className="player-drawer-close" onClick={onClose}>Close</button>
        </div>

        <WorldMemoryFactGrid facts={facts} />

        <WorldMemoryLivingTimeline items={timelineItems} />

        <WorldMemoryRelationshipPanel detail={detail} records={records} />

        <WorldMemoryOperatorDetails record={record} relationshipCount={relationships.length} />
      </aside>
    </div>
  );
}

interface SessionTimelinePanelProps {
  timeline: SessionTimelineResponse;
  freshness: DataFreshnessResponse;
}

function getTimelineSourceLabel(source: SessionTimelineItem['source']): string {
  switch (source) {
    case 'live':
      return 'Live session';
    case 'recent':
      return 'Recent API memory';
    case 'stored':
      return 'Stored rollup';
  }
}

function getSessionEndLabel(session: SessionTimelineItem): string {
  if (session.isActive) {
    return 'Still online';
  }

  return session.endedAt ? formatTimestamp(session.endedAt) : 'Unknown leave time';
}

function getSessionConfidence(session: SessionTimelineItem): string {
  return session.endConfidence ?? session.startConfidence ?? 'unknown';
}

function SessionTimelinePanel({ timeline, freshness }: SessionTimelinePanelProps) {
  const activeSessions = timeline.sessions.filter((session) => session.isActive);
  const endedSessions = timeline.sessions.filter((session) => !session.isActive);

  return (
    <article className="card session-timeline-card">
      <div className="session-timeline-heading">
        <div>
          <h2>Adventures</h2>
          <p className="subtle">{timeline.explanation}</p>
        </div>
        <div className="session-timeline-summary">
          <FreshnessInlineLabel freshness={freshness} />
          <span>{timeline.summary.activeCount} active</span>
          <span>{timeline.summary.sessionsToday} today</span>
          <span>{formatDurationFromSeconds(timeline.summary.trackedSecondsToday)} tracked today</span>
        </div>
      </div>

      {timeline.sessions.length === 0 ? (
        <p className="subtle">This world has not recorded enough adventure history yet.</p>
      ) : null}

      {activeSessions.length > 0 ? (
        <section className="session-timeline-section">
          <h3>Online Now</h3>
          <ul className="list session-timeline-list">
            {activeSessions.map((session) => (
              <li key={session.sessionId} className="session-timeline-row">
                <div className="session-timeline-main">
                  <div className="session-timeline-title">
                    <strong>{session.displayName}</strong>
                    <span className="state-pill state-online">online</span>
                    <span className={`confidence-badge confidence-${getSessionConfidence(session) === 'unknown' ? 'low' : getSessionConfidence(session)}`}>
                      {getSessionConfidence(session)}
                    </span>
                    <span className="source-badge">{getTimelineSourceLabel(session.source)}</span>
                  </div>
                  <div className="session-timeline-meta">
                    <span>Joined {formatTimestamp(session.startedAt)}</span>
                    <span>{getSessionEndLabel(session)}</span>
                    <span>{formatDurationFromSeconds(session.durationSeconds)}</span>
                  </div>
                  <div className="subtle">{session.explanation}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="session-timeline-section">
        <h3>Recent Adventures</h3>
        <ul className="list session-timeline-list">
          {endedSessions.length === 0 && activeSessions.length > 0 ? <li className="empty-line">No ended sessions tracked yet.</li> : null}
          {endedSessions.map((session) => (
            <li key={session.sessionId} className="session-timeline-row">
              <div className="session-timeline-main">
                <div className="session-timeline-title">
                  <strong>{session.displayName}</strong>
                  <span className={`confidence-badge confidence-${getSessionConfidence(session) === 'unknown' ? 'low' : getSessionConfidence(session)}`}>
                    {getSessionConfidence(session)}
                  </span>
                  <span className="source-badge">{getTimelineSourceLabel(session.source)}</span>
                </div>
                <div className="session-timeline-meta">
                  <span>Joined {formatTimestamp(session.startedAt)}</span>
                  <span>Left {getSessionEndLabel(session)}</span>
                  <span>{formatDurationFromSeconds(session.durationSeconds)}</span>
                </div>
                <div className="subtle">
                  {session.explanation}
                  {session.closeReason ? ` Close reason: ${session.closeReason}.` : ''}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

interface PlayerIntelligencePanelProps {
  players: PlayerIntelligenceRecord[];
  explanation: string;
  freshness: DataFreshnessResponse;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
}

interface PlayerEngagementPanelProps {
  engagement: PlayerEngagementSummary;
  onSelectPlayer: (playerId: string) => void;
}

function PlayerEngagementPanel({ engagement, onSelectPlayer }: PlayerEngagementPanelProps) {
  const peakHourLabel = engagement.activity.peakHourUtc === null
    ? 'not enough sessions'
    : `${String(engagement.activity.peakHourUtc).padStart(2, '0')}:00 UTC`;

  return (
    <article className="card player-engagement-card">
      <div className="panel-title-row">
        <div>
          <h2>Player Engagement</h2>
          <p className="subtle">{engagement.headline}</p>
        </div>
        <span className={`confidence-badge confidence-${engagement.confidence === 'unknown' ? 'low' : engagement.confidence}`}>
          {engagement.confidence}
        </span>
      </div>

      <div className="detail-grid">
        <section className="detail-block">
          <h3>Who is playing?</h3>
          <ul className="list compact">
            <li><span>Online now</span><span>{engagement.activity.activeNowCount}</span></li>
            {engagement.activity.activeNow.slice(0, 3).map((player) => (
              <li key={`active-now:${player.playerId}`}>
                <button type="button" className="inline-player-link" onClick={() => onSelectPlayer(player.playerId)}>
                  {player.displayName}
                </button>
                <span className="subtle">{player.reason}</span>
              </li>
            ))}
            <li><span>Today</span><span>{engagement.activity.today.sessions} sessions / {formatDurationFromSeconds(engagement.activity.today.trackedSeconds)}</span></li>
            <li><span>7 days</span><span>{engagement.activity.sevenDays.sessions} sessions / {formatDurationFromSeconds(engagement.activity.sevenDays.trackedSeconds)}</span></li>
            <li><span>30 days</span><span>{engagement.activity.thirtyDays.sessions} sessions / {formatDurationFromSeconds(engagement.activity.thirtyDays.trackedSeconds)}</span></li>
            <li><span>Server alive around</span><span>{peakHourLabel}</span></li>
          </ul>
        </section>

        <section className="detail-block">
          <h3>Who came back?</h3>
          <ul className="list compact">
            {engagement.returningPlayers.length === 0 ? <li>No returning players tracked yet.</li> : null}
            {engagement.returningPlayers.slice(0, 4).map((player) => (
              <li key={`returning:${player.playerId}`}>
                <button type="button" className="inline-player-link" onClick={() => onSelectPlayer(player.playerId)}>
                  {player.displayName}
                </button>
                <span className="subtle">{player.sessionCount} sessions</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="detail-block">
          <h3>Who disappeared?</h3>
          <ul className="list compact">
            {engagement.inactivePlayers.length === 0 ? <li>Not enough history to call anyone inactive yet.</li> : null}
            {engagement.inactivePlayers.slice(0, 4).map((player) => (
              <li key={`inactive:${player.playerId}`}>
                <button type="button" className="inline-player-link" onClick={() => onSelectPlayer(player.playerId)}>
                  {player.displayName}
                </button>
                <span className="subtle">{player.reason}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="detail-block">
          <h3>Most tracked</h3>
          <ul className="list compact">
            {engagement.highEngagementPlayers.length === 0 ? <li>No tracked playtime yet.</li> : null}
            {engagement.highEngagementPlayers.slice(0, 4).map((player) => (
              <li key={`high:${player.playerId}`}>
                <button type="button" className="inline-player-link" onClick={() => onSelectPlayer(player.playerId)}>
                  {player.displayName}
                </button>
                <span className="subtle">{formatDurationFromSeconds(player.totalTrackedSeconds)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {engagement.dataWarnings.length > 0 ? (
        <div className="trust-warning-row">
          {engagement.dataWarnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

interface ServerAliveRhythmPanelProps {
  rhythm: ServerAliveRhythmSummary;
}

function ServerAliveRhythmPanel({ rhythm }: ServerAliveRhythmPanelProps) {
  const bestDays = rhythm.sevenDays.busiestDays.length > 0
    ? rhythm.sevenDays.busiestDays
    : rhythm.thirtyDays.busiestDays.slice(0, 3);
  const quietDays = rhythm.sevenDays.quietDays.slice(0, 3);

  return (
    <article className="card server-alive-rhythm-card">
      <div className="panel-title-row">
        <div>
          <h2>When is the server alive?</h2>
          <p className="subtle">{rhythm.summary}</p>
        </div>
        <span className={`confidence-badge confidence-${rhythm.confidence === 'unknown' ? 'low' : rhythm.confidence}`}>
          {rhythm.confidence}
        </span>
      </div>

      <div className="detail-grid">
        <section className="detail-block">
          <h3>Best days</h3>
          <ul className="list compact">
            {bestDays.length === 0 ? <li>Not enough history yet.</li> : null}
            {bestDays.slice(0, 3).map((day) => (
              <li key={`busy:${day.date}`}>
                <span>{day.dayOfWeek}</span>
                <span>{day.sessions} sessions / {formatDurationFromSeconds(day.trackedSeconds)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="detail-block">
          <h3>Quiet days</h3>
          <ul className="list compact">
            {quietDays.length === 0 ? <li>No quiet days in the last 7 days.</li> : null}
            {quietDays.map((day) => (
              <li key={`quiet:${day.date}`}>
                <span>{day.dayOfWeek}</span>
                <span>{day.date}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="detail-block">
          <h3>Tracked totals</h3>
          <ul className="list compact">
            <li><span>7 days</span><span>{rhythm.sevenDays.totalSessions} sessions / {formatDurationFromSeconds(rhythm.sevenDays.totalTrackedSeconds)}</span></li>
            <li><span>7d players</span><span>{rhythm.sevenDays.uniqueActivePlayers}</span></li>
            <li><span>30 days</span><span>{rhythm.thirtyDays.totalSessions} sessions / {formatDurationFromSeconds(rhythm.thirtyDays.totalTrackedSeconds)}</span></li>
            <li><span>30d players</span><span>{rhythm.thirtyDays.uniqueActivePlayers}</span></li>
          </ul>
        </section>

        <section className="detail-block">
          <h3>Pattern</h3>
          <ul className="list compact">
            <li>
              <span>Day pattern</span>
              <span>{rhythm.bestDayOfWeekPattern ? rhythm.bestDayOfWeekPattern.dayOfWeek : 'Unknown'}</span>
            </li>
            {rhythm.hourlyPattern.status === 'available' ? (
              rhythm.hourlyPattern.busiestUtcHours.slice(0, 3).map((hour) => (
                <li key={`hour:${hour.hourUtc}`}>
                  <span>{String(hour.hourUtc).padStart(2, '0')}:00 UTC</span>
                  <span>{hour.sessions} starts / {formatDurationFromSeconds(hour.trackedSeconds)}</span>
                </li>
              ))
            ) : (
              <li>
                <span>Hourly pattern</span>
                <span>Unknown</span>
              </li>
            )}
            <li><span className="subtle">{rhythm.hourlyPattern.explanation}</span></li>
          </ul>
        </section>
      </div>

      {rhythm.confidenceWarnings.length > 0 ? (
        <div className="trust-warning-row">
          {rhythm.confidenceWarnings.slice(0, 3).map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

interface SettingsCapabilityPanelProps {
  capabilities: ServerSettingsCapabilitySummary;
  onOpenObservedSettings: () => void;
}

function SettingsCapabilityPanel({ capabilities, onOpenObservedSettings }: SettingsCapabilityPanelProps) {
  const missingPieces = capabilities.missingRequirements.slice(0, 5);
  const validationSteps = capabilities.validationSteps.slice(0, 3);
  const rollbackRequirements = capabilities.rollbackRequirements.slice(0, 3);
  const unresolvedQuestions = capabilities.unresolvedQuestions.slice(0, 3);
  const canOpenObservedSettings = capabilities.canReadSettings === 'yes';

  return (
    <article
      className={`card settings-capability-card ${canOpenObservedSettings ? 'clickable-row' : ''}`}
      onClick={canOpenObservedSettings ? onOpenObservedSettings : undefined}
    >
      <div className="panel-title-row">
        <div>
          <h2>Settings Control Readiness</h2>
          <p className="subtle">{capabilities.nextSafeStep}</p>
        </div>
        <span className={`confidence-badge confidence-${capabilities.canReadSettings === 'yes' ? 'high' : capabilities.canReadSettings === 'unknown' ? 'medium' : 'low'}`}>
          read {capabilities.canReadSettings}
        </span>
      </div>

      <div className="detail-grid">
        <section className="detail-block">
          <h3>Can read settings</h3>
          <ul className="list compact">
            <li><span>Status</span><span>{capabilities.canReadSettings}</span></li>
            <li><span>Source</span><span>{capabilities.readSource}</span></li>
            <li><span>Last snapshot</span><span>{capabilities.lastSettingsSnapshotAt ? formatTimestamp(capabilities.lastSettingsSnapshotAt) : 'None'}</span></li>
          </ul>
        </section>

        <section className="detail-block">
          <h3>Can safely change settings</h3>
          <ul className="list compact">
            <li><span>Status</span><span>{capabilities.canWriteSettings}</span></li>
            <li><span>Write path</span><span>{capabilities.writePathStatus}</span></li>
            <li><span>Needs restart/manual</span><span>{capabilities.requiresRestart}</span></li>
            <li><span>Connector</span><span>{capabilities.connectorMode ?? 'unknown'}</span></li>
          </ul>
        </section>

        <section className="detail-block">
          <h3>Candidate paths</h3>
          <ul className="list compact">
            {capabilities.candidateWritePaths.length === 0 ? <li>No candidate paths reported.</li> : null}
            {capabilities.candidateWritePaths.map((path) => (
              <li key={path}><span>{path}</span></li>
            ))}
          </ul>
        </section>

        <section className="detail-block">
          <h3>Readable groups</h3>
          <ul className="list compact">
            {capabilities.supportedSettingGroups.length === 0 ? <li>No setting groups mapped yet.</li> : null}
            {capabilities.supportedSettingGroups.map((group) => (
              <li key={group}><span>{group}</span></li>
            ))}
          </ul>
        </section>

        <section className="detail-block">
          <h3>Missing pieces</h3>
          <ul className="list compact">
            {missingPieces.length === 0 ? <li>No missing pieces reported.</li> : null}
            {missingPieces.map((requirement) => (
              <li key={requirement}><span>{requirement}</span></li>
            ))}
          </ul>
        </section>

        <section className="detail-block">
          <h3>Validation needed</h3>
          <ul className="list compact">
            {validationSteps.length === 0 ? <li>No validation steps reported.</li> : null}
            {validationSteps.map((step) => (
              <li key={step}><span>{step}</span></li>
            ))}
          </ul>
        </section>

        <section className="detail-block">
          <h3>Rollback needed</h3>
          <ul className="list compact">
            {rollbackRequirements.length === 0 ? <li>No rollback requirements reported.</li> : null}
            {rollbackRequirements.map((requirement) => (
              <li key={requirement}><span>{requirement}</span></li>
            ))}
          </ul>
        </section>

        <section className="detail-block">
          <h3>Unknowns</h3>
          <ul className="list compact">
            {unresolvedQuestions.length === 0 ? <li>No unresolved questions reported.</li> : null}
            {unresolvedQuestions.map((question) => (
              <li key={question}><span>{question}</span></li>
            ))}
          </ul>
        </section>
      </div>

      <div className="trust-warning-row">
        {capabilities.safetyNotes.slice(0, 3).map((note) => (
          <span key={note}>{note}</span>
        ))}
        {canOpenObservedSettings ? <span>Open observed settings</span> : null}
      </div>
    </article>
  );
}

interface PalworldConfigAuditPanelProps {
  audit: PalworldConfigAudit;
}

function getConfigAuditTone(audit: PalworldConfigAudit): string {
  if (audit.fileEditViability === 'possible_needs_backup_restart_validation') {
    return 'medium';
  }

  if (audit.discoveryStatus === 'found' && audit.parseStatus === 'parsed') {
    return 'medium';
  }

  return 'low';
}

function PalworldConfigAuditPanel({ audit }: PalworldConfigAuditPanelProps) {
  const matchingCount = audit.matchedRestSettings.filter((setting) => setting.valuesMatch).length;
  const differingCount = audit.matchedRestSettings.length - matchingCount;

  return (
    <article className="card settings-capability-card">
      <div className="panel-title-row">
        <div>
          <h2>Config file audit</h2>
          <p className="subtle">{audit.selectedPath ?? 'No settings file selected yet.'}</p>
        </div>
        <span className={`confidence-badge confidence-${getConfigAuditTone(audit)}`}>
          {audit.discoveryStatus}
        </span>
      </div>

      <div className="detail-grid">
        <section className="detail-block">
          <h3>Discovery</h3>
          <ul className="list compact">
            <li><span>Status</span><span>{audit.discoveryStatus}</span></li>
            <li><span>Can read file</span><span>{audit.canReadFile ? 'yes' : 'no'}</span></li>
            <li><span>Candidates</span><span>{audit.candidatePaths.length}</span></li>
          </ul>
        </section>

        <section className="detail-block">
          <h3>Parse result</h3>
          <ul className="list compact">
            <li><span>Status</span><span>{audit.parseStatus}</span></li>
            <li><span>Parsed settings</span><span>{audit.parsedSettingCount}</span></li>
            <li><span>File-edit viability</span><span>{audit.fileEditViability}</span></li>
          </ul>
        </section>

        <section className="detail-block">
          <h3>REST match</h3>
          <ul className="list compact">
            <li><span>Matched keys</span><span>{audit.matchedRestSettings.length}</span></li>
            <li><span>Same values</span><span>{matchingCount}</span></li>
            <li><span>Different values</span><span>{differingCount}</span></li>
          </ul>
        </section>

        <section className="detail-block">
          <h3>Gaps</h3>
          <ul className="list compact">
            <li><span>File-only</span><span>{audit.unmatchedFileSettings.length}</span></li>
            <li><span>REST-only</span><span>{audit.unmatchedRestSettings.length}</span></li>
          </ul>
        </section>
      </div>

      <div className="trust-warning-row">
        {audit.safetyWarnings.slice(0, 3).map((warning) => (
          <span key={warning}>{warning}</span>
        ))}
      </div>
    </article>
  );
}

interface PalworldRuntimeAuditPanelProps {
  audit: PalworldRuntimeAudit;
}

function getRuntimeAuditTone(audit: PalworldRuntimeAudit): string {
  if (audit.runtimeAuditStatus === 'matched_active_config') {
    return 'high';
  }

  if (audit.runtimeAuditStatus === 'mismatched_config' || audit.runtimeAuditStatus === 'active_config_unreadable') {
    return 'low';
  }

  return 'medium';
}

function PalworldRuntimeAuditPanel({ audit }: PalworldRuntimeAuditPanelProps) {
  return (
    <article className="card settings-capability-card">
      <div className="panel-title-row">
        <div>
          <h2>Active Palworld Runtime</h2>
          <p className="subtle">{audit.summary}</p>
        </div>
        <span className={`confidence-badge confidence-${getRuntimeAuditTone(audit)}`}>
          {audit.runtimeAuditStatus}
        </span>
      </div>

      <div className="detail-grid">
        <section className="detail-block">
          <h3>Systemd service</h3>
          <ul className="list compact">
            <li><span>Path</span><span>{audit.servicePath}</span></li>
            <li><span>Readable</span><span>{audit.serviceReadable ? 'yes' : 'no'}</span></li>
            <li><span>Working dir</span><span>{audit.workingDirectory ?? 'unknown'}</span></li>
          </ul>
        </section>

        <section className="detail-block">
          <h3>Active config</h3>
          <ul className="list compact">
            <li><span>Inferred path</span><span>{audit.inferredActiveConfigPath ?? 'unknown'}</span></li>
            <li><span>Exists</span><span>{audit.inferredActiveConfigExists ? 'yes' : 'no'}</span></li>
            <li><span>Readable</span><span>{audit.inferredActiveConfigReadable ? 'yes' : 'no'}</span></li>
          </ul>
        </section>

        <section className="detail-block">
          <h3>GameOps selected</h3>
          <ul className="list compact">
            <li><span>Config audit path</span><span>{audit.selectedConfigAuditPath ?? 'none selected'}</span></li>
            <li><span>Matches runtime</span><span>{audit.pathsMatch ? 'yes' : 'no'}</span></li>
          </ul>
        </section>
      </div>

      <div className="trust-warning-row">
        {audit.safetyWarnings.slice(0, 3).map((warning) => (
          <span key={warning}>{warning}</span>
        ))}
      </div>
    </article>
  );
}

interface PalworldBackupReadinessPanelProps {
  readiness: PalworldBackupReadiness;
}

function getBackupReadinessTone(readiness: PalworldBackupReadiness): string {
  if (readiness.readinessStatus === 'ready_for_manual_backup_plan') {
    return 'medium';
  }

  return 'low';
}

function PalworldBackupReadinessPanel({ readiness }: PalworldBackupReadinessPanelProps) {
  const primaryFile = readiness.filesToBackup[0] ?? null;

  return (
    <article className="card settings-capability-card">
      <div className="panel-title-row">
        <div>
          <h2>Backup & Rollback Readiness</h2>
          <p className="subtle">No backup has been created.</p>
        </div>
        <span className={`confidence-badge confidence-${getBackupReadinessTone(readiness)}`}>
          {readiness.readinessStatus}
        </span>
      </div>

      <div className="detail-grid">
        <section className="detail-block">
          <h3>File to back up</h3>
          <ul className="list compact">
            <li><span>Path</span><span>{primaryFile?.path ?? 'none selected'}</span></li>
            <li><span>Active runtime config</span><span>{readiness.activeRuntimeConfigPath ?? 'unknown'}</span></li>
            <li><span>Runtime alignment</span><span>{readiness.runtimeAlignmentStatus}</span></li>
            <li><span>Exists</span><span>{primaryFile ? (primaryFile.exists ? 'yes' : 'no') : 'unknown'}</span></li>
            <li><span>Readable</span><span>{primaryFile ? (primaryFile.readable ? 'yes' : 'no') : 'unknown'}</span></li>
          </ul>
        </section>

        <section className="detail-block">
          <h3>Backup target</h3>
          <ul className="list compact">
            <li><span>Directory</span><span>{readiness.proposedBackupDirectory ?? 'unknown'}</span></li>
            <li><span>Filename</span><span>{readiness.proposedBackupFilenamePattern ?? 'unknown'}</span></li>
            <li><span>Can create backup</span><span>{readiness.canCreateBackup ? 'yes' : 'no'}</span></li>
          </ul>
        </section>

        <section className="detail-block">
          <h3>Restore validation</h3>
          <ul className="list compact">
            {readiness.validationSteps.slice(0, 3).map((step) => (
              <li key={step}><span>{step}</span></li>
            ))}
          </ul>
        </section>

        <section className="detail-block">
          <h3>Rollback needs</h3>
          <ul className="list compact">
            {readiness.rollbackRequirements.slice(0, 3).map((requirement) => (
              <li key={requirement}><span>{requirement}</span></li>
            ))}
          </ul>
        </section>
      </div>

      <div className="trust-warning-row">
        <span>{readiness.reasonCreateBackupDisabled}</span>
        {readiness.safetyWarnings.slice(0, 2).map((warning) => (
          <span key={warning}>{warning}</span>
        ))}
      </div>
    </article>
  );
}

interface ObservedSettingsDrawerProps {
  observedSettings: ObservedSettingsResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

function ObservedSettingsDrawer({ observedSettings, loading, error, onClose }: ObservedSettingsDrawerProps) {
  return (
    <div className="player-drawer-shell" role="presentation">
      <button type="button" className="player-drawer-backdrop" aria-label="Close observed settings" onClick={onClose} />
      <aside className="player-drawer" aria-label="Observed settings">
        <div className="player-drawer-header">
          <div>
            <span className="state-pill state-warning">Read-only for now</span>
            <h2>Observed Settings</h2>
            <p>{observedSettings?.snapshotAt ? `Snapshot ${formatTimestamp(observedSettings.snapshotAt)}` : 'No snapshot loaded'}</p>
          </div>
          <button type="button" className="player-drawer-close" onClick={onClose}>Close</button>
        </div>

        {loading ? <p className="subtle">Loading observed settings...</p> : null}
        {error ? <p className="player-drawer-error">{error}</p> : null}
        {observedSettings && !observedSettings.available ? (
          <section className="player-drawer-sessions">
            <h3>Observed Settings</h3>
            <p className="subtle">{observedSettings.emptyState ?? 'Observed settings are unavailable.'}</p>
          </section>
        ) : null}

        {observedSettings?.available ? (
          <>
            <section className="player-drawer-sessions">
              <h3>Read-only for now</h3>
              <ul>
                {observedSettings.safetyNotes.map((note) => (
                  <li key={note}><span>{note}</span></li>
                ))}
              </ul>
            </section>

            {observedSettings.groups.map((group) => (
              <section key={group.group} className="player-drawer-sessions">
                <h3>{group.group === 'unknown/unmapped' ? 'Unknown/unmapped settings' : group.group}</h3>
                <ul>
                  {group.settings.slice(0, 12).map((setting) => (
                    <li key={setting.key}>
                      <span>{setting.label}</span>
                      <span>{formatObservedSettingValue(setting.value)}</span>
                      <span className={`confidence-badge confidence-${getObservedSettingRiskTone(setting.changeRisk)}`}>
                        {setting.riskLabel}
                      </span>
                      <span className="subtle">{setting.valueType} • {setting.recommendedHandling} • restart {setting.requiresRestart}</span>
                      <span className="subtle">{setting.riskNote}</span>
                      {setting.sensitive || group.group === 'unknown/unmapped' ? <span className="subtle">{setting.safetyNote}</span> : null}
                    </li>
                  ))}
                  {group.settings.length > 12 ? <li><span className="subtle">{group.settings.length - 12} more settings in this group.</span></li> : null}
                </ul>
              </section>
            ))}
          </>
        ) : null}
      </aside>
    </div>
  );
}

interface EventTemplateDraftPanelProps {
  catalog: EventTemplateDraftCatalog;
  onEditDraft: (draft: EventTemplateDraftCatalog['drafts'][number]) => void;
}

function EventTemplateDraftPanel({ catalog, onEditDraft }: EventTemplateDraftPanelProps) {
  return (
    <article className="card event-template-draft-card">
      <div className="panel-title-row">
        <div>
          <h2>Event Template Drafts</h2>
          <p className="subtle">{catalog.explanation}</p>
        </div>
        <span className={`confidence-badge confidence-${catalog.status === 'available' ? 'medium' : 'low'}`}>
          preview only
        </span>
      </div>

      <div className="detail-grid">
        {catalog.drafts.length === 0 ? (
          <section className="detail-block">
            <h3>No drafts yet</h3>
            <p className="subtle">No observed template-candidate settings are available for draft ideas.</p>
          </section>
        ) : null}
        {catalog.drafts.slice(0, 4).map((draft) => (
          <section key={draft.templateId} className="detail-block">
            <h3>{draft.name}</h3>
            <ul className="list compact">
              <li><span>Status</span><span>{draft.status}</span></li>
              <li><span>Can apply</span><span>{draft.canApply ? 'yes' : 'no'}</span></li>
              <li><span>Restart</span><span>{draft.requiresRestart}</span></li>
              <li><span>Matched</span><span>{draft.matchedSettings.map((setting) => setting.key).join(', ')}</span></li>
              {draft.missingSettings.length > 0 ? <li><span>Missing</span><span>{draft.missingSettings.join(', ')}</span></li> : null}
            </ul>
            <p className="subtle">{draft.description}</p>
            <button type="button" className="review-button approve-button" onClick={() => onEditDraft(draft)}>
              Edit dashboard draft
            </button>
          </section>
        ))}
      </div>

      <div className="trust-warning-row">
        {catalog.safetyNotes.slice(0, 3).map((note) => (
          <span key={note}>{note}</span>
        ))}
      </div>
    </article>
  );
}

interface EventTemplateDraftEditDrawerProps {
  draft: EventTemplateDraftCatalog['drafts'][number];
  displayName: string;
  targetMultiplier: string;
  targetValue: string;
  durationHours: string;
  notes: string;
  scheduleLabel: string;
  enabledInDashboard: boolean;
  saving: boolean;
  error: string | null;
  success: string | null;
  configDiffPreview: EventTemplateConfigDiffPreview | null;
  configDiffLoading: boolean;
  configDiffError: string | null;
  manualChecklist: EventTemplateManualChangeChecklist | null;
  manualChecklistLoading: boolean;
  manualChecklistError: string | null;
  manualEditPlan: EventTemplateManualEditPlan | null;
  manualEditPlanLoading: boolean;
  manualEditPlanError: string | null;
  onDisplayNameChange: (value: string) => void;
  onTargetMultiplierChange: (value: string) => void;
  onTargetValueChange: (value: string) => void;
  onDurationHoursChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onScheduleLabelChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void;
  onSave: () => void;
  onClose: () => void;
}

function EventTemplateDraftEditDrawer({
  draft,
  displayName,
  targetMultiplier,
  targetValue,
  durationHours,
  notes,
  scheduleLabel,
  enabledInDashboard,
  saving,
  error,
  success,
  configDiffPreview,
  configDiffLoading,
  configDiffError,
  manualChecklist,
  manualChecklistLoading,
  manualChecklistError,
  manualEditPlan,
  manualEditPlanLoading,
  manualEditPlanError,
  onDisplayNameChange,
  onTargetMultiplierChange,
  onTargetValueChange,
  onDurationHoursChange,
  onNotesChange,
  onScheduleLabelChange,
  onEnabledChange,
  onSave,
  onClose
}: EventTemplateDraftEditDrawerProps) {
  return (
    <div className="player-drawer-shell" role="presentation">
      <button type="button" className="player-drawer-backdrop" aria-label="Close event template draft editor" onClick={onClose} />
      <aside className="player-drawer" aria-label="Event template draft editor">
        <div className="player-drawer-header">
          <div>
            <span className="state-pill state-warning">Dashboard draft only</span>
            <h2>{draft.displayName ?? draft.name}</h2>
            <p>No server settings will be changed.</p>
          </div>
          <button type="button" className="player-drawer-close" onClick={onClose}>Close</button>
        </div>

        {error ? <p className="player-drawer-error">{error}</p> : null}
        {success ? <p className="success-message">{success}</p> : null}

        <section className="player-drawer-sessions">
          <h3>Draft details</h3>
          <div className="review-actions-form">
            <label className="review-field">
              <span>Show in dashboard</span>
              <input type="checkbox" checked={enabledInDashboard} onChange={(event) => onEnabledChange(event.target.checked)} />
            </label>
            <label className="review-field">
              <span>Display name</span>
              <input type="text" value={displayName} onChange={(event) => onDisplayNameChange(event.target.value)} placeholder={draft.name} />
            </label>
            <label className="review-field">
              <span>Target multiplier</span>
              <input type="number" min="0" step="0.1" value={targetMultiplier} onChange={(event) => onTargetMultiplierChange(event.target.value)} placeholder="optional" />
            </label>
            <label className="review-field">
              <span>Target value</span>
              <input type="text" value={targetValue} onChange={(event) => onTargetValueChange(event.target.value)} placeholder="optional" />
            </label>
            <label className="review-field">
              <span>Duration hours</span>
              <input type="number" min="0" step="0.5" value={durationHours} onChange={(event) => onDurationHoursChange(event.target.value)} placeholder="optional" />
            </label>
            <label className="review-field">
              <span>Schedule label</span>
              <input type="text" value={scheduleLabel} onChange={(event) => onScheduleLabelChange(event.target.value)} placeholder="Friday evening" />
            </label>
            <label className="review-field">
              <span>Notes</span>
              <input type="text" value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="owner note" />
            </label>
          </div>
          <section className="event-draft-preview">
            <h3>Change Preview</h3>
            {draft.changePreviews.length === 0 ? (
              <p className="subtle">No matched settings are available to preview.</p>
            ) : (
              <ul>
                {draft.changePreviews.slice(0, 6).map((preview) => (
                  <li key={preview.settingKey}>
                    <span>{preview.settingLabel}</span>
                    <span>{formatObservedSettingValue(preview.currentValue)} {'->'} {formatObservedSettingValue(preview.proposedValue)}</span>
                    <span className={`confidence-badge confidence-${preview.canPreview ? getObservedSettingRiskTone(preview.changeRisk) : 'low'}`}>
                      {preview.canPreview ? preview.riskLabel : 'limited'}
                    </span>
                    <span className="subtle">{preview.differenceLabel}</span>
                    {preview.previewWarnings.slice(0, 2).map((warning) => (
                      <span key={warning} className="subtle">{warning}</span>
                    ))}
                  </li>
                ))}
                {draft.changePreviews.length > 6 ? (
                  <li><span className="subtle">{draft.changePreviews.length - 6} more setting previews.</span></li>
                ) : null}
              </ul>
            )}
          </section>
          <section className="event-draft-preview">
            <h3>Config Diff Preview</h3>
            {configDiffLoading ? <p className="subtle">Loading config diff preview...</p> : null}
            {configDiffError ? <p className="player-drawer-error">{configDiffError}</p> : null}
            {!configDiffLoading && !configDiffError && !configDiffPreview ? (
              <p className="subtle">No config diff preview loaded.</p>
            ) : null}
            {configDiffPreview ? (
              <>
                <ul>
                  <li><span>Status</span><span>{configDiffPreview.previewStatus}</span></li>
                  <li><span>Target config</span><span>{configDiffPreview.targetConfigPath ?? 'none selected'}</span></li>
                  <li><span>Discovered config</span><span>{configDiffPreview.selectedConfigPath ?? 'none selected'}</span></li>
                  <li><span>Runtime alignment</span><span>{configDiffPreview.runtimeAlignmentStatus}</span></li>
                  {configDiffPreview.changes.slice(0, 6).map((change) => (
                    <li key={change.key}>
                      <span>{change.key}</span>
                      <span>{formatObservedSettingValue(change.currentFileValue)} {'->'} {formatObservedSettingValue(change.proposedValue)}</span>
                      <span className="confidence-badge confidence-medium">{change.riskLabel}</span>
                      <span className="subtle">Observed {formatObservedSettingValue(change.currentObservedValue)} • {change.valueType}</span>
                      {change.warningNotes.slice(0, 2).map((warning) => (
                        <span key={warning} className="subtle">{warning}</span>
                      ))}
                    </li>
                  ))}
                  {configDiffPreview.missingKeys.length > 0 ? (
                    <li><span>Missing keys</span><span>{configDiffPreview.missingKeys.join(', ')}</span></li>
                  ) : null}
                  {configDiffPreview.unmappedSettings.length > 0 ? (
                    <li><span>Unmapped</span><span>{configDiffPreview.unmappedSettings.join(', ')}</span></li>
                  ) : null}
                  {configDiffPreview.safetyWarnings.slice(0, 2).map((warning) => (
                    <li key={warning}><span className="subtle">{warning}</span></li>
                  ))}
                </ul>
                <p className="subtle">{configDiffPreview.reasonApplyDisabled}</p>
              </>
            ) : null}
          </section>
          <section className="event-draft-preview">
            <h3>Manual Change Checklist</h3>
            <p className="subtle">This does not change the server. It only tells you what would need to be checked manually.</p>
            {manualChecklistLoading ? <p className="subtle">Loading manual checklist...</p> : null}
            {manualChecklistError ? <p className="player-drawer-error">{manualChecklistError}</p> : null}
            {!manualChecklistLoading && !manualChecklistError && !manualChecklist ? (
              <p className="subtle">No manual checklist loaded.</p>
            ) : null}
            {manualChecklist ? (
              <>
                <ul>
                  <li><span>Status</span><span>{manualChecklist.checklistStatus}</span></li>
                  {manualChecklist.checklistItems.map((item) => (
                    <li key={item.label}>
                      <span>{item.label}</span>
                      <span className={`confidence-badge confidence-${item.status === 'pass' ? 'high' : item.status === 'blocked' ? 'low' : 'medium'}`}>
                        {item.status}
                      </span>
                      <span className="subtle">{item.detail}</span>
                    </li>
                  ))}
                </ul>
                <ul>
                  {manualChecklist.requiredManualSteps.slice(0, 6).map((step) => (
                    <li key={step}><span>{step}</span></li>
                  ))}
                </ul>
                <p className="subtle">{manualChecklist.ownerConfirmationText}</p>
                <p className="subtle">{manualChecklist.reasonApplyDisabled}</p>
              </>
            ) : null}
          </section>
          <section className="event-draft-preview">
            <h3>Manual Edit Plan</h3>
            <p className="subtle">This is instructions only. GameOps will not change the server.</p>
            {manualEditPlanLoading ? <p className="subtle">Loading manual edit plan...</p> : null}
            {manualEditPlanError ? <p className="player-drawer-error">{manualEditPlanError}</p> : null}
            {!manualEditPlanLoading && !manualEditPlanError && !manualEditPlan ? (
              <p className="subtle">No manual edit plan loaded.</p>
            ) : null}
            {manualEditPlan ? (
              <>
                <ul>
                  <li><span>Status</span><span>{manualEditPlan.planStatus}</span></li>
                  <li><span>Target config</span><span>{manualEditPlan.targetConfigPath ?? 'unknown'}</span></li>
                  <li><span>Changes</span><span>{manualEditPlan.exactChanges.length}</span></li>
                </ul>
                <textarea
                  className="manual-edit-plan-text"
                  value={manualEditPlan.copyableText}
                  readOnly
                  aria-label="Copyable manual edit plan"
                  rows={12}
                />
                {manualEditPlan.warnings.length > 0 ? (
                  <ul>
                    {manualEditPlan.warnings.slice(0, 3).map((warning) => (
                      <li key={warning}><span className="subtle">{warning}</span></li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
          </section>
          <ul>
            <li><span>Can apply</span><span>{draft.canApply ? 'yes' : 'no'}</span></li>
            <li><span>{draft.reasonApplyDisabled}</span></li>
          </ul>
          <button type="button" className="review-button approve-button" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save dashboard draft'}
          </button>
        </section>
      </aside>
    </div>
  );
}

interface PlayerEngagementDetailDrawerProps {
  detail: PlayerEngagementDetail;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

function PlayerEngagementDetailDrawer({ detail, loading, error, onClose }: PlayerEngagementDetailDrawerProps) {
  return (
    <div className="player-drawer-shell" role="presentation">
      <button type="button" className="player-drawer-backdrop" aria-label="Close player engagement detail" onClick={onClose} />
      <aside className="player-drawer" aria-label="Player engagement detail">
        <div className="player-drawer-header">
          <div>
            <span className={`state-pill state-${detail.status === 'active_now' ? 'online' : detail.status === 'unknown' ? 'unknown' : 'offline'}`}>
              {detail.statusLabel}
            </span>
            <h2>{detail.displayName}</h2>
            <p>{detail.lastSeenAt ? `Last seen ${formatTimestamp(detail.lastSeenAt)}` : 'Last seen unknown'}</p>
          </div>
          <button type="button" className="player-drawer-close" onClick={onClose}>Close</button>
        </div>

        {loading ? <p className="subtle">Refreshing engagement detail...</p> : null}
        {error ? <p className="player-drawer-error">{error}</p> : null}

        <section className="player-drawer-sessions">
          <h3>Why they matter</h3>
          <ul>
            {detail.whyTheyMatter.map((note) => (
              <li key={note}><span>{note}</span></li>
            ))}
          </ul>
        </section>

        <section className="player-drawer-sessions">
          <h3>Recent activity</h3>
          <dl className="player-drawer-grid">
            <dt>First seen</dt>
            <dd>{detail.firstSeenAt ? formatTimestamp(detail.firstSeenAt) : 'Unknown'}</dd>
            <dt>Last seen</dt>
            <dd>{detail.lastSeenAt ? formatTimestamp(detail.lastSeenAt) : 'Unknown'}</dd>
            <dt>7d sessions</dt>
            <dd>{detail.sevenDays.sessions}</dd>
            <dt>30d sessions</dt>
            <dd>{detail.thirtyDays.sessions}</dd>
          </dl>
          <ul>
            {detail.recentSessions.length === 0 ? <li className="empty-line">No recent session rows available.</li> : null}
            {detail.recentSessions.slice(0, 5).map((session) => (
              <li key={session.sessionId}>
                <span>{session.endedAt ? formatDurationFromSeconds(session.durationSeconds) : 'active'}</span>
                <span>{session.endedAt ? formatTimestamp(session.endedAt) : `Joined ${formatTimestamp(session.startedAt)}`}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="player-drawer-sessions">
          <h3>Playtime tracked</h3>
          <dl className="player-drawer-grid">
            <dt>Total sessions</dt>
            <dd>{detail.totalSessions}</dd>
            <dt>Total playtime</dt>
            <dd>{formatDurationFromSeconds(detail.totalTrackedSeconds)}</dd>
            <dt>Average session</dt>
            <dd>{formatDurationFromSeconds(detail.averageSessionSeconds)}</dd>
            <dt>7d playtime</dt>
            <dd>{formatDurationFromSeconds(detail.sevenDays.trackedSeconds)}</dd>
            <dt>30d playtime</dt>
            <dd>{formatDurationFromSeconds(detail.thirtyDays.trackedSeconds)}</dd>
          </dl>
        </section>

        <section className="player-drawer-sessions">
          <h3>Trend</h3>
          <ul>
            <li><span>{getPlayerEngagementTrendLabel(detail)}</span></li>
            <li>
              <span>This week</span>
              <span>{detail.current7dSessions} sessions / {formatDurationFromSeconds(detail.current7dPlaySeconds)}</span>
            </li>
            <li>
              <span>Previous week</span>
              <span>{detail.previous7dSessions} sessions / {formatDurationFromSeconds(detail.previous7dPlaySeconds)}</span>
            </li>
            {detail.trendReasons.map((reason) => (
              <li key={reason}><span className="subtle">{reason}</span></li>
            ))}
            {detail.trendConfidenceWarning ? (
              <li><span className="subtle">{detail.trendConfidenceWarning}</span></li>
            ) : null}
          </ul>
        </section>

        <section className="player-drawer-sessions">
          <h3>Confidence / data quality</h3>
          <ul>
            <li><span>Confidence</span><span>{detail.confidence}</span></li>
            {detail.confidenceWarnings.length === 0 ? <li><span>No confidence warnings for this player.</span></li> : null}
            {detail.confidenceWarnings.map((warning) => (
              <li key={warning}><span>{warning}</span></li>
            ))}
            {detail.evidenceNotes.map((note) => (
              <li key={note}><span className="subtle">{note}</span></li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function PlayerIntelligencePanel({ players, explanation, freshness, selectedPlayerId, onSelectPlayer }: PlayerIntelligencePanelProps) {
  return (
    <article className="card player-intelligence-card">
      <div className="panel-title-row">
        <h2>Players</h2>
        <FreshnessInlineLabel freshness={freshness} />
      </div>
      <p className="subtle">{explanation}</p>
      <ul className="list player-intelligence-list">
        {players.length === 0 ? (
          <li className="empty-line">This world has not recorded enough player history yet.</li>
        ) : null}
        {players.map((player) => (
          <li
            key={player.playerId}
            className={`player-intelligence-row clickable-row ${selectedPlayerId === player.playerId ? 'selected' : ''}`}
            onClick={() => onSelectPlayer(player.playerId)}
          >
            <div className="player-intelligence-main">
              <div className="player-intelligence-heading">
                <strong>{player.displayName}</strong>
                <span className={`state-pill state-${player.isOnline ? 'online' : 'offline'}`}>
                  {player.isOnline ? 'online' : 'offline'}
                </span>
                <span className={`confidence-badge confidence-${player.identityConfidence === 'unknown' ? 'low' : player.identityConfidence}`}>
                  {player.identityConfidence}
                </span>
              </div>
              <div className="player-intelligence-meta">
                <span>Last seen {player.lastSeenAt ? formatTimestamp(player.lastSeenAt) : 'not yet'}</span>
                <span>Tracked playtime {formatDurationFromSeconds(player.totalTrackedSeconds)}</span>
                <span>{player.sessionCount} session{player.sessionCount === 1 ? '' : 's'}</span>
                <span>avg {formatDurationFromSeconds(player.averageSessionSeconds)}</span>
                {player.sourceSummary.includes('stored rollup') ? <span>Last known from stored rollup</span> : null}
              </div>
              <div className="subtle">{player.identityExplanation}</div>
              {!player.isOnline && player.sourceSummary.includes('stored rollup') ? (
                <div className="subtle">Connector has not reported current activity for this player in this view.</div>
              ) : null}
              {player.sourceSummary.length > 0 ? (
                <div className="subtle">Sources: {player.sourceSummary.join(', ')}</div>
              ) : null}
              {player.aliases.length > 0 ? (
                <div className="subtle">Aliases: {player.aliases.slice(0, 4).join(', ')}</div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

interface ValheimCharacterIntelligencePanelProps {
  characters: ValheimCharacterEntry[];
  onSelectCharacter: (character: ValheimCharacterEntry) => void;
}

function ValheimCharacterIntelligencePanel({ characters, onSelectCharacter }: ValheimCharacterIntelligencePanelProps) {
  return (
    <article className="card valheim-character-card">
      <div className="panel-title-row">
        <div>
          <span className="summary-label">Valheim Characters</span>
          <h2>Character Intelligence</h2>
          <p className="subtle">Characters are based on trusted session and identity observations for this realm.</p>
        </div>
      </div>

      {characters.length === 0 ? (
        <p className="empty-line">This realm has not recorded enough character history yet.</p>
      ) : null}

      <ul className="valheim-character-list">
        {characters.map((character) => (
          <li key={character.id} className="valheim-character-row">
            <div className="valheim-character-main">
              <div className="valheim-character-title">
                <button type="button" className="inline-player-link" onClick={() => onSelectCharacter(character)}>
                  {character.name}
                </button>
                <span className={`state-pill state-${character.isOnline ? 'online' : 'offline'}`}>
                  {character.isOnline ? 'online' : 'offline'}
                </span>
                <span className={`confidence-badge confidence-${character.identityConfidence === 'unknown' ? 'low' : character.identityConfidence}`}>
                  {character.identityConfidence}
                </span>
                {character.importedCharacter ? (
                  <span className="imported-character-badge">{character.importedCharacter.label}</span>
                ) : null}
              </div>
              <div className="valheim-character-meta">
                <span>First seen {character.firstSeenAt ? formatTimestamp(character.firstSeenAt) : 'unknown'}</span>
                <span>Last seen {character.lastSeenAt ? formatTimestamp(character.lastSeenAt) : 'unknown'}</span>
                <span>{character.sessionCount} session{character.sessionCount === 1 ? '' : 's'}</span>
                <span>{formatDurationFromSeconds(character.totalTrackedSeconds)} tracked</span>
              </div>
              <p className="subtle">{character.identityExplanation}</p>
              {character.importedCharacter ? (
                <p className="subtle">Evidence: {character.importedCharacter.evidence}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

interface PlayerDetailPanelProps {
  detail: PlayerDetailResponse | null;
  loading: boolean;
  error: string | null;
}

function PlayerDetailPanel({ detail, loading, error }: PlayerDetailPanelProps) {
  return (
    <article className="card player-detail-card">
      <h2>Player Detail</h2>
      {loading ? <p className="subtle">Loading player detail...</p> : null}
      {error ? <p className="subtle">{error}</p> : null}
      {!detail && !loading && !error ? <p className="subtle">Select a player to review sessions, aliases, and identity evidence.</p> : null}
      {detail ? (
        <div className="player-detail-grid">
          <section className="detail-block">
            <h3>{detail.player.displayName}</h3>
            <p className="subtle">{detail.status}</p>
            <ul className="list compact">
              <li><span>Status</span><span>{detail.player.isOnline ? 'Online' : 'Offline'}</span></li>
              <li><span>Tracked Playtime</span><span>{formatDurationFromSeconds(detail.player.trackedPlaytimeSeconds)}</span></li>
              <li><span>Sessions</span><span>{detail.player.sessionCount}</span></li>
              <li><span>Average Session</span><span>{formatDurationFromSeconds(detail.player.averageSessionSeconds)}</span></li>
              <li><span>First Seen</span><span>{detail.player.firstSeenAt ? formatTimestamp(detail.player.firstSeenAt) : 'Unknown'}</span></li>
              <li><span>Last Seen</span><span>{detail.player.lastSeenAt ? formatTimestamp(detail.player.lastSeenAt) : 'Unknown'}</span></li>
              <li><span>Confidence</span><span className={`confidence-badge confidence-${detail.player.identityConfidence === 'unknown' ? 'low' : detail.player.identityConfidence}`}>{detail.player.identityConfidence}</span></li>
            </ul>
            <p className="subtle">{detail.explanation}</p>
          </section>

          <section className="detail-block">
            <h3>Aliases & Hints</h3>
            <ul className="list compact">
              <li><span>Aliases</span><span>{detail.player.aliases.length > 0 ? detail.player.aliases.join(', ') : 'None observed'}</span></li>
              {Object.entries(detail.player.gameFields ?? {}).slice(0, 6).map(([key, value]) => (
                <li key={key}><span>{key}</span><span>{String(value ?? 'Unknown')}</span></li>
              ))}
              {Object.keys(detail.player.gameFields ?? {}).length === 0 ? <li><span>Game Fields</span><span>None available</span></li> : null}
            </ul>
          </section>

          <section className="detail-block">
            <h3>Recent Adventures</h3>
            <ul className="list compact">
              {detail.recentSessions.length === 0 ? <li>This player has not recorded enough adventure history yet.</li> : null}
              {detail.recentSessions.map((session) => (
                <li key={session.sessionId}>
                  <span>{formatTimestamp(session.startedAt)}</span>
                  <span className="subtle">
                    {session.endedAt ? formatDurationFromSeconds(session.durationSeconds) : 'active'}
                    {session.closeReason ? ` · ${session.closeReason}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="detail-block">
            <h3>Evidence</h3>
            <ul className="list compact">
              {detail.evidence.map((item, index) => (
                <li key={`${item.type}:${index}`}>
                  <span>{item.label}</span>
                  <span className="subtle">{item.description}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </article>
  );
}

interface PlayerDetailDrawerProps {
  profile: PalworldPlayerProfileSessionSummary;
  onClose: () => void;
  savePlayerSaveId: string;
  savePlayerFileName: string;
  notes: string;
  error: string | null;
  success: string | null;
  submitting: boolean;
  onSavePlayerSaveIdChange: (value: string) => void;
  onSavePlayerFileNameChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
}

function PlayerDetailDrawer({
  profile,
  onClose,
  savePlayerSaveId,
  savePlayerFileName,
  notes,
  error,
  success,
  submitting,
  onSavePlayerSaveIdChange,
  onSavePlayerFileNameChange,
  onNotesChange,
  onSubmit
}: PlayerDetailDrawerProps) {
  const lastSessionEndedAt = profile.lastSessionEndedAt ?? profile.recentSessions[0]?.endedAt ?? null;
  const lastSessionDurationSeconds = profile.lastSessionDurationSeconds ?? profile.recentSessions[0]?.durationSeconds;
  const playerDisplayName = getProfileDisplayName(profile);
  const timelineItems = buildSessionTimelineItems(profile.recentSessions, playerDisplayName);
  const playerFacts: WorldMemoryFact[] = [
    { label: 'Status', value: profile.isOnline ? 'Online' : 'Offline' },
    { label: 'Level', value: profile.profile.level ?? 'N/A' },
    { label: 'Save', value: formatSaveLinkLabel(profile.saveArtifact.present) },
    { label: 'Last adventure', value: formatDurationMaybe(lastSessionDurationSeconds) },
    { label: 'First seen', value: profile.profile.firstSeenAt ? formatTimestamp(profile.profile.firstSeenAt) : 'N/A' },
    { label: 'Last seen', value: profile.profile.lastSeenAt ? formatTimestamp(profile.profile.lastSeenAt) : 'N/A' },
    { label: '7d playtime', value: formatDurationFromSeconds(profile.trackedSeconds7d) }
  ];

  if (profile.isOnline) {
    playerFacts.splice(3, 0, { label: 'Current adventure', value: formatDurationMaybe(profile.currentSessionDurationSeconds ?? undefined) });
  }

  return (
    <div className="player-drawer-shell" role="presentation">
      <button type="button" className="player-drawer-backdrop" aria-label="Close player details" onClick={onClose} />
      <aside className="player-drawer" aria-label="Player details">
        <div className="player-drawer-header">
          <div>
            <span className={`state-pill state-${profile.isOnline ? 'online' : 'offline'}`}>
              {profile.isOnline ? 'online' : 'offline'}
            </span>
            <h2>{playerDisplayName}</h2>
            {profile.inferredGuildName ? <p>{profile.inferredGuildName}</p> : null}
          </div>
          <button type="button" className="player-drawer-close" onClick={onClose}>Close</button>
        </div>

        <WorldMemoryFactGrid facts={playerFacts} />

        <section className="player-drawer-actions world-memory-drawer-section-quiet">
          <h3>Actions</h3>
          {profile.saveArtifact.present ? (
            <span className="player-drawer-action-status">Save linked</span>
          ) : (
            <div className="player-drawer-action-form">
              <label className="player-drawer-field">
                <span>Save Player ID</span>
                <input
                  type="text"
                  value={savePlayerSaveId}
                  onChange={(event) => onSavePlayerSaveIdChange(event.target.value)}
                  placeholder="required"
                  required
                />
              </label>
              <label className="player-drawer-field">
                <span>Save File Name</span>
                <input
                  type="text"
                  value={savePlayerFileName}
                  onChange={(event) => onSavePlayerFileNameChange(event.target.value)}
                  placeholder="optional"
                />
              </label>
              <label className="player-drawer-field">
                <span>Notes</span>
                <input
                  type="text"
                  value={notes}
                  onChange={(event) => onNotesChange(event.target.value)}
                  placeholder="optional"
                />
              </label>
              {error ? <p className="player-drawer-error">{error}</p> : null}
              {success ? <p className="player-drawer-success">{success}</p> : null}
              <button type="button" onClick={onSubmit} disabled={submitting}>
                {submitting ? 'Linking...' : 'Link Save'}
              </button>
            </div>
          )}
        </section>

        <WorldMemoryLivingTimeline
          items={timelineItems}
          emptyMessage="More adventures will appear as this player explores."
        />

        <details className="world-memory-operator-details">
          <summary>Operator Details</summary>
          <dl>
            <dt>Last ended</dt>
            <dd>{lastSessionEndedAt ? formatTimestamp(lastSessionEndedAt) : 'N/A'}</dd>
            <dt>24h playtime</dt>
            <dd>{formatDurationFromSeconds(profile.trackedSeconds24h)}</dd>
            <dt>30d playtime</dt>
            <dd>{formatDurationFromSeconds(profile.trackedSeconds30d)}</dd>
            <dt>Save player ID</dt>
            <dd><code>{profile.profile.playerId}</code></dd>
          </dl>
        </details>
      </aside>
    </div>
  );
}

interface GuildRiskRowProps {
  guild: PalworldGuildActivityEntry;
  reviewed: boolean;
  onOpen: () => void;
  onMarkReviewed: () => void;
}

function GuildRiskRow({ guild, reviewed, onOpen, onMarkReviewed }: GuildRiskRowProps) {
  const riskText = guild.daysInactive !== null
    ? `${guild.daysInactive}d inactive`
    : guild.daysUntilPalboxRisk !== null
      ? `${guild.daysUntilPalboxRisk}d to risk`
      : null;
  const riskLabel = guild.riskLevel === 'unknown' ? 'No activity data' : guild.riskLevel;
  const lastActivityLabel = guild.lastMemberSeenAt
    ? `Last activity: ${guild.lastSeenMemberName ?? 'Unknown member'}${guild.daysInactive !== null ? ` — ${guild.daysInactive}d ago` : ''}`
    : 'No tracked players yet';
  const palboxRiskLabel = guild.daysUntilPalboxRisk !== null ? `${guild.daysUntilPalboxRisk}d to palbox risk` : 'Activity unknown';
  const confidence = getGuildConfidence(guild.members, guild.memberCount);

  return (
    <li className="guild-activity-row">
      <button type="button" className="guild-activity-toggle" onClick={onOpen}>
        <div className="homepage-player-main">
          <div className="homepage-player-title">
            <span className="homepage-player-name">{guild.guildName}</span>
            <span className="guild-risk-badge-group">
              <span className={`guild-risk-badge guild-risk-${guild.riskLevel}`}>{riskLabel}</span>
              {reviewed ? <span className="guild-reviewed-pill">Reviewed</span> : null}
            </span>
          </div>
          <div className="homepage-player-meta">
            <span>{guild.memberCount} members</span>
            <span className={`guild-confidence-pill guild-confidence-${confidence.tone}`}>{confidence.label}</span>
            <span>{lastActivityLabel}</span>
            <span>{palboxRiskLabel}</span>
            {riskText ? <span>{riskText}</span> : null}
          </div>
        </div>
        <span className="homepage-player-detail-button" aria-hidden="true">Details</span>
      </button>
      {reviewed ? null : (
        <button type="button" className="guild-row-review-button" onClick={onMarkReviewed}>
          Mark Reviewed
        </button>
      )}
    </li>
  );
}

interface GuildActivityDetailProps {
  guildName: string;
  members: PalworldGuildActivityMember[];
  memberCount: number;
  reviewed: boolean;
  onMarkReviewed: () => void;
}

function GuildActivityDetail({ guildName, members, memberCount, reviewed, onMarkReviewed }: GuildActivityDetailProps) {
  const sortedMembers = [...members].sort((left, right) => {
    if (Number(right.matched) !== Number(left.matched)) {
      return Number(right.matched) - Number(left.matched);
    }

    return (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? '');
  });
  const confidence = getGuildConfidence(sortedMembers, memberCount);

  return (
    <div className="guild-activity-detail">
      <div className="guild-activity-detail-meta">
        <span>Tracked members: {confidence.trackedCount} / {confidence.totalCount}</span>
        <span className={`guild-confidence-pill guild-confidence-${confidence.tone}`}>Confidence: {confidence.shortLabel}</span>
      </div>
      <ul className="guild-member-list">
        {sortedMembers.length === 0 ? <li className="empty-line">No members listed in guild data</li> : null}
        {sortedMembers.map((member, index) => (
          <li key={`${member.memberName}:${index}`} className="guild-member-row">
            <div>
              <span className="guild-member-name">{member.memberName}</span>
              <span className={`guild-member-match ${member.matched ? 'matched' : 'unmatched'}`}>
                {member.matched ? 'tracked' : 'no player data'}
              </span>
            </div>
            <div className="guild-member-meta">
              {!member.matched ? <span>never seen</span> : null}
              {member.matched && member.lastSeenAt ? <span>{formatTimestamp(member.lastSeenAt)}</span> : null}
              {member.matched && member.daysSinceSeen !== null ? <span>{member.daysSinceSeen}d ago</span> : null}
              {member.matched && member.level !== null ? <span>lvl {member.level}</span> : null}
              {member.matched && member.saveLinked !== null ? <span>{member.saveLinked ? 'Save linked' : 'Save link needed'}</span> : null}
              {member.matched && member.matchedPlayerName && member.matchedPlayerName !== member.memberName ? <span>as {member.matchedPlayerName}</span> : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="guild-activity-actions">
        <span>Actions</span>
        {reviewed ? (
          <span className="guild-activity-reviewed-status">Reviewed</span>
        ) : (
          <button
            type="button"
            onClick={() => {
              console.log('Mark guild reviewed', { guildName });
              onMarkReviewed();
            }}
          >
            Mark Reviewed
          </button>
        )}
      </div>
    </div>
  );
}

interface PalworldGuildIntelligencePanelProps {
  guilds: PalworldGuildIntelligence[];
  selectedGuildName: string | null;
  reviewedGuildNames: Set<string>;
  onOpenGuild: (guildName: string) => void;
}

function PalworldGuildIntelligencePanel({ guilds, selectedGuildName, reviewedGuildNames, onOpenGuild }: PalworldGuildIntelligencePanelProps) {
  return (
    <article className="card palworld-guild-intelligence-card">
      <div className="command-panel-heading">
        <div>
          <span className="summary-label">Guilds</span>
          <h2>Guilds Shaping This World</h2>
          <p className="subtle">Guild activity is based on matched save data and tracked player activity for this server.</p>
        </div>
        <span className="state-pill state-online">{guilds.length} guilds</span>
      </div>

      {guilds.length === 0 ? (
        <p className="empty-line">This archipelago is still building its history. Guild activity will appear as players establish themselves.</p>
      ) : null}

      <ul className="palworld-guild-grid">
        {guilds.map(({ guild, confidence, activeMemberCount, activityState, lifecycleState, lifecycleDetail }) => (
          <li key={guild.guildName} className={`palworld-guild-card ${selectedGuildName === guild.guildName ? 'selected' : ''}`}>
            <button type="button" onClick={() => onOpenGuild(guild.guildName)}>
              <div className="palworld-guild-card-top">
                <strong>{guild.guildName}</strong>
                <span className={`guild-risk-badge guild-risk-${guild.riskLevel}`}>{activityState}</span>
              </div>
              <div className="palworld-guild-card-stats">
                <span><strong>{guild.memberCount}</strong> members</span>
                <span><strong>{activeMemberCount}</strong> active</span>
                <span>{guild.lastMemberSeenAt ? formatRelativeTime(guild.lastMemberSeenAt) : 'No activity yet'}</span>
              </div>
              <div className="palworld-guild-card-meta">
                <span className={`guild-confidence-pill guild-confidence-${confidence.tone}`}>{confidence.label}</span>
                <span>{lifecycleState}</span>
                {reviewedGuildNames.has(guild.guildName) ? <span>Reviewed</span> : null}
              </div>
              <p>{lifecycleDetail}</p>
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

interface PalworldBaseLifecyclePanelProps {
  guilds: PalworldGuildIntelligence[];
  hasBaseTelemetry: boolean;
  baseCapacity: { estimatedBases: number; usagePercent: number; remainingCapacity: number; statusLabel: string; summary: string } | null;
  baseTrend: { direction: string; indicator: string; recentValues: number[] };
}

function PalworldBaseLifecyclePanel({ guilds, hasBaseTelemetry, baseCapacity, baseTrend }: PalworldBaseLifecyclePanelProps) {
  const guildsWithActivity = guilds.filter((entry) => entry.guild.lastMemberSeenAt !== null);
  const lifecycleGuilds = guilds.filter((entry) => entry.guild.riskLevel !== 'unknown');
  const watchGuilds = guilds.filter((entry) => entry.guild.riskLevel === 'watch' || entry.guild.riskLevel === 'risk' || entry.guild.riskLevel === 'expired');

  return (
    <article className="card palworld-base-lifecycle-card">
      <div className="command-panel-heading">
        <div>
          <span className="summary-label">Base Lifecycle</span>
          <h2>30-Day Base Deletion Window</h2>
          <p className="subtle">Lifecycle state is tied to observed guild activity. Base ownership is not shown until trusted base-to-guild evidence exists.</p>
        </div>
      </div>
      <div className="detail-grid">
        <section className="detail-block">
          <h3>Guild Activity Coverage</h3>
          <ul className="list compact">
            <li><span>Guilds with activity</span><span>{guildsWithActivity.length} / {guilds.length}</span></li>
            <li><span>Lifecycle-ready guilds</span><span>{lifecycleGuilds.length}</span></li>
            <li><span>Needs attention</span><span>{watchGuilds.length}</span></li>
          </ul>
        </section>
        <section className="detail-block">
          <h3>Base Signal</h3>
          {hasBaseTelemetry && baseCapacity ? (
            <ul className="list compact">
              <li><span>Estimated bases</span><span>{baseCapacity.estimatedBases} / 240</span></li>
              <li><span>Usage</span><span>{baseCapacity.usagePercent}%</span></li>
              <li><span>Remaining slots</span><span>{baseCapacity.remainingCapacity}</span></li>
              <li><span>Trend</span><span>{baseTrend.indicator} {baseTrend.direction}</span></li>
            </ul>
          ) : (
            <p className="subtle">Base capacity telemetry is not available yet. Guild lifecycle can still use member activity, but base ownership remains unconfirmed.</p>
          )}
        </section>
      </div>
    </article>
  );
}

interface PalworldGuildDrawerProps {
  guild: PalworldGuildActivityEntry;
  reviewed: boolean;
  memoryDetail: WorldMemoryDetailModel | null;
  records: WorldMemoryRecord[];
  onClose: () => void;
  onMarkReviewed: () => void;
}

function PalworldGuildDrawer({ guild, reviewed, memoryDetail, records, onClose, onMarkReviewed }: PalworldGuildDrawerProps) {
  const confidence = getGuildConfidence(guild.members, guild.memberCount);
  const activeMembers = guild.members.filter((member) => member.daysSinceSeen !== null && member.daysSinceSeen <= 7);
  const memberRelationships = memoryDetail?.relationships.filter((relationship) => relationship.type === 'guild_member') ?? [];
  const timelineItems = buildPalworldGuildTimeline(guild, memoryDetail);
  const guildFacts: WorldMemoryFact[] = [
    { label: 'Members', value: guild.memberCount },
    { label: 'Active members', value: activeMembers.length },
    { label: 'Activity state', value: <span className={`guild-risk-badge guild-risk-${guild.riskLevel}`}>{getPalworldGuildActivityState(guild)}</span> },
    { label: 'Confidence', value: <span className={`guild-confidence-pill guild-confidence-${confidence.tone}`}>{confidence.label}</span> },
    { label: 'First seen', value: memoryDetail?.record.firstSeenAt ? formatTimestamp(memoryDetail.record.firstSeenAt) : 'Not enough evidence' },
    { label: 'Last activity', value: guild.lastMemberSeenAt ? formatTimestamp(guild.lastMemberSeenAt) : 'Not enough evidence' },
    { label: 'Base lifecycle', value: getPalworldBaseLifecycleState(guild).state }
  ];

  return (
    <div className="player-drawer-shell" role="presentation">
      <button type="button" className="player-drawer-backdrop" aria-label="Close guild details" onClick={onClose} />
      <aside className="player-drawer palworld-guild-drawer" aria-label="Guild details">
        <div className="player-drawer-header">
          <div>
            <span className="summary-label">Guild Detail</span>
            <h2>{guild.guildName}</h2>
            <p>{guild.lastMemberSeenAt ? `Last activity ${formatRelativeTime(guild.lastMemberSeenAt)}` : 'No matched guild activity yet'}</p>
          </div>
          <button type="button" className="player-drawer-close" onClick={onClose}>Close</button>
        </div>

        <WorldMemoryFactGrid facts={guildFacts} />

        <GuildActivityDetail
          guildName={guild.guildName}
          members={guild.members}
          memberCount={guild.memberCount}
          reviewed={reviewed}
          onMarkReviewed={onMarkReviewed}
        />

        <WorldMemoryDrawerSection title="Related Memories">
          <ul className="world-memory-relationship-list">
            <li>
              <span>
                <strong>{guild.memberCount} known {guild.memberCount === 1 ? 'member' : 'members'}</strong>
                <small>{activeMembers.length} active this week from trusted member activity</small>
              </span>
            </li>
            {memberRelationships.length === 0 ? <li>No matched player memories are connected to this guild yet.</li> : null}
            {memberRelationships.slice(0, 6).map((relationship) => {
              const relatedRecord = memoryDetail ? getRelatedRecord(relationship, memoryDetail.record.id, records) : null;

              return (
                <li key={relationship.id}>
                  <span>
                    <strong>{relatedRecord?.displayName ?? 'Matched member'}</strong>
                    <small>{relatedRecord ? getWorldMemorySearchContext(relatedRecord) : 'Matched from guild member activity'}</small>
                  </span>
                  <span className={`confidence-badge confidence-${relationship.confidence === 'unknown' ? 'low' : relationship.confidence}`}>
                    {relationship.confidence}
                  </span>
                </li>
              );
            })}
            {memberRelationships.length > 6 ? <li>{memberRelationships.length - 6} more connected members.</li> : null}
          </ul>
        </WorldMemoryDrawerSection>

        <WorldMemoryLivingTimeline
          items={timelineItems}
          emptyMessage="This guild has only recently been remembered."
        />

        <WorldMemoryDrawerSection title="Base Lifecycle" quiet>
          <p className="subtle">Base records are not available yet. Guild activity is being tracked so future base lifecycle monitoring can use member recency.</p>
        </WorldMemoryDrawerSection>

        {memoryDetail ? <WorldMemoryOperatorDetails record={memoryDetail.record} relationshipCount={memoryDetail.relationships.length} /> : null}
      </aside>
    </div>
  );
}

interface PalworldBaseSignalHistoryEntry {
  timestamp: string;
  baseSignal: number;
}

type DashboardTab = 'overview' | 'operator' | 'highlights' | 'players' | 'characters' | 'review-saves' | 'guilds' | 'activity' | 'metrics' | 'ops' | 'diagnostics';
type WorkspaceView = 'overview' | 'valheim' | 'palworld';

const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
const REFRESH_INTERVAL_MS = 15_000;
const WARNING_GROUP_WINDOW_MS = 8 * 60 * 1000;
const LIVE_SIGNAL_WINDOW_MS = 10 * 60 * 1000;
const REVIEWED_GUILDS_STORAGE_PREFIX = 'gameops.reviewedGuilds.';

function getReviewedGuildsStorageKey(serverId: string): string {
  return `${REVIEWED_GUILDS_STORAGE_PREFIX}${serverId}`;
}

function loadReviewedGuildNames(serverId: string): Set<string> {
  if (!serverId) {
    return new Set();
  }

  try {
    const rawValue = window.localStorage.getItem(getReviewedGuildsStorageKey(serverId));

    if (!rawValue) {
      return new Set();
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsedValue)) {
      return new Set();
    }

    return new Set(parsedValue.filter((value): value is string => typeof value === 'string' && value.trim() !== ''));
  } catch {
    return new Set();
  }
}

function saveReviewedGuildNames(serverId: string, guildNames: Set<string>): void {
  if (!serverId) {
    return;
  }

  try {
    window.localStorage.setItem(getReviewedGuildsStorageKey(serverId), JSON.stringify([...guildNames]));
  } catch {
    // Ignore storage failures; review state is a dashboard convenience.
  }
}

async function loadPalworldGuilds(serverId: string): Promise<PalworldGuildHint[]> {
  const response = await fetch(`${apiBaseUrl}/servers/${serverId}/palworld/guilds`);

  if (!response.ok) {
    throw new Error(`Palworld guilds fetch failed with status ${response.status}`);
  }

  const payload = await response.json() as { guilds?: unknown };

  if (!Array.isArray(payload.guilds)) {
    throw new Error('Palworld guilds payload validation failed.');
  }

  return payload.guilds.filter((guild): guild is PalworldGuildHint => typeof guild === 'object' && guild !== null);
}

async function loadPalworldGuildActivity(serverId: string): Promise<PalworldGuildActivityEntry[]> {
  const response = await fetch(`${apiBaseUrl}/servers/${serverId}/palworld/guild-activity`);

  if (!response.ok) {
    throw new Error(`Palworld guild activity fetch failed with status ${response.status}`);
  }

  return palworldGuildActivityResponseSchema.parse(await response.json()).guilds;
}

function getConnectorStatusTone(status: ServerOperationalStatus['connectorStatus']): string {
  if (status === 'running') {
    return 'status-good';
  }

  if (status === 'degraded' || status === 'stale') {
    return 'status-warning';
  }

  if (status === 'error') {
    return 'status-critical';
  }

  return '';
}

function getTelemetryAvailabilityLabel(summary: ServerSummary): string {
  if (summary.game === 'palworld') {
    return summary.palworldLatestPlayers.length > 0 || summary.palworldRecentMetrics.length > 0
      ? 'available'
      : 'unavailable';
  }

  return summary.recentEvents.length > 0 || summary.knownPlayerCount > 0 || summary.activePlayers > 0
    ? 'available'
    : 'unavailable';
}

function getGameLabel(game: ServerOption['game']): string {
  return game === 'palworld' ? 'Palworld' : 'Valheim';
}

function getGameSymbol(game: ServerOption['game']): string {
  return game === 'palworld' ? 'P' : 'V';
}

function getLatestActivityLabel(summary: ServerSummary | undefined): string {
  if (!summary) {
    return 'Loading world activity';
  }

  const latestActivity = summary.activityLog[0]?.description
    ?? summary.recentEvents[0]?.eventType
    ?? summary.serverAliveRhythm.summary;

  return latestActivity || 'No recent activity yet';
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [serverOptions, setServerOptions] = useState<ServerOption[]>([]);
  const [fleetByServerId, setFleetByServerId] = useState<Record<string, ServerSummary>>({});
  const [serverOptionsLoading, setServerOptionsLoading] = useState(true);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [serverOptionsError, setServerOptionsError] = useState<string | null>(null);
  const [fleetError, setFleetError] = useState<string | null>(null);
  const [operatorBrief, setOperatorBrief] = useState<OperatorBriefResponse | null>(null);
  const [operatorBriefLoading, setOperatorBriefLoading] = useState(false);
  const [operatorBriefError, setOperatorBriefError] = useState<string | null>(null);
  const [operatorDailyBrief, setOperatorDailyBrief] = useState<OperatorDailyBriefResponse | null>(null);
  const [operatorDailyBriefLoading, setOperatorDailyBriefLoading] = useState(false);
  const [operatorDailyBriefError, setOperatorDailyBriefError] = useState<string | null>(null);
  const [operatorChanges, setOperatorChanges] = useState<OperatorChangesSummaryResponse | null>(null);
  const [operatorChangesLoading, setOperatorChangesLoading] = useState(false);
  const [operatorChangesError, setOperatorChangesError] = useState<string | null>(null);
  const [operatorInsights, setOperatorInsights] = useState<OperatorInsightsResponse | null>(null);
  const [operatorInsightsLoading, setOperatorInsightsLoading] = useState(false);
  const [operatorInsightsError, setOperatorInsightsError] = useState<string | null>(null);
  const [operatorTimelineEvents, setOperatorTimelineEvents] = useState<OperatorTimelineEvent[]>([]);
  const [operatorTimelineLoading, setOperatorTimelineLoading] = useState(false);
  const [operatorTimelineError, setOperatorTimelineError] = useState<string | null>(null);
  const [operatorMemoryIndex, setOperatorMemoryIndex] = useState<OperatorMemoryIndexResponse | null>(null);
  const [operatorMemoryIndexLoading, setOperatorMemoryIndexLoading] = useState(false);
  const [operatorMemoryIndexError, setOperatorMemoryIndexError] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceView>('overview');
  const [selectedGameFilter, setSelectedGameFilter] = useState<GameFilter>('all');
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [selectedValheimPlayerLookupKey, setSelectedValheimPlayerLookupKey] = useState<string | null>(null);
  const [selectedValheimPlayerProfile, setSelectedValheimPlayerProfile] = useState<KnownPlayerProfileResponse | null>(null);
  const [selectedPalworldPlayerKey, setSelectedPalworldPlayerKey] = useState<string | null>(null);
  const [selectedPalworldPlayerProfile, setSelectedPalworldPlayerProfile] = useState<PalworldUnifiedPlayerProfile | null>(null);
  const [selectedPalworldHistory, setSelectedPalworldHistory] = useState<PalworldPlayerSnapshot[]>([]);
  const [selectedPlayerIntelligenceId, setSelectedPlayerIntelligenceId] = useState<string | null>(null);
  const [selectedPlayerDetail, setSelectedPlayerDetail] = useState<PlayerDetailResponse | null>(null);
  const [selectedPlayerDetailLoading, setSelectedPlayerDetailLoading] = useState(false);
  const [selectedPlayerDetailError, setSelectedPlayerDetailError] = useState<string | null>(null);
  const [selectedEngagementPlayerId, setSelectedEngagementPlayerId] = useState<string | null>(null);
  const [selectedEngagementDetail, setSelectedEngagementDetail] = useState<PlayerEngagementDetail | null>(null);
  const [selectedEngagementDetailLoading, setSelectedEngagementDetailLoading] = useState(false);
  const [selectedEngagementDetailError, setSelectedEngagementDetailError] = useState<string | null>(null);
  const [observedSettingsOpen, setObservedSettingsOpen] = useState(false);
  const [observedSettings, setObservedSettings] = useState<ObservedSettingsResponse | null>(null);
  const [observedSettingsLoading, setObservedSettingsLoading] = useState(false);
  const [observedSettingsError, setObservedSettingsError] = useState<string | null>(null);
  const [selectedEventTemplateDraft, setSelectedEventTemplateDraft] = useState<EventTemplateDraftCatalog['drafts'][number] | null>(null);
  const [eventDraftDisplayName, setEventDraftDisplayName] = useState('');
  const [eventDraftTargetMultiplier, setEventDraftTargetMultiplier] = useState('');
  const [eventDraftTargetValue, setEventDraftTargetValue] = useState('');
  const [eventDraftDurationHours, setEventDraftDurationHours] = useState('');
  const [eventDraftNotes, setEventDraftNotes] = useState('');
  const [eventDraftScheduleLabel, setEventDraftScheduleLabel] = useState('');
  const [eventDraftEnabled, setEventDraftEnabled] = useState(true);
  const [eventDraftSaving, setEventDraftSaving] = useState(false);
  const [eventDraftError, setEventDraftError] = useState<string | null>(null);
  const [eventDraftSuccess, setEventDraftSuccess] = useState<string | null>(null);
  const [eventDraftConfigDiffPreview, setEventDraftConfigDiffPreview] = useState<EventTemplateConfigDiffPreview | null>(null);
  const [eventDraftConfigDiffLoading, setEventDraftConfigDiffLoading] = useState(false);
  const [eventDraftConfigDiffError, setEventDraftConfigDiffError] = useState<string | null>(null);
  const [eventDraftManualChecklist, setEventDraftManualChecklist] = useState<EventTemplateManualChangeChecklist | null>(null);
  const [eventDraftManualChecklistLoading, setEventDraftManualChecklistLoading] = useState(false);
  const [eventDraftManualChecklistError, setEventDraftManualChecklistError] = useState<string | null>(null);
  const [eventDraftManualEditPlan, setEventDraftManualEditPlan] = useState<EventTemplateManualEditPlan | null>(null);
  const [eventDraftManualEditPlanLoading, setEventDraftManualEditPlanLoading] = useState(false);
  const [eventDraftManualEditPlanError, setEventDraftManualEditPlanError] = useState<string | null>(null);
  const [playerProfiles, setPlayerProfiles] = useState<PalworldPlayerProfileSessionSummary[]>([]);
  const [palworldPlayerProfiles, setPalworldPlayerProfiles] = useState<PalworldUnifiedPlayerProfile[]>([]);
  const [palworldPlayerProfilesLoading, setPalworldPlayerProfilesLoading] = useState(false);
  const [palworldPlayerDetailLoading, setPalworldPlayerDetailLoading] = useState(false);
  const [palworldLatestPlayers, setPalworldLatestPlayers] = useState<PalworldLatestPlayerTelemetry[]>([]);
  const [palworldMetrics, setPalworldMetrics] = useState<PalworldMetricsSummary[]>([]);
  const [palworldMilestoneFeed, setPalworldMilestoneFeed] = useState<PalworldMilestoneFeedEntry[]>([]);
  const [palworldTransitionEvents, setPalworldTransitionEvents] = useState<PalworldTransitionMilestoneEvent[]>([]);
  const [palworldBaseSignal, setPalworldBaseSignal] = useState<number | null>(null);
  const [palworldRefinedEstimatedBases, setPalworldRefinedEstimatedBases] = useState<number | null>(null);
  const [palworldBaseSignalHistory, setPalworldBaseSignalHistory] = useState<PalworldBaseSignalHistoryEntry[]>([]);
  const [palworldGuilds, setPalworldGuilds] = useState<PalworldGuildHint[]>([]);
  const [guildActivity, setGuildActivity] = useState<PalworldGuildActivityEntry[]>([]);
  const [expandedGuildActivityName, setExpandedGuildActivityName] = useState<string | null>(null);
  const [reviewedGuildNames, setReviewedGuildNames] = useState<Set<string>>(() => new Set());
  const [guildActivityFilter, setGuildActivityFilter] = useState<GuildActivityFilter>('all');
  const [guildFocusMode, setGuildFocusMode] = useState(false);
  const [palworldGuildsError, setPalworldGuildsError] = useState<string | null>(null);
  const [palworldTransitionPostSubmittingKey, setPalworldTransitionPostSubmittingKey] = useState<string | null>(null);
  const [palworldTransitionPostSuccessKey, setPalworldTransitionPostSuccessKey] = useState<string | null>(null);
  const [palworldTransitionPostErrorKey, setPalworldTransitionPostErrorKey] = useState<string | null>(null);
  const [palworldTransitionPostError, setPalworldTransitionPostError] = useState<string | null>(null);
  const [palworldApprovedIdentities, setPalworldApprovedIdentities] = useState<PalworldApprovedIdentity[]>([]);
  const [palworldRejectedIdentities, setPalworldRejectedIdentities] = useState<PalworldRejectedIdentity[]>([]);
  const [palworldIdentityCandidates, setPalworldIdentityCandidates] = useState<PalworldIdentityLinkCandidate[]>([]);
  const [palworldIdentityFailures, setPalworldIdentityFailures] = useState<PalworldIdentityLinkFailure[]>([]);
  const [palworldIdentityLoading, setPalworldIdentityLoading] = useState(false);
  const [palworldIdentityError, setPalworldIdentityError] = useState<string | null>(null);
  const [palworldReviewActor, setPalworldReviewActor] = useState('');
  const [palworldReviewNotes, setPalworldReviewNotes] = useState('');
  const [palworldReviewSubmittingKey, setPalworldReviewSubmittingKey] = useState<string | null>(null);
  const [palworldReviewActionError, setPalworldReviewActionError] = useState<string | null>(null);
  const [palworldReviewRefreshToken, setPalworldReviewRefreshToken] = useState(0);
  const [palworldManualSavePlayerSaveId, setPalworldManualSavePlayerSaveId] = useState('');
  const [palworldManualSavePlayerFileName, setPalworldManualSavePlayerFileName] = useState('');
  const [palworldManualLinkError, setPalworldManualLinkError] = useState<string | null>(null);
  const [palworldManualLinkSuccess, setPalworldManualLinkSuccess] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [selectedDashboardTab, setSelectedDashboardTab] = useState<DashboardTab>('overview');
  const [worldMemorySearchQuery, setWorldMemorySearchQuery] = useState('');
  const [selectedMemoryDetail, setSelectedMemoryDetail] = useState<WorldMemoryDetailModel | null>(null);
  const [selectedWorldEventDetail, setSelectedWorldEventDetail] = useState<WorldEvent | null>(null);
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState<PalworldPlayerProfileSessionSummary | null>(null);
  const [drawerSavePlayerSaveId, setDrawerSavePlayerSaveId] = useState('');
  const [drawerSavePlayerFileName, setDrawerSavePlayerFileName] = useState('');
  const [drawerLinkNotes, setDrawerLinkNotes] = useState('');
  const [drawerLinkError, setDrawerLinkError] = useState<string | null>(null);
  const [drawerLinkSuccess, setDrawerLinkSuccess] = useState<string | null>(null);
  const [drawerLinkSubmitting, setDrawerLinkSubmitting] = useState(false);
  const reviewedGuildStorageServerId = useRef<string | null>(null);

  useEffect(() => {
    setSelectedValheimPlayerLookupKey(null);
    setSelectedValheimPlayerProfile(null);
    setSelectedPalworldPlayerKey(null);
    setSelectedPalworldPlayerProfile(null);
    setSelectedPalworldHistory([]);
    setPlayerProfiles([]);
    setPalworldPlayerProfiles([]);
    setPalworldPlayerProfilesLoading(false);
    setPalworldPlayerDetailLoading(false);
    setPalworldLatestPlayers([]);
    setPalworldMetrics([]);
    setPalworldMilestoneFeed([]);
    setPalworldTransitionEvents([]);
    setPalworldBaseSignal(null);
    setPalworldRefinedEstimatedBases(null);
    setPalworldBaseSignalHistory([]);
    setPalworldGuilds([]);
    setGuildActivity([]);
    setExpandedGuildActivityName(null);
    setReviewedGuildNames(loadReviewedGuildNames(selectedServerId));
    setGuildActivityFilter('all');
    setGuildFocusMode(false);
    reviewedGuildStorageServerId.current = selectedServerId || null;
    setPalworldGuildsError(null);
    setPalworldTransitionPostSubmittingKey(null);
    setPalworldTransitionPostSuccessKey(null);
    setPalworldTransitionPostErrorKey(null);
    setPalworldTransitionPostError(null);
    setPalworldApprovedIdentities([]);
    setPalworldRejectedIdentities([]);
    setPalworldIdentityCandidates([]);
    setPalworldIdentityFailures([]);
    setPalworldIdentityLoading(false);
    setPalworldIdentityError(null);
    setPalworldReviewNotes('');
    setPalworldReviewSubmittingKey(null);
    setPalworldReviewActionError(null);
    setPalworldManualSavePlayerSaveId('');
    setPalworldManualSavePlayerFileName('');
    setPalworldManualLinkError(null);
    setPalworldManualLinkSuccess(null);
    setDetailError(null);
    setSelectedPlayerProfile(null);
    setWorldMemorySearchQuery('');
    setSelectedMemoryDetail(null);
    setSelectedWorldEventDetail(null);
    setSelectedDashboardTab('overview');
  }, [selectedServerId]);

  useEffect(() => {
    if (!selectedServerId || reviewedGuildStorageServerId.current !== selectedServerId) {
      return;
    }

    saveReviewedGuildNames(selectedServerId, reviewedGuildNames);
  }, [reviewedGuildNames, selectedServerId]);

  useEffect(() => {
    setDrawerSavePlayerSaveId('');
    setDrawerSavePlayerFileName('');
    setDrawerLinkNotes('');
    setDrawerLinkError(null);
    setDrawerLinkSuccess(null);
    setDrawerLinkSubmitting(false);
  }, [selectedPlayerProfile]);

  useEffect(() => {
    setEventDraftDisplayName(selectedEventTemplateDraft?.displayName ?? '');
    setEventDraftTargetMultiplier(selectedEventTemplateDraft?.targetMultiplier !== null && selectedEventTemplateDraft?.targetMultiplier !== undefined ? String(selectedEventTemplateDraft.targetMultiplier) : '');
    setEventDraftTargetValue(selectedEventTemplateDraft?.targetValue !== null && selectedEventTemplateDraft?.targetValue !== undefined ? String(selectedEventTemplateDraft.targetValue) : '');
    setEventDraftDurationHours(selectedEventTemplateDraft?.durationHours !== null && selectedEventTemplateDraft?.durationHours !== undefined ? String(selectedEventTemplateDraft.durationHours) : '');
    setEventDraftNotes(selectedEventTemplateDraft?.notes ?? '');
    setEventDraftScheduleLabel(selectedEventTemplateDraft?.scheduleLabel ?? '');
    setEventDraftEnabled(selectedEventTemplateDraft?.enabledInDashboard ?? true);
    setEventDraftError(null);
    setEventDraftSuccess(null);
    setEventDraftSaving(false);
    setEventDraftConfigDiffPreview(null);
    setEventDraftConfigDiffError(null);
    setEventDraftManualChecklist(null);
    setEventDraftManualChecklistError(null);
  }, [selectedEventTemplateDraft]);

  useEffect(() => {
    if (!selectedPlayerProfile && !selectedEngagementDetail && !observedSettingsOpen && !selectedEventTemplateDraft && !expandedGuildActivityName && !selectedMemoryDetail && !selectedWorldEventDetail) {
      return;
    }

    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === 'Escape') {
        setSelectedPlayerProfile(null);
        setSelectedEngagementPlayerId(null);
        setSelectedEngagementDetail(null);
        setSelectedEngagementDetailError(null);
        setObservedSettingsOpen(false);
        setObservedSettings(null);
        setObservedSettingsError(null);
        setSelectedEventTemplateDraft(null);
        setEventDraftError(null);
        setEventDraftSuccess(null);
        setEventDraftConfigDiffPreview(null);
        setEventDraftConfigDiffError(null);
        setEventDraftManualChecklist(null);
        setEventDraftManualChecklistError(null);
        setExpandedGuildActivityName(null);
        setSelectedMemoryDetail(null);
        setSelectedWorldEventDetail(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [expandedGuildActivityName, observedSettingsOpen, selectedEngagementDetail, selectedEventTemplateDraft, selectedMemoryDetail, selectedPlayerProfile, selectedWorldEventDetail]);

  useEffect(() => {
    let isMounted = true;

    async function loadServerCatalog(): Promise<void> {
      try {
        setServerOptionsLoading(true);
        const response = await fetch(`${apiBaseUrl}/servers/catalog`);

        if (!response.ok) {
          throw new Error(`Server catalog fetch failed with status ${response.status}`);
        }

        const payload = await response.json();
        const parsed = configuredServersResponseSchema.safeParse(payload);

        if (!parsed.success) {
          throw new Error('Server catalog payload validation failed.');
        }

        if (!isMounted) {
          return;
        }

        const catalog = parsed.data.servers.map((server) => ({
          id: server.id,
          displayName: server.displayName,
          game: server.game
        }));

        setServerOptions(catalog);
        setServerOptionsError(null);
        setSelectedServerId((current) => (
          current && catalog.some((server) => server.id === current)
            ? current
            : (catalog[0]?.id ?? '')
        ));
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Unknown error';

        if (!isMounted) {
          return;
        }

        setServerOptions([]);
        setServerOptionsError(message);
        setSelectedServerId('');
      } finally {
        if (isMounted) {
          setServerOptionsLoading(false);
        }
      }
    }

    void loadServerCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (serverOptions.length === 0) {
      setFleetByServerId({});
      return;
    }

    let isMounted = true;

    async function loadFleet(isInitialLoad: boolean): Promise<void> {
      try {
        if (isInitialLoad && isMounted) {
          setFleetLoading(true);
        }

        const healthPromise = fetch(`${apiBaseUrl}/health`);
        const summaryPromises = serverOptions.map(async (server) => {
          const sharedRequests = [
            fetch(`${apiBaseUrl}/servers/${server.id}/status`),
            fetch(`${apiBaseUrl}/servers/${server.id}/sessions/active`),
            fetch(`${apiBaseUrl}/servers/${server.id}/players/known?limit=100`),
            fetch(`${apiBaseUrl}/servers/${server.id}/events?limit=50`),
            fetch(`${apiBaseUrl}/servers/${server.id}/activity-log?limit=20`),
            fetch(`${apiBaseUrl}/servers/${server.id}/operational-status`),
            fetch(`${apiBaseUrl}/servers/${server.id}/player-activity-capture-verification`),
            fetch(`${apiBaseUrl}/servers/${server.id}/data-freshness`),
            fetch(`${apiBaseUrl}/servers/${server.id}/player-intelligence`),
            fetch(`${apiBaseUrl}/servers/${server.id}/player-intelligence-summary`),
            fetch(`${apiBaseUrl}/servers/${server.id}/player-engagement`),
            fetch(`${apiBaseUrl}/servers/${server.id}/server-alive-rhythm`),
            fetch(`${apiBaseUrl}/servers/${server.id}/server-health`),
            fetch(`${apiBaseUrl}/servers/${server.id}/settings-capabilities`),
            fetch(`${apiBaseUrl}/servers/${server.id}/event-template-drafts`),
            fetch(`${apiBaseUrl}/servers/${server.id}/session-timeline?limit=50`),
            fetch(`${apiBaseUrl}/servers/${server.id}/community-activity`)
          ];
          const palworldRequests = server.game === 'palworld'
            ? [
                fetchOptionalDashboardResource(`${apiBaseUrl}/servers/${server.id}/palworld/players/latest?limit=8`),
                fetchOptionalDashboardResource(`${apiBaseUrl}/servers/${server.id}/palworld/metrics/recent?limit=8`),
                fetchOptionalDashboardResource(`${apiBaseUrl}/servers/${server.id}/palworld-config-audit`),
                fetchOptionalDashboardResource(`${apiBaseUrl}/servers/${server.id}/palworld-backup-readiness`),
                fetchOptionalDashboardResource(`${apiBaseUrl}/servers/${server.id}/palworld-runtime-audit`)
              ]
            : [];
          const responses = await Promise.all([...sharedRequests, ...palworldRequests]);
          const statusResponse = responses[0];
          const sessionsResponse = responses[1];
          const knownPlayersResponse = responses[2];
          const eventsResponse = responses[3];
          const activityLogResponse = responses[4];
          const operationalStatusResponse = responses[5];
          const playerActivityCaptureResponse = responses[6];
          const dataFreshnessResponse = responses[7];
          const playerIntelligenceResponse = responses[8];
          const playerIntelligenceSummaryResponse = responses[9];
          const playerEngagementResponse = responses[10];
          const serverAliveRhythmResponse = responses[11];
          const serverHealthResponse = responses[12];
          const settingsCapabilitiesResponse = responses[13];
          const eventTemplateDraftsResponse = responses[14];
          const sessionTimelineResponse = responses[15];
          const communityActivityResponse = responses[16];
          const palworldLatestPlayersResponse = server.game === 'palworld' ? responses[17] : null;
          const palworldMetricsResponse = server.game === 'palworld' ? responses[18] : null;
          const palworldConfigAuditResponse = server.game === 'palworld' ? responses[19] : null;
          const palworldBackupReadinessResponse = server.game === 'palworld' ? responses[20] : null;
          const palworldRuntimeAuditResponse = server.game === 'palworld' ? responses[21] : null;
          const requiredResponses = [
            statusResponse,
            sessionsResponse,
            knownPlayersResponse,
            eventsResponse,
            activityLogResponse,
            operationalStatusResponse,
            playerActivityCaptureResponse,
            dataFreshnessResponse,
            playerIntelligenceResponse,
            playerIntelligenceSummaryResponse,
            playerEngagementResponse,
            serverAliveRhythmResponse,
            serverHealthResponse,
            settingsCapabilitiesResponse,
            eventTemplateDraftsResponse,
            sessionTimelineResponse,
            communityActivityResponse
          ];

          if (requiredResponses.some((response) => response === null)) {
            throw new Error(`Server ${server.id} summary fetch failed: required request timed out.`);
          }

          const failedRequiredResponse = requiredResponses.find(
            (response): response is Response => response !== null && !response.ok
          );

          if (failedRequiredResponse) {
            throw new Error(`Server ${server.id} summary fetch failed with status ${failedRequiredResponse.status}`);
          }

          const [statusPayload, sessionsPayload, knownPlayersPayload, eventsPayload, activityLogPayload, operationalStatusPayload, playerActivityCapturePayload, dataFreshnessPayload, playerIntelligencePayload, playerIntelligenceSummaryPayload, playerEngagementPayload, serverAliveRhythmPayload, serverHealthPayload, settingsCapabilitiesPayload, eventTemplateDraftsPayload, sessionTimelinePayload, communityActivityPayload] = await Promise.all(
            requiredResponses.map((response) => response!.json())
          );

          const [palworldLatestPlayersPayload, palworldMetricsPayload, palworldConfigAuditPayload, palworldBackupReadinessPayload, palworldRuntimeAuditPayload] = await Promise.all([
            palworldLatestPlayersResponse?.ok ? palworldLatestPlayersResponse.json() : Promise.resolve(null),
            palworldMetricsResponse?.ok ? palworldMetricsResponse.json() : Promise.resolve(null),
            palworldConfigAuditResponse?.ok ? palworldConfigAuditResponse.json() : Promise.resolve(null),
            palworldBackupReadinessResponse?.ok ? palworldBackupReadinessResponse.json() : Promise.resolve(null),
            palworldRuntimeAuditResponse?.ok ? palworldRuntimeAuditResponse.json() : Promise.resolve(null)
          ]);

          const statusParsed = serverStatusSchema.safeParse(statusPayload);
          const sessionsParsed = activeSessionsResponseSchema.safeParse(sessionsPayload);
          const knownPlayersParsed = knownPlayersResponseSchema.safeParse(knownPlayersPayload);
          const eventsParsed = recentEventsResponseSchema.safeParse(eventsPayload);
          const activityLogParsed = activityLogResponseSchema.safeParse(activityLogPayload);
          const operationalStatusParsed = serverOperationalStatusSchema.safeParse(operationalStatusPayload);
          const playerActivityCaptureParsed = playerActivityCaptureVerificationSchema.safeParse(playerActivityCapturePayload);
          const dataFreshnessParsed = dataFreshnessResponseSchema.safeParse(dataFreshnessPayload);
          const playerIntelligenceParsed = playerIntelligenceResponseSchema.safeParse(playerIntelligencePayload);
          const playerIntelligenceSummaryParsed = playerIntelligenceSummaryResponseSchema.safeParse(playerIntelligenceSummaryPayload);
          const playerEngagementParsed = playerEngagementSummarySchema.safeParse(playerEngagementPayload);
          const serverAliveRhythmParsed = serverAliveRhythmSummarySchema.safeParse(serverAliveRhythmPayload);
          const serverHealthParsed = serverHealthSummarySchema.safeParse(serverHealthPayload);
          const settingsCapabilitiesParsed = serverSettingsCapabilitySummarySchema.safeParse(settingsCapabilitiesPayload);
          const eventTemplateDraftsParsed = eventTemplateDraftCatalogSchema.safeParse(eventTemplateDraftsPayload);
          const sessionTimelineParsed = sessionTimelineResponseSchema.safeParse(sessionTimelinePayload);
          const communityActivityParsed = communityActivityResponseSchema.safeParse(communityActivityPayload);
          const palworldLatestPlayersParsed = server.game === 'palworld'
            && palworldLatestPlayersPayload
            ? palworldLatestPlayersResponseSchema.safeParse(palworldLatestPlayersPayload)
            : null;
          const palworldMetricsParsed = server.game === 'palworld'
            && palworldMetricsPayload
            ? palworldMetricsSummariesResponseSchema.safeParse(palworldMetricsPayload)
            : null;
          const palworldConfigAuditParsed = server.game === 'palworld'
            && palworldConfigAuditPayload
            ? palworldConfigAuditSchema.safeParse(palworldConfigAuditPayload)
            : null;
          const palworldBackupReadinessParsed = server.game === 'palworld'
            && palworldBackupReadinessPayload
            ? palworldBackupReadinessSchema.safeParse(palworldBackupReadinessPayload)
            : null;
          const palworldRuntimeAuditParsed = server.game === 'palworld'
            && palworldRuntimeAuditPayload
            ? palworldRuntimeAuditSchema.safeParse(palworldRuntimeAuditPayload)
            : null;

          if (!statusParsed.success || !sessionsParsed.success || !knownPlayersParsed.success || !eventsParsed.success || !activityLogParsed.success || !operationalStatusParsed.success || !playerActivityCaptureParsed.success || !dataFreshnessParsed.success || !playerIntelligenceParsed.success || !playerIntelligenceSummaryParsed.success || !playerEngagementParsed.success || !serverAliveRhythmParsed.success || !serverHealthParsed.success || !settingsCapabilitiesParsed.success || !eventTemplateDraftsParsed.success || !sessionTimelineParsed.success || !communityActivityParsed.success) {
            throw new Error(`Server ${server.id} payload validation failed.`);
          }

          if (palworldLatestPlayersParsed && !palworldLatestPlayersParsed.success) {
            throw new Error(`Server ${server.id} Palworld players payload validation failed.`);
          }

          if (palworldMetricsParsed && !palworldMetricsParsed.success) {
            throw new Error(`Server ${server.id} Palworld metrics payload validation failed.`);
          }

          if (palworldConfigAuditParsed && !palworldConfigAuditParsed.success) {
            throw new Error(`Server ${server.id} Palworld config audit payload validation failed.`);
          }

          if (palworldBackupReadinessParsed && !palworldBackupReadinessParsed.success) {
            throw new Error(`Server ${server.id} Palworld backup readiness payload validation failed.`);
          }

          if (palworldRuntimeAuditParsed && !palworldRuntimeAuditParsed.success) {
            throw new Error(`Server ${server.id} Palworld runtime audit payload validation failed.`);
          }

          const recentEvents = [...eventsParsed.data.events]
            .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
            .slice(0, 10);
          const recentWarnings = recentEvents
            .filter((event) => event.eventType === 'HEALTH_WARN')
            .slice(0, 12);
          const palworldLatestPlayers = palworldLatestPlayersParsed?.data.players ?? [];
          const palworldRecentMetrics = palworldMetricsParsed?.data.metrics ?? [];
          const palworldConfigAudit = palworldConfigAuditParsed?.data ?? null;
          const palworldBackupReadiness = palworldBackupReadinessParsed?.data ?? null;
          const palworldRuntimeAudit = palworldRuntimeAuditParsed?.data ?? null;
          const effectiveState = deriveEffectiveServerState({
            reportedState: statusParsed.data.state,
            game: server.game,
            activePlayers: sessionsParsed.data.sessions.length,
            recentEvents,
            recentWarnings,
            palworldLatestPlayers,
            palworldRecentMetrics
          });

          return {
            serverId: server.id,
            displayName: server.displayName,
            game: server.game,
            reportedState: statusParsed.data.state,
            state: effectiveState,
            statusMessage: statusParsed.data.message,
            operationalStatus: operationalStatusParsed.data,
            playerActivityCapture: playerActivityCaptureParsed.data,
            dataFreshness: dataFreshnessParsed.data,
            activePlayers: sessionsParsed.data.sessions.length,
            knownPlayerCount: playerIntelligenceParsed.data.players.length,
            recentEvents,
            recentWarnings,
            activityLog: activityLogParsed.data.items,
            playerIntelligence: playerIntelligenceParsed.data.players,
            playerIntelligenceExplanation: playerIntelligenceParsed.data.explanation,
            playerIntelligenceSummary: playerIntelligenceSummaryParsed.data,
            playerEngagement: playerEngagementParsed.data,
            communityActivity: communityActivityParsed.data,
            serverAliveRhythm: serverAliveRhythmParsed.data,
            serverHealth: serverHealthParsed.data,
            settingsCapabilities: settingsCapabilitiesParsed.data,
            eventTemplateDrafts: eventTemplateDraftsParsed.data,
            palworldConfigAudit,
            palworldBackupReadiness,
            palworldRuntimeAudit,
            sessionTimeline: sessionTimelineParsed.data,
            knownPlayers: knownPlayersParsed.data.players.map((player) => ({
              displayName: player.displayName,
              normalizedPlayerKey: normalizePlayerKey(player.normalizedPlayerKey),
              confidence: player.confidence,
              firstSeenAt: player.firstSeenAt,
              lastSeenAt: player.lastSeenAt,
              observationCount: player.observationCount
            })),
            palworldLatestPlayers,
            palworldRecentMetrics
          } satisfies ServerSummary;
        });

        const [healthResponse, summaries] = await Promise.all([healthPromise, Promise.all(summaryPromises)]);

        if (!healthResponse.ok) {
          throw new Error(`/health failed with status ${healthResponse.status}`);
        }

        const nextHealth = (await healthResponse.json()) as HealthResponse;

        if (!isMounted) {
          return;
        }

        setHealth(nextHealth);
        setFleetByServerId(Object.fromEntries(summaries.map((summary) => [summary.serverId, summary])));
        setFleetError(null);
        setLastUpdatedAt(new Date().toISOString());
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Unknown error';

        if (isMounted) {
          setFleetError(message);
        }
      } finally {
        if (isMounted && isInitialLoad) {
          setFleetLoading(false);
        }
      }
    }

    void loadFleet(true);
    const interval = setInterval(() => {
      void loadFleet(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [serverOptions]);

  useEffect(() => {
    let isMounted = true;

    async function loadOperatorBrief(isInitialLoad: boolean): Promise<void> {
      try {
        if (isInitialLoad) {
          setOperatorBriefLoading(true);
        }

        const response = await fetchOptionalDashboardResource(`${apiBaseUrl}/api/dashboard/operator/brief`);

        if (!response) {
          throw new Error('request timed out');
        }

        if (!response.ok) {
          throw new Error(`request failed with status ${response.status}`);
        }

        const payload = await response.json();
        const parsed = operatorBriefResponseSchema.safeParse(payload);

        if (!parsed.success) {
          throw new Error('payload validation failed');
        }

        if (!isMounted) {
          return;
        }

        setOperatorBrief(parsed.data);
        setOperatorBriefError(null);
      } catch {
        if (isMounted) {
          setOperatorBriefError('Operator unavailable');
        }
      } finally {
        if (isMounted && isInitialLoad) {
          setOperatorBriefLoading(false);
        }
      }
    }

    void loadOperatorBrief(true);
    const interval = setInterval(() => {
      void loadOperatorBrief(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadOperatorInsights(isInitialLoad: boolean): Promise<void> {
      try {
        if (isInitialLoad) {
          setOperatorInsightsLoading(true);
        }

        const response = await fetchOptionalDashboardResource(`${apiBaseUrl}/api/dashboard/operator/insights`);

        if (!response) {
          throw new Error('request timed out');
        }

        if (!response.ok) {
          throw new Error(`request failed with status ${response.status}`);
        }

        const payload = await response.json();
        const parsed = operatorInsightsResponseSchema.safeParse(payload);

        if (!parsed.success) {
          throw new Error('payload validation failed');
        }

        if (!isMounted) {
          return;
        }

        setOperatorInsights(parsed.data);
        setOperatorInsightsError(null);
      } catch {
        if (isMounted) {
          setOperatorInsightsError('Insights unavailable');
        }
      } finally {
        if (isMounted && isInitialLoad) {
          setOperatorInsightsLoading(false);
        }
      }
    }

    void loadOperatorInsights(true);
    const interval = setInterval(() => {
      void loadOperatorInsights(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadOperatorChanges(isInitialLoad: boolean): Promise<void> {
      try {
        if (isInitialLoad) {
          setOperatorChangesLoading(true);
        }

        const response = await fetchOptionalDashboardResource(`${apiBaseUrl}/api/dashboard/operator/changes`);

        if (!response) {
          throw new Error('request timed out');
        }

        if (!response.ok) {
          throw new Error(`request failed with status ${response.status}`);
        }

        const payload = await response.json();
        const parsed = operatorChangesSummaryResponseSchema.safeParse(payload);

        if (!parsed.success) {
          throw new Error('payload validation failed');
        }

        if (!isMounted) {
          return;
        }

        setOperatorChanges(parsed.data);
        setOperatorChangesError(null);
      } catch {
        if (isMounted) {
          setOperatorChangesError('Change summary unavailable');
        }
      } finally {
        if (isMounted && isInitialLoad) {
          setOperatorChangesLoading(false);
        }
      }
    }

    void loadOperatorChanges(true);
    const interval = setInterval(() => {
      void loadOperatorChanges(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadOperatorDailyBrief(isInitialLoad: boolean): Promise<void> {
      try {
        if (isInitialLoad) {
          setOperatorDailyBriefLoading(true);
        }

        const response = await fetchOptionalDashboardResource(`${apiBaseUrl}/api/dashboard/operator/daily-brief`);

        if (!response) {
          throw new Error('request timed out');
        }

        if (!response.ok) {
          throw new Error(`request failed with status ${response.status}`);
        }

        const payload = await response.json();
        const parsed = operatorDailyBriefResponseSchema.safeParse(payload);

        if (!parsed.success) {
          throw new Error('payload validation failed');
        }

        if (!isMounted) {
          return;
        }

        setOperatorDailyBrief(parsed.data);
        setOperatorDailyBriefError(null);
      } catch {
        if (isMounted) {
          setOperatorDailyBriefError('Daily brief unavailable');
        }
      } finally {
        if (isMounted && isInitialLoad) {
          setOperatorDailyBriefLoading(false);
        }
      }
    }

    void loadOperatorDailyBrief(true);
    const interval = setInterval(() => {
      void loadOperatorDailyBrief(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadOperatorMemoryIndex(isInitialLoad: boolean): Promise<void> {
      try {
        if (isInitialLoad) {
          setOperatorMemoryIndexLoading(true);
        }

        const response = await fetchOptionalDashboardResource(`${apiBaseUrl}/api/dashboard/operator/memory-index`);

        if (!response) {
          throw new Error('request timed out');
        }

        if (!response.ok) {
          throw new Error(`request failed with status ${response.status}`);
        }

        const payload = await response.json();
        const parsed = operatorMemoryIndexResponseSchema.safeParse(payload);

        if (!parsed.success) {
          throw new Error('payload validation failed');
        }

        if (!isMounted) {
          return;
        }

        setOperatorMemoryIndex(parsed.data);
        setOperatorMemoryIndexError(null);
      } catch {
        if (isMounted) {
          setOperatorMemoryIndexError('Operational memory unavailable');
        }
      } finally {
        if (isMounted && isInitialLoad) {
          setOperatorMemoryIndexLoading(false);
        }
      }
    }

    void loadOperatorMemoryIndex(true);
    const interval = setInterval(() => {
      void loadOperatorMemoryIndex(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadOperatorTimeline(isInitialLoad: boolean): Promise<void> {
      try {
        if (isInitialLoad) {
          setOperatorTimelineLoading(true);
        }

        const response = await fetchOptionalDashboardResource(`${apiBaseUrl}/api/dashboard/operator/timeline?limit=12`);

        if (!response) {
          throw new Error('request timed out');
        }

        if (!response.ok) {
          throw new Error(`request failed with status ${response.status}`);
        }

        const payload = await response.json();
        const parsed = operatorTimelineResponseSchema.safeParse(payload);

        if (!parsed.success) {
          throw new Error('payload validation failed');
        }

        if (!isMounted) {
          return;
        }

        setOperatorTimelineEvents(parsed.data.events);
        setOperatorTimelineError(null);
      } catch {
        if (isMounted) {
          setOperatorTimelineError('Timeline unavailable');
        }
      } finally {
        if (isMounted && isInitialLoad) {
          setOperatorTimelineLoading(false);
        }
      }
    }

    void loadOperatorTimeline(true);
    const interval = setInterval(() => {
      void loadOperatorTimeline(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const selectedServer = useMemo(
    () => serverOptions.find((server) => server.id === selectedServerId) ?? null,
    [selectedServerId, serverOptions]
  );

  useEffect(() => {
    if (!selectedServer || !selectedEventTemplateDraft) {
      setEventDraftConfigDiffPreview(null);
      setEventDraftConfigDiffError(null);
      setEventDraftConfigDiffLoading(false);
      setEventDraftManualChecklist(null);
      setEventDraftManualChecklistError(null);
      setEventDraftManualChecklistLoading(false);
      setEventDraftManualEditPlan(null);
      setEventDraftManualEditPlanError(null);
      setEventDraftManualEditPlanLoading(false);
      return;
    }

    let isMounted = true;
    const serverId = selectedServer.id;
    const templateId = selectedEventTemplateDraft.templateId;

    async function loadDraftPreflight(): Promise<void> {
      try {
        setEventDraftConfigDiffLoading(true);
        setEventDraftConfigDiffError(null);
        setEventDraftManualChecklistLoading(true);
        setEventDraftManualChecklistError(null);
        setEventDraftManualEditPlanLoading(true);
        setEventDraftManualEditPlanError(null);

        const [diffResponse, checklistResponse, planResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/servers/${serverId}/event-template-drafts/${encodeURIComponent(templateId)}/config-diff-preview`),
          fetch(`${apiBaseUrl}/servers/${serverId}/event-template-drafts/${encodeURIComponent(templateId)}/manual-change-checklist`),
          fetch(`${apiBaseUrl}/servers/${serverId}/event-template-drafts/${encodeURIComponent(templateId)}/manual-edit-plan`)
        ]);

        if (!diffResponse.ok) {
          throw new Error(`Config diff preview failed with status ${diffResponse.status}`);
        }

        if (!checklistResponse.ok) {
          throw new Error(`Manual checklist failed with status ${checklistResponse.status}`);
        }

        if (!planResponse.ok) {
          throw new Error(`Manual edit plan failed with status ${planResponse.status}`);
        }

        const [diffPayload, checklistPayload, planPayload] = await Promise.all([
          diffResponse.json(),
          checklistResponse.json(),
          planResponse.json()
        ]);
        const parsed = eventTemplateConfigDiffPreviewSchema.safeParse(diffPayload);
        const checklistParsed = eventTemplateManualChangeChecklistSchema.safeParse(checklistPayload);
        const planParsed = eventTemplateManualEditPlanSchema.safeParse(planPayload);

        if (!parsed.success) {
          throw new Error('Config diff preview payload validation failed.');
        }

        if (!checklistParsed.success) {
          throw new Error('Manual checklist payload validation failed.');
        }

        if (!planParsed.success) {
          throw new Error('Manual edit plan payload validation failed.');
        }

        if (!isMounted) {
          return;
        }

        setEventDraftConfigDiffPreview(parsed.data);
        setEventDraftManualChecklist(checklistParsed.data);
        setEventDraftManualEditPlan(planParsed.data);
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        const message = caughtError instanceof Error ? caughtError.message : 'Unknown draft preflight error';
        setEventDraftConfigDiffPreview(null);
        setEventDraftConfigDiffError(message);
        setEventDraftManualChecklist(null);
        setEventDraftManualChecklistError(message);
        setEventDraftManualEditPlan(null);
        setEventDraftManualEditPlanError(message);
      } finally {
        if (isMounted) {
          setEventDraftConfigDiffLoading(false);
          setEventDraftManualChecklistLoading(false);
          setEventDraftManualEditPlanLoading(false);
        }
      }
    }

    void loadDraftPreflight();

    return () => {
      isMounted = false;
    };
  }, [selectedEventTemplateDraft, selectedServer]);

  useEffect(() => {
    setSelectedPlayerIntelligenceId(null);
    setSelectedPlayerDetail(null);
    setSelectedPlayerDetailError(null);
    setSelectedEngagementPlayerId(null);
    setSelectedEngagementDetail(null);
    setSelectedEngagementDetailError(null);
    setObservedSettingsOpen(false);
    setObservedSettings(null);
    setObservedSettingsError(null);
    setSelectedEventTemplateDraft(null);
    setEventDraftError(null);
    setEventDraftSuccess(null);
    setEventDraftManualEditPlan(null);
    setEventDraftManualEditPlanError(null);
  }, [selectedServerId]);

  useEffect(() => {
    let isMounted = true;

    async function loadSelectedPlayerDetail(): Promise<void> {
      if (!selectedServer || !selectedPlayerIntelligenceId) {
        setSelectedPlayerDetail(null);
        setSelectedPlayerDetailError(null);
        setSelectedPlayerDetailLoading(false);
        return;
      }

      try {
        setSelectedPlayerDetailLoading(true);
        setSelectedPlayerDetailError(null);

        const response = await fetch(`${apiBaseUrl}/servers/${selectedServer.id}/players/${encodeURIComponent(selectedPlayerIntelligenceId)}/detail`);

        if (response.status === 404) {
          if (isMounted) {
            setSelectedPlayerDetail(null);
            setSelectedPlayerDetailError('No detail has been observed for this player yet.');
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`Player detail fetch failed with status ${response.status}`);
        }

        const parsed = playerDetailResponseSchema.safeParse(await response.json());

        if (!parsed.success) {
          throw new Error('Player detail payload validation failed.');
        }

        if (isMounted) {
          setSelectedPlayerDetail(parsed.data);
        }
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Unknown player detail error';

        if (isMounted) {
          setSelectedPlayerDetail(null);
          setSelectedPlayerDetailError(message);
        }
      } finally {
        if (isMounted) {
          setSelectedPlayerDetailLoading(false);
        }
      }
    }

    void loadSelectedPlayerDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedPlayerIntelligenceId, selectedServer]);

  useEffect(() => {
    let isMounted = true;

    async function loadSelectedEngagementDetail(): Promise<void> {
      if (!selectedServer || !selectedEngagementPlayerId) {
        setSelectedEngagementDetail(null);
        setSelectedEngagementDetailError(null);
        setSelectedEngagementDetailLoading(false);
        return;
      }

      try {
        setSelectedEngagementDetailLoading(true);
        setSelectedEngagementDetailError(null);

        const response = await fetch(`${apiBaseUrl}/servers/${selectedServer.id}/player-engagement/${encodeURIComponent(selectedEngagementPlayerId)}/detail`);

        if (response.status === 404) {
          if (isMounted) {
            setSelectedEngagementDetail(null);
            setSelectedEngagementDetailError('No engagement detail has been observed for this player yet.');
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`Engagement detail fetch failed with status ${response.status}`);
        }

        const parsed = playerEngagementDetailSchema.safeParse(await response.json());

        if (!parsed.success) {
          throw new Error('Engagement detail payload validation failed.');
        }

        if (isMounted) {
          setSelectedEngagementDetail(parsed.data);
        }
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Unknown engagement detail error';

        if (isMounted) {
          setSelectedEngagementDetail(null);
          setSelectedEngagementDetailError(message);
        }
      } finally {
        if (isMounted) {
          setSelectedEngagementDetailLoading(false);
        }
      }
    }

    void loadSelectedEngagementDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedEngagementPlayerId, selectedServer]);

  useEffect(() => {
    let isMounted = true;

    async function loadObservedSettings(): Promise<void> {
      if (!selectedServer || !observedSettingsOpen) {
        setObservedSettings(null);
        setObservedSettingsError(null);
        setObservedSettingsLoading(false);
        return;
      }

      try {
        setObservedSettingsLoading(true);
        setObservedSettingsError(null);

        const response = await fetch(`${apiBaseUrl}/servers/${selectedServer.id}/settings-observed`);

        if (!response.ok) {
          throw new Error(`Observed settings fetch failed with status ${response.status}`);
        }

        const parsed = observedSettingsResponseSchema.safeParse(await response.json());

        if (!parsed.success) {
          throw new Error('Observed settings payload validation failed.');
        }

        if (isMounted) {
          setObservedSettings(parsed.data);
        }
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Unknown observed settings error';

        if (isMounted) {
          setObservedSettings(null);
          setObservedSettingsError(message);
        }
      } finally {
        if (isMounted) {
          setObservedSettingsLoading(false);
        }
      }
    }

    void loadObservedSettings();

    return () => {
      isMounted = false;
    };
  }, [observedSettingsOpen, selectedServer]);

  async function saveSelectedEventTemplateDraft(): Promise<void> {
    if (!selectedServer || !selectedEventTemplateDraft) {
      return;
    }

    const parsedMultiplier = eventDraftTargetMultiplier.trim() ? Number(eventDraftTargetMultiplier) : null;
    const parsedDuration = eventDraftDurationHours.trim() ? Number(eventDraftDurationHours) : null;

    if (parsedMultiplier !== null && (!Number.isFinite(parsedMultiplier) || parsedMultiplier <= 0)) {
      setEventDraftError('Target multiplier must be a positive number.');
      return;
    }

    if (parsedDuration !== null && (!Number.isFinite(parsedDuration) || parsedDuration <= 0)) {
      setEventDraftError('Duration must be a positive number of hours.');
      return;
    }

    try {
      setEventDraftSaving(true);
      setEventDraftError(null);
      setEventDraftSuccess(null);

      const response = await fetch(`${apiBaseUrl}/servers/${selectedServer.id}/event-template-drafts/${encodeURIComponent(selectedEventTemplateDraft.templateId)}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          enabledInDashboard: eventDraftEnabled,
          displayName: eventDraftDisplayName.trim() || null,
          targetMultiplier: parsedMultiplier,
          targetValue: eventDraftTargetValue.trim() || null,
          durationHours: parsedDuration,
          notes: eventDraftNotes.trim() || null,
          scheduleLabel: eventDraftScheduleLabel.trim() || null
        })
      });

      if (!response.ok) {
        throw new Error(`Draft save failed with status ${response.status}`);
      }

      const parsed = eventTemplateDraftCatalogSchema.safeParse(await response.json());

      if (!parsed.success) {
        throw new Error('Draft save response validation failed.');
      }

      setFleetByServerId((current) => {
        const summary = current[selectedServer.id];

        if (!summary) {
          return current;
        }

        return {
          ...current,
          [selectedServer.id]: {
            ...summary,
            eventTemplateDrafts: parsed.data
          }
        };
      });
      setSelectedEventTemplateDraft(parsed.data.drafts.find((draft) => draft.templateId === selectedEventTemplateDraft.templateId) ?? null);
      setEventDraftSuccess('Saved as dashboard draft only.');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unknown draft save error';
      setEventDraftError(message);
    } finally {
      setEventDraftSaving(false);
    }
  }

  async function loadBaseSignal(serverId: string, response?: Response): Promise<void> {
    const res = response ?? await fetch(`${apiBaseUrl}/servers/${serverId}/palworld/base-signal`);
    const data = await res.json() as { baseSignal?: number; refinedEstimatedBases?: number };
    setPalworldBaseSignal(data.baseSignal ?? 0);
    setPalworldRefinedEstimatedBases(data.refinedEstimatedBases ?? Math.round((data.baseSignal ?? 0) / 3));
  }

  async function loadBaseSignalHistory(serverId: string, response?: Response): Promise<void> {
    const res = response ?? await fetch(`${apiBaseUrl}/servers/${serverId}/palworld/base-signal/history`);
    const data = await res.json() as { history?: Array<{ timestamp?: string; baseSignal?: number }> };

    setPalworldBaseSignalHistory(
      Array.isArray(data.history)
        ? data.history
          .filter((entry): entry is { timestamp: string; baseSignal: number } => (
            typeof entry?.timestamp === 'string' && typeof entry?.baseSignal === 'number'
          ))
          .slice(-100)
        : []
    );
  }

  useEffect(() => {
    let isMounted = true;

    async function loadServerDetail(): Promise<void> {
      if (!selectedServer || selectedServer.game !== 'palworld') {
        setPalworldLatestPlayers([]);
        setPalworldMetrics([]);
        setPalworldMilestoneFeed([]);
        setPalworldTransitionEvents([]);
        setPalworldBaseSignal(null);
        setPalworldRefinedEstimatedBases(null);
        setPalworldBaseSignalHistory([]);
        setPlayerProfiles([]);
        setPalworldGuilds([]);
        setGuildActivity([]);
        setExpandedGuildActivityName(null);
        setPalworldGuildsError(null);
        setDetailLoading(false);
        setDetailError(null);
        return;
      }

      try {
        setDetailLoading(true);
        setDetailError(null);

        const [latestPlayersResponse, profilesResponse, metricsResponse, milestonesResponse, transitionsResponse, baseSignalResponse, baseSignalHistoryResponse, guildsResult, guildActivityResult] = await Promise.all([
          fetch(`${apiBaseUrl}/servers/${selectedServer.id}/palworld/players/latest?limit=40`),
          fetch(`${apiBaseUrl}/servers/${selectedServer.id}/palworld/players/profiles?limit=100`),
          fetch(`${apiBaseUrl}/servers/${selectedServer.id}/palworld/metrics/recent?limit=16`),
          fetch(`${apiBaseUrl}/servers/${selectedServer.id}/palworld/milestones/current?limit=24`),
          fetch(`${apiBaseUrl}/servers/${selectedServer.id}/palworld/milestones/transitions/recent?limit=24`),
          fetch(`${apiBaseUrl}/servers/${selectedServer.id}/palworld/base-signal`),
          fetch(`${apiBaseUrl}/servers/${selectedServer.id}/palworld/base-signal/history`),
          loadPalworldGuilds(selectedServer.id)
            .then((guilds) => ({ guilds, error: null }))
            .catch((error: unknown) => ({
              guilds: [],
              error: error instanceof Error ? error.message : 'Unknown error'
            })),
          loadPalworldGuildActivity(selectedServer.id)
            .then((guilds) => ({ guilds, error: null }))
            .catch((error: unknown) => ({
              guilds: [],
              error: error instanceof Error ? error.message : 'Unknown error'
            }))
        ]);

        if (!latestPlayersResponse.ok || !profilesResponse.ok || !metricsResponse.ok || !milestonesResponse.ok || !transitionsResponse.ok || !baseSignalResponse.ok || !baseSignalHistoryResponse.ok) {
          const statusCode = [latestPlayersResponse, profilesResponse, metricsResponse, milestonesResponse, transitionsResponse, baseSignalResponse, baseSignalHistoryResponse].find((response) => !response.ok)?.status;
          throw new Error(`Palworld detail fetch failed with status ${statusCode ?? 'unknown'}`);
        }

        const [latestPlayersPayload, profilesPayload, metricsPayload, milestonesPayload, transitionsPayload] = await Promise.all([
          latestPlayersResponse.json(),
          profilesResponse.json(),
          metricsResponse.json(),
          milestonesResponse.json(),
          transitionsResponse.json()
        ]);

        const latestPlayersParsed = palworldLatestPlayersResponseSchema.safeParse(latestPlayersPayload);
        const profilesParsed = palworldPlayerProfileSessionSummariesResponseSchema.safeParse(profilesPayload);
        const metricsParsed = palworldMetricsSummariesResponseSchema.safeParse(metricsPayload);
        const milestonesParsed = palworldMilestoneFeedResponseSchema.safeParse(milestonesPayload);
        const transitionsParsed = palworldTransitionMilestoneEventsResponseSchema.safeParse(transitionsPayload);

        if (!latestPlayersParsed.success || !profilesParsed.success || !metricsParsed.success || !milestonesParsed.success || !transitionsParsed.success) {
          throw new Error('Palworld detail payload validation failed.');
        }

        if (!isMounted) {
          return;
        }

        setPalworldLatestPlayers(latestPlayersParsed.data.players);
        setPlayerProfiles(profilesParsed.data.profiles);
        setPalworldMetrics(metricsParsed.data.metrics);
        setPalworldMilestoneFeed(milestonesParsed.data.milestones);
        setPalworldTransitionEvents(transitionsParsed.data.events);
        await loadBaseSignal(selectedServer.id, baseSignalResponse);
        await loadBaseSignalHistory(selectedServer.id, baseSignalHistoryResponse);
        setPalworldGuilds(guildsResult.guilds);
        setGuildActivity(guildActivityResult.guilds);
        setExpandedGuildActivityName(null);
        setPalworldGuildsError(guildsResult.error ?? guildActivityResult.error);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Unknown error';

        if (isMounted) {
          setDetailError(message);
          setPalworldLatestPlayers([]);
          setPlayerProfiles([]);
          setPalworldMetrics([]);
          setPalworldMilestoneFeed([]);
          setPalworldTransitionEvents([]);
          setPalworldBaseSignal(null);
          setPalworldRefinedEstimatedBases(null);
          setPalworldBaseSignalHistory([]);
          setPalworldGuilds([]);
          setGuildActivity([]);
          setExpandedGuildActivityName(null);
          setPalworldGuildsError(null);
        }
      } finally {
        if (isMounted) {
          setDetailLoading(false);
        }
      }
    }

    void loadServerDetail();

    return () => {
      isMounted = false;
    };
  }, [palworldReviewRefreshToken, selectedServer]);

  useEffect(() => {
    let isMounted = true;

    async function loadValheimPlayerProfile(): Promise<void> {
      if (!selectedServer || selectedServer.game !== 'valheim' || !selectedValheimPlayerLookupKey) {
        setSelectedValheimPlayerProfile(null);
        return;
      }

      try {
        const response = await fetch(
          `${apiBaseUrl}/servers/${selectedServer.id}/players/known/${encodeURIComponent(selectedValheimPlayerLookupKey)}`
        );

        if (!response.ok) {
          throw new Error(`Player profile fetch failed with status ${response.status}`);
        }

        const payload = await response.json();
        const parsed = knownPlayerProfileResponseSchema.safeParse(payload);

        if (!parsed.success) {
          throw new Error('Player profile payload validation failed.');
        }

        if (isMounted) {
          setSelectedValheimPlayerProfile(parsed.data);
        }
      } catch {
        if (isMounted) {
          setSelectedValheimPlayerProfile(null);
        }
      }
    }

    void loadValheimPlayerProfile();

    return () => {
      isMounted = false;
    };
  }, [selectedServer, selectedValheimPlayerLookupKey]);

  useEffect(() => {
    let isMounted = true;

    async function loadPalworldPlayerProfiles(): Promise<void> {
      if (!selectedServer || selectedServer.game !== 'palworld' || palworldLatestPlayers.length === 0) {
        setPalworldPlayerProfiles([]);
        setPalworldPlayerProfilesLoading(false);
        return;
      }

      try {
        setPalworldPlayerProfilesLoading(true);

        const profileResponses = await Promise.all(
          palworldLatestPlayers.slice(0, 40).map(async (player) => {
            const profileLookupId = player.playerId ?? player.lookupKey;
            const response = await fetch(
              `${apiBaseUrl}/servers/${selectedServer.id}/palworld/player-profile/${encodeURIComponent(profileLookupId)}`
            );

            if (!response.ok) {
              return null;
            }

            const payload = await response.json();
            const parsed = palworldUnifiedPlayerProfileSchema.safeParse(payload);

            return parsed.success ? parsed.data : null;
          })
        );

        if (!isMounted) {
          return;
        }

        setPalworldPlayerProfiles(profileResponses.filter((profile): profile is PalworldUnifiedPlayerProfile => profile !== null));
      } catch {
        if (isMounted) {
          setPalworldPlayerProfiles([]);
        }
      } finally {
        if (isMounted) {
          setPalworldPlayerProfilesLoading(false);
        }
      }
    }

    void loadPalworldPlayerProfiles();

    return () => {
      isMounted = false;
    };
  }, [palworldLatestPlayers, selectedServer]);

  useEffect(() => {
    let isMounted = true;

    async function loadPalworldPlayerDetail(): Promise<void> {
      if (!selectedServer || selectedServer.game !== 'palworld' || !selectedPalworldPlayerKey) {
        setSelectedPalworldPlayerProfile(null);
        setSelectedPalworldHistory([]);
        return;
      }

      try {
        setPalworldPlayerDetailLoading(true);
        const selectedPlayer = palworldLatestPlayers.find((player) => player.lookupKey === selectedPalworldPlayerKey) ?? null;
        const profileLookupId = selectedPlayer?.playerId ?? selectedPalworldPlayerKey;
        const [playerResponse, historyResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/servers/${selectedServer.id}/palworld/player-profile/${encodeURIComponent(profileLookupId)}`),
          fetch(`${apiBaseUrl}/servers/${selectedServer.id}/palworld/players/latest/${encodeURIComponent(selectedPalworldPlayerKey)}/history?limit=12`)
        ]);

        if (!playerResponse.ok || !historyResponse.ok) {
          const statusCode = [playerResponse, historyResponse].find((response) => !response.ok)?.status;
          throw new Error(`Palworld player detail fetch failed with status ${statusCode ?? 'unknown'}`);
        }

        const [playerPayload, historyPayload] = await Promise.all([
          playerResponse.json(),
          historyResponse.json()
        ]);

        const playerParsed = palworldUnifiedPlayerProfileSchema.safeParse(playerPayload);
        const historyParsed = palworldPlayerSnapshotsResponseSchema.safeParse(historyPayload);

        if (!playerParsed.success || !historyParsed.success) {
          throw new Error('Palworld player detail payload validation failed.');
        }

        if (!isMounted) {
          return;
        }

        setSelectedPalworldPlayerProfile(playerParsed.data);
        setSelectedPalworldHistory(historyParsed.data.snapshots);
      } catch {
        if (isMounted) {
          setSelectedPalworldPlayerProfile(null);
          setSelectedPalworldHistory([]);
        }
      } finally {
        if (isMounted) {
          setPalworldPlayerDetailLoading(false);
        }
      }
    }

    void loadPalworldPlayerDetail();

    return () => {
      isMounted = false;
    };
  }, [palworldLatestPlayers, palworldReviewRefreshToken, selectedServer, selectedPalworldPlayerKey]);

  useEffect(() => {
    let isMounted = true;

    async function loadPalworldIdentityLinks(): Promise<void> {
      if (!selectedServer || selectedServer.game !== 'palworld') {
        setPalworldApprovedIdentities([]);
        setPalworldRejectedIdentities([]);
        setPalworldIdentityCandidates([]);
        setPalworldIdentityFailures([]);
        setPalworldIdentityLoading(false);
        setPalworldIdentityError(null);
        return;
      }

      try {
        setPalworldIdentityLoading(true);
        setPalworldIdentityError(null);

        const [linksResponse, approvalsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/palworld/identity-links?limit=200`),
          fetch(`${apiBaseUrl}/palworld/identity-approvals`)
        ]);

        if (!linksResponse.ok || !approvalsResponse.ok) {
          const statusCode = [linksResponse, approvalsResponse].find((response) => !response.ok)?.status;
          throw new Error(`Identity review fetch failed with status ${statusCode ?? 'unknown'}`);
        }

        const [linksPayload, approvalsPayload] = await Promise.all([
          linksResponse.json(),
          approvalsResponse.json()
        ]);
        const parsed = palworldIdentityLinksResponseSchema.safeParse(linksPayload);
        const approvalsParsed = palworldIdentityApprovalsResponseSchema.safeParse(approvalsPayload);

        if (!parsed.success || !approvalsParsed.success) {
          throw new Error('Identity review payload validation failed.');
        }

        if (!isMounted) {
          return;
        }

        setPalworldApprovedIdentities(
          approvalsParsed.data.approvals.filter((approval) => approval.serverId === selectedServer.id)
        );
        setPalworldRejectedIdentities(
          approvalsParsed.data.rejections.filter((rejection) => rejection.serverId === selectedServer.id || rejection.serverId === null)
        );
        setPalworldIdentityCandidates(
          parsed.data.candidates.filter((candidate) => candidate.serverId === selectedServer.id)
        );
        setPalworldIdentityFailures(parsed.data.failures);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Unknown error';

        if (isMounted) {
          setPalworldIdentityError(message);
          setPalworldIdentityCandidates([]);
          setPalworldIdentityFailures([]);
        }
      } finally {
        if (isMounted) {
          setPalworldIdentityLoading(false);
        }
      }
    }

    void loadPalworldIdentityLinks();

    return () => {
      isMounted = false;
    };
  }, [palworldReviewRefreshToken, selectedServer]);

  async function submitPalworldReviewAction(action: PalworldReviewAction, savePlayerKey: string): Promise<void> {
    if (!selectedServer || selectedServer.game !== 'palworld') {
      return;
    }

    const reviewedBy = palworldReviewActor.trim();

    if (!reviewedBy) {
      setPalworldReviewActionError('Reviewed by is required.');
      return;
    }

    try {
      setPalworldReviewSubmittingKey(`${action}:${savePlayerKey}`);
      setPalworldReviewActionError(null);

      const response = await fetch(`${apiBaseUrl}/palworld/identity-approvals/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          savePlayerKey,
          reviewedBy,
          ...(palworldReviewNotes.trim() ? { notes: palworldReviewNotes.trim() } : {})
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? `Review action failed with status ${response.status}`);
      }

      setPalworldReviewNotes('');
      setPalworldReviewRefreshToken((current) => current + 1);
    } catch (caughtError) {
      setPalworldReviewActionError(caughtError instanceof Error ? caughtError.message : 'Unknown review action error');
    } finally {
      setPalworldReviewSubmittingKey(null);
    }
  }

  async function submitPalworldManualLink(): Promise<void> {
    if (!selectedServer || selectedServer.game !== 'palworld' || !selectedPalworldPlayerProfile) {
      return;
    }

    const reviewedBy = palworldReviewActor.trim();
    const savePlayerSaveId = palworldManualSavePlayerSaveId.trim();
    const savePlayerFileName = palworldManualSavePlayerFileName.trim();
    const telemetryLookupKey = selectedPalworldPlayerProfile.lookupKey ?? '';
    const playerId = selectedPalworldPlayerProfile.playerId ?? '';
    const userId = selectedPalworldPlayerProfile.userId ?? '';
    const accountName = selectedPalworldPlayerProfile.accountName ?? '';
    const playerName = selectedPalworldPlayerProfile.playerName ?? '';
    const notes = palworldReviewNotes.trim();

    if (!reviewedBy) {
      setPalworldManualLinkError('Reviewed by is required.');
      return;
    }

    if (!savePlayerSaveId) {
      setPalworldManualLinkError('Save player ID is required for a manual link.');
      return;
    }

    if (!playerId) {
      setPalworldManualLinkError('The selected player is missing a player ID, so a manual link cannot be created.');
      return;
    }

    try {
      setPalworldReviewSubmittingKey(`manual:${savePlayerSaveId}`);
      setPalworldManualLinkError(null);
      setPalworldManualLinkSuccess(null);

      const payload = {
        serverId: selectedServer.id,
        savePlayerSaveId,
        ...(savePlayerFileName ? { savePlayerFileName } : {}),
        telemetryLookupKey,
        playerId,
        userId,
        accountName,
        playerName,
        reviewedBy,
        notes
      };

      const response = await fetch(`${apiBaseUrl}/palworld/identity-approvals/manual-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? `Manual link failed with status ${response.status}`);
      }

      setPalworldReviewNotes('');
      setPalworldManualSavePlayerSaveId('');
      setPalworldManualSavePlayerFileName('');
      setPalworldManualLinkSuccess(`Manual link saved for ${playerName || accountName || playerId}.`);
      setPalworldReviewRefreshToken((current) => current + 1);
    } catch (caughtError) {
      setPalworldManualLinkError(caughtError instanceof Error ? caughtError.message : 'Unknown manual link error');
    } finally {
      setPalworldReviewSubmittingKey(null);
    }
  }

  async function submitDrawerManualLink(profile: PalworldPlayerProfileSessionSummary): Promise<void> {
    const savePlayerSaveId = drawerSavePlayerSaveId.trim();
    const savePlayerFileName = drawerSavePlayerFileName.trim();
    const notes = drawerLinkNotes.trim();
    const reviewedBy = palworldReviewActor.trim() || 'Dashboard';

    if (!savePlayerSaveId) {
      setDrawerLinkError('Save Player ID is required.');
      setDrawerLinkSuccess(null);
      return;
    }

    if (!profile.playerId) {
      setDrawerLinkError('This player is missing telemetry identity data, so a save cannot be linked here.');
      setDrawerLinkSuccess(null);
      return;
    }

    try {
      setDrawerLinkSubmitting(true);
      setDrawerLinkError(null);
      setDrawerLinkSuccess(null);

      const payload = {
        serverId: profile.serverId,
        savePlayerSaveId,
        ...(savePlayerFileName ? { savePlayerFileName } : {}),
        ...(profile.lookupKey ? { telemetryLookupKey: profile.lookupKey } : {}),
        playerId: profile.playerId,
        ...(profile.profile.userId ? { userId: profile.profile.userId } : {}),
        ...(profile.accountName ? { accountName: profile.accountName } : {}),
        ...(profile.playerName ? { playerName: profile.playerName } : {}),
        reviewedBy,
        ...(notes ? { notes } : {})
      };

      const response = await fetch(`${apiBaseUrl}/palworld/identity-approvals/manual-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? `Manual link failed with status ${response.status}`);
      }

      setDrawerSavePlayerSaveId('');
      setDrawerSavePlayerFileName('');
      setDrawerLinkNotes('');
      setDrawerLinkSuccess(`Save link saved for ${getProfileDisplayName(profile)}.`);
      setPalworldReviewRefreshToken((current) => current + 1);
    } catch (caughtError) {
      setDrawerLinkError(caughtError instanceof Error ? caughtError.message : 'Unknown manual link error');
    } finally {
      setDrawerLinkSubmitting(false);
    }
  }

  function getTransitionEventKey(event: PalworldTransitionMilestoneEvent): string {
    return `${event.playerId}:${event.eventType}:${event.occurredAt}:${event.fromValue ?? ''}:${event.toValue ?? ''}`;
  }

  async function postPalworldTransitionEvent(event: PalworldTransitionMilestoneEvent): Promise<void> {
    if (!selectedServer || selectedServer.game !== 'palworld') {
      return;
    }

    const eventKey = getTransitionEventKey(event);

    try {
      setPalworldTransitionPostSubmittingKey(eventKey);
      setPalworldTransitionPostSuccessKey(null);
      setPalworldTransitionPostErrorKey(null);
      setPalworldTransitionPostError(null);

      const response = await fetch(`${apiBaseUrl}/servers/${selectedServer.id}/palworld/milestones/transitions/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
  serverId: event.serverId,
  playerId: event.playerId,
  eventType: event.eventType,
  occurredAt: event.occurredAt,  
  fromValue: event.fromValue,
  toValue: event.toValue
})
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? `Manual post failed with status ${response.status}`);
      }

      await response.json().catch(() => null) as PalworldManualTransitionPostResponse | null;
      setPalworldTransitionPostSuccessKey(eventKey);
    } catch (caughtError) {
      setPalworldTransitionPostErrorKey(eventKey);
      setPalworldTransitionPostError(caughtError instanceof Error ? caughtError.message : 'Unknown manual post error');
    } finally {
      setPalworldTransitionPostSubmittingKey(null);
    }
  }

  const palworldPlayerList = useMemo<PalworldPlayerListEntry[]>(() => {
    const normalize = (value: string | null | undefined) => value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
    const stateRank: Record<PalworldIdentityListState, number> = {
      approved: 0,
      candidate: 1,
      unresolved: 2,
      rejected: 3
    };

    const getPlayerState = (player: PalworldLatestPlayerTelemetry): PalworldIdentityListState => {
      const playerKeys = [
        player.lookupKey,
        player.playerId ?? '',
        player.userId ?? '',
        player.accountName ?? '',
        player.playerName ?? ''
      ].map(normalize).filter(Boolean);

      const matchesReviewRecord = (
        record: PalworldApprovedIdentity | PalworldRejectedIdentity
      ): boolean => {
        const recordKeys = [
          record.telemetryLookupKey ?? '',
          record.playerId ?? '',
          record.userId ?? '',
          record.accountName ?? '',
          record.playerName ?? ''
        ].map(normalize).filter(Boolean);

        return recordKeys.some((key) => playerKeys.includes(key));
      };

      if (palworldApprovedIdentities.some((record) => matchesReviewRecord(record))) {
        return 'approved';
      }

      if (palworldRejectedIdentities.some((record) => matchesReviewRecord(record))) {
        return 'rejected';
      }

      const hasCandidate = palworldIdentityCandidates.some((candidate) => {
        const candidateKeys = [
          candidate.telemetryLookupKey ?? '',
          candidate.candidate.playerId ?? '',
          candidate.candidate.userId ?? '',
          candidate.candidate.accountName ?? '',
          candidate.candidate.playerName ?? ''
        ].map(normalize).filter(Boolean);

        return candidateKeys.some((key) => playerKeys.includes(key));
      });

      return hasCandidate ? 'candidate' : 'unresolved';
    };

    return [...palworldLatestPlayers]
      .map((player) => ({
        player,
        identityState: getPlayerState(player)
      }))
      .sort((left, right) => {
        const stateDelta = stateRank[left.identityState] - stateRank[right.identityState];
        if (stateDelta !== 0) {
          return stateDelta;
        }

        if (Number(right.player.isOnline) !== Number(left.player.isOnline)) {
          return Number(right.player.isOnline) - Number(left.player.isOnline);
        }

        if ((right.player.level ?? -1) !== (left.player.level ?? -1)) {
          return (right.player.level ?? -1) - (left.player.level ?? -1);
        }

        return (right.player.lastSeenAt ?? '').localeCompare(left.player.lastSeenAt ?? '');
      });
  }, [
    palworldApprovedIdentities,
    palworldIdentityCandidates,
    palworldLatestPlayers,
    palworldRejectedIdentities
  ]);

  const sortedPlayerProfiles = useMemo(() => {
    return [...playerProfiles].sort((left, right) => {
      if (Number(right.isOnline) !== Number(left.isOnline)) {
        return Number(right.isOnline) - Number(left.isOnline);
      }

      return right.recentTrackedSeconds - left.recentTrackedSeconds;
    });
  }, [playerProfiles]);

  const nowOnlinePlayerProfiles = useMemo(() => {
    return sortedPlayerProfiles
      .filter((profile) => profile.isOnline)
      .slice(0, 5);
  }, [sortedPlayerProfiles]);

  const topPlayerProfiles = useMemo(() => {
    return [...playerProfiles]
      .sort((left, right) => right.trackedSeconds7d - left.trackedSeconds7d)
      .slice(0, 5);
  }, [playerProfiles]);

  const saveLinkNeededPlayerProfiles = useMemo(() => {
    return [...playerProfiles]
      .filter((profile) => !profile.saveArtifact.present)
      .sort((left, right) => right.recentTrackedSeconds - left.recentTrackedSeconds)
      .slice(0, 3);
  }, [playerProfiles]);

  const reviewSavePlayerProfiles = useMemo(() => {
    return [...playerProfiles]
      .filter((profile) => !profile.saveArtifact.present && profile.trackedSeconds7d > 0)
      .sort((left, right) => right.trackedSeconds7d - left.trackedSeconds7d);
  }, [playerProfiles]);

  const activeSaveLinkNeededCount = useMemo(() => {
    return reviewSavePlayerProfiles.length;
  }, [reviewSavePlayerProfiles]);

  const palworldActionableGuildRisks = useMemo(() => {
    const riskRank: Record<GuildRiskLevel, number> = {
      expired: 0,
      risk: 1,
      watch: 2,
      unknown: 3,
      active: 4
    };

    return [...guildActivity]
      .filter((guild) => guild.riskLevel !== 'unknown' && guild.riskLevel !== 'active')
      .sort((left, right) => {
        const riskDelta = riskRank[left.riskLevel] - riskRank[right.riskLevel];

        if (riskDelta !== 0) {
          return riskDelta;
        }

        return (right.daysInactive ?? -1) - (left.daysInactive ?? -1);
      })
      .slice(0, 5);
  }, [guildActivity]);

  const palworldUrgentGuildRiskCount = useMemo(() => {
    return guildActivity.filter((guild) => guild.riskLevel === 'risk' || guild.riskLevel === 'expired').length;
  }, [guildActivity]);

  const unknownGuildActivityCount = useMemo(() => {
    return guildActivity.filter((guild) => guild.riskLevel === 'unknown' && !reviewedGuildNames.has(guild.guildName)).length;
  }, [guildActivity, reviewedGuildNames]);

  const guildActivityFilterOptions = useMemo(() => {
    const isAtRisk = (guild: PalworldGuildActivityEntry): boolean => (
      guild.riskLevel === 'watch' || guild.riskLevel === 'risk' || guild.riskLevel === 'expired'
    );
    const isLowConfidence = (guild: PalworldGuildActivityEntry): boolean => {
      const tone = getGuildConfidence(guild.members, guild.memberCount).tone;
      return tone === 'low' || tone === 'partial';
    };
    const matchesFilter = (guild: PalworldGuildActivityEntry, filter: GuildActivityFilter): boolean => {
      switch (filter) {
        case 'all':
          return true;
        case 'at-risk':
          return isAtRisk(guild);
        case 'missing-activity':
          return guild.lastMemberSeenAt === null;
        case 'low-confidence':
          return isLowConfidence(guild);
        case 'reviewed':
          return reviewedGuildNames.has(guild.guildName);
      }
    };
    const options: Array<{ value: GuildActivityFilter; label: string; count: number }> = [
      { value: 'all', label: 'All', count: guildActivity.length },
      { value: 'at-risk', label: 'At Risk', count: guildActivity.filter((guild) => matchesFilter(guild, 'at-risk')).length },
      { value: 'missing-activity', label: 'Missing Activity', count: guildActivity.filter((guild) => matchesFilter(guild, 'missing-activity')).length },
      { value: 'low-confidence', label: 'Low Confidence', count: guildActivity.filter((guild) => matchesFilter(guild, 'low-confidence')).length },
      { value: 'reviewed', label: 'Reviewed', count: guildActivity.filter((guild) => matchesFilter(guild, 'reviewed')).length }
    ];

    return {
      options,
      filteredGuildActivity: guildActivity.filter((guild) => matchesFilter(guild, guildActivityFilter))
    };
  }, [guildActivity, guildActivityFilter, reviewedGuildNames]);

  const guildActivityProgress = useMemo(() => {
    const filteredGuilds = guildActivityFilterOptions.filteredGuildActivity;

    if (guildActivityFilter === 'all') {
      return {
        reviewedCount: guildActivity.filter((guild) => reviewedGuildNames.has(guild.guildName)).length,
        totalCount: guildActivity.length,
        labelSuffix: 'guilds'
      };
    }

    return {
      reviewedCount: filteredGuilds.filter((guild) => reviewedGuildNames.has(guild.guildName)).length,
      totalCount: filteredGuilds.length,
      labelSuffix: 'in this filter'
    };
  }, [guildActivity, guildActivityFilter, guildActivityFilterOptions.filteredGuildActivity, reviewedGuildNames]);

  useEffect(() => {
    if (!guildFocusMode) {
      return;
    }

    const filteredGuilds = guildActivityFilterOptions.filteredGuildActivity;
    const selectedGuildIsVisible = filteredGuilds.some((guild) => guild.guildName === expandedGuildActivityName);

    if (filteredGuilds.length === 0) {
      setExpandedGuildActivityName(null);
      return;
    }

    if (!expandedGuildActivityName || !selectedGuildIsVisible) {
      setExpandedGuildActivityName(filteredGuilds[0]?.guildName ?? null);
    }
  }, [expandedGuildActivityName, guildActivityFilterOptions.filteredGuildActivity, guildFocusMode]);

  const visibleGuildActivity = useMemo(() => {
    const filteredGuilds = guildActivityFilterOptions.filteredGuildActivity;

    if (!guildFocusMode) {
      return filteredGuilds;
    }

    const focusedGuild = filteredGuilds.find((guild) => guild.guildName === expandedGuildActivityName);
    return focusedGuild ? [focusedGuild] : [];
  }, [expandedGuildActivityName, guildActivityFilterOptions.filteredGuildActivity, guildFocusMode]);

  const selectedPalworldGuild = useMemo(() => {
    if (!expandedGuildActivityName) {
      return null;
    }

    return guildActivity.find((guild) => guild.guildName === expandedGuildActivityName) ?? null;
  }, [expandedGuildActivityName, guildActivity]);

  function markGuildReviewedAndAdvance(guildName: string): void {
    setReviewedGuildNames((current) => new Set(current).add(guildName));

    const currentIndex = guildActivityFilterOptions.filteredGuildActivity.findIndex((guild) => guild.guildName === guildName);
    const nextGuild = currentIndex >= 0 ? guildActivityFilterOptions.filteredGuildActivity[currentIndex + 1] : null;
    setExpandedGuildActivityName(nextGuild?.guildName ?? null);
  }

  const palworldBaseCapacity = useMemo(() => {
    if (palworldBaseSignal === null) {
      return null;
    }

    const estimatedBases = palworldRefinedEstimatedBases ?? Math.round(palworldBaseSignal / 3);
    const usagePercent = Math.round((estimatedBases / 240) * 100);
    const remainingCapacity = Math.max(0, 240 - estimatedBases);
    let statusLabel = 'Safe';
    let summary = 'Plenty of room remaining';

    if (usagePercent >= 90) {
      statusLabel = 'Critical';
    } else if (usagePercent >= 75) {
      statusLabel = 'High';
    } else if (usagePercent >= 50) {
      statusLabel = 'Moderate';
    }

    if (usagePercent >= 95) {
      summary = 'Near cap';
    } else if (usagePercent >= 80) {
      summary = 'High base pressure';
    } else if (usagePercent >= 60) {
      summary = 'Watch base growth closely';
    } else if (usagePercent >= 30) {
      summary = 'Growing, but comfortable';
    }

    return {
      estimatedBases,
      usagePercent,
      remainingCapacity,
      statusLabel,
      summary
    };
  }, [palworldBaseSignal, palworldRefinedEstimatedBases]);

  const palworldBaseSignalTrend = useMemo(() => {
    const recentValues = palworldBaseSignalHistory.slice(-5).map((entry) => entry.baseSignal);

    if (recentValues.length < 2) {
      return {
        direction: 'stable',
        indicator: '→',
        recentValues
      } as const;
    }

    const delta = recentValues[recentValues.length - 1] - recentValues[0];

    if (delta > 0) {
      return {
        direction: 'increasing',
        indicator: '▲',
        recentValues
      } as const;
    }

    if (delta < 0) {
      return {
        direction: 'decreasing',
        indicator: '▼',
        recentValues
      } as const;
    }

    return {
      direction: 'stable',
      indicator: '→',
      recentValues
    } as const;
  }, [palworldBaseSignalHistory]);
  const hasPalworldBaseTelemetry = palworldBaseSignal !== null
    && palworldBaseCapacity !== null
    && (palworldBaseSignal > 0 || palworldBaseSignalHistory.length > 0);

  const palworldBaseCapacityAlerts = useMemo(() => {
    if (!hasPalworldBaseTelemetry || palworldBaseCapacity === null) {
      return null;
    }

    let severity = 'safe';
    let alertMessage = 'No immediate base pressure';

    if (palworldBaseCapacity.usagePercent >= 95) {
      severity = 'critical';
      alertMessage = 'Base cap is near full';
    } else if (palworldBaseCapacity.usagePercent >= 80) {
      severity = 'high';
      alertMessage = 'High base pressure';
    } else if (palworldBaseCapacity.usagePercent >= 60) {
      severity = 'warning';
      alertMessage = 'Base usage is climbing';
    }

    const recentValues = palworldBaseSignalTrend.recentValues;
    const growthDelta = recentValues.length >= 2
      ? recentValues[recentValues.length - 1] - recentValues[0]
      : 0;

    let growthAlert: string | null = null;

    if (growthDelta >= 20) {
      growthAlert = 'Rapid base growth detected';
    } else if (growthDelta >= 10) {
      growthAlert = 'Base growth is accelerating';
    }

    return {
      severity,
      alertMessage,
      growthAlert
    };
  }, [hasPalworldBaseTelemetry, palworldBaseCapacity, palworldBaseSignalTrend]);

  const palworldNextActions = useMemo<PalworldNextAction[]>(() => {
    const actions: PalworldNextAction[] = [];

    if (palworldUrgentGuildRiskCount > 0) {
      actions.push({
        label: `${palworldUrgentGuildRiskCount} urgent guild ${palworldUrgentGuildRiskCount === 1 ? 'risk needs' : 'risks need'} review`,
        cta: 'View Guilds',
        targetTab: 'guilds'
      });
    }

    if (activeSaveLinkNeededCount > 0) {
      actions.push({
        label: `Link saves for ${activeSaveLinkNeededCount} active ${activeSaveLinkNeededCount === 1 ? 'player' : 'players'}`,
        cta: 'Review Saves',
        targetTab: 'players'
      });
    }

    if (unknownGuildActivityCount > 0) {
      actions.push({
        label: `Resolve missing activity data for ${unknownGuildActivityCount} ${unknownGuildActivityCount === 1 ? 'guild' : 'guilds'}`,
        cta: 'View Guilds',
        targetTab: 'guilds'
      });
    }

    if (palworldBaseCapacityAlerts && palworldBaseCapacityAlerts.severity !== 'safe') {
      actions.push({
        label: palworldBaseCapacityAlerts.alertMessage,
        cta: 'View Operations',
        targetTab: 'ops'
      });
    }

    if (palworldBaseCapacityAlerts?.growthAlert) {
      actions.push({
        label: palworldBaseCapacityAlerts.growthAlert,
        cta: 'View Operations',
        targetTab: 'ops'
      });
    }

    if (actions.length === 0) {
      actions.push({
        label: 'No immediate action needed',
        cta: 'All Good',
        targetTab: 'overview'
      });
    }

    return actions.slice(0, 4);
  }, [activeSaveLinkNeededCount, palworldBaseCapacityAlerts, palworldUrgentGuildRiskCount, unknownGuildActivityCount]);

  const palworldCorePlayers = useMemo(() => {
    return [...palworldPlayerProfiles]
      .filter((profile) => profile.playerIntelligence.classification === 'Core Player')
      .sort((left, right) => {
        const engagementDelta = right.playerIntelligence.engagementScore - left.playerIntelligence.engagementScore;

        if (engagementDelta !== 0) {
          return engagementDelta;
        }

        return (right.level ?? -1) - (left.level ?? -1);
      })
      .slice(0, 10);
  }, [palworldPlayerProfiles]);

  const palworldGuildSummary = useMemo(() => {
    const isLikelyRealGuild = (guild: PalworldGuildHint): boolean => {
      const normalizedName = guild.guildName?.trim().toLowerCase() ?? '';
      return normalizedName !== ''
        && normalizedName !== 'unknown'
        && normalizedName !== 'unknown guild'
        && normalizedName !== 'unnamed guild';
    };

    const guildsWithTwoPlusMembers = palworldGuilds.filter((guild) => (guild.memberCount ?? guild.members?.length ?? 0) >= 2).length;
    const guildsWithThreePlusMembers = palworldGuilds.filter((guild) => (guild.memberCount ?? guild.members?.length ?? 0) >= 3).length;

    return {
      totalGuildHints: palworldGuilds.length,
      likelyRealGuilds: palworldGuilds.filter(isLikelyRealGuild).length,
      activeGuildsTwoPlus: guildsWithTwoPlusMembers,
      activeGuildsThreePlus: guildsWithThreePlusMembers
    };
  }, [palworldGuilds]);

  useEffect(() => {
    if (!selectedServer || selectedServer.game !== 'palworld') {
      return;
    }

    setSelectedPalworldPlayerKey((current) => {
      if (current && palworldPlayerList.some((entry) => entry.player.lookupKey === current)) {
        return current;
      }

      const approvedOnlinePlayers = palworldPlayerList.filter((entry) => (
        entry.identityState === 'approved' && entry.player.isOnline
      ));

      if (approvedOnlinePlayers.length === 1) {
        return approvedOnlinePlayers[0]?.player.lookupKey ?? null;
      }

      return palworldPlayerList[0]?.player.lookupKey ?? null;
    });
  }, [palworldPlayerList, selectedServer]);

  const filteredServers = useMemo(() => {
    if (activeWorkspace === 'valheim' || activeWorkspace === 'palworld') {
      return serverOptions.filter((server) => server.game === activeWorkspace);
    }

    return serverOptions.filter((server) => (
      selectedGameFilter === 'all' || server.game === selectedGameFilter
    ));
  }, [activeWorkspace, selectedGameFilter, serverOptions]);

  useEffect(() => {
    if (filteredServers.length === 0) {
      setSelectedServerId('');
      return;
    }

    if (!filteredServers.some((server) => server.id === selectedServerId)) {
      setSelectedServerId(filteredServers[0]?.id ?? '');
    }
  }, [filteredServers, selectedServerId]);

  const selectedServerSummary = selectedServer ? fleetByServerId[selectedServer.id] ?? null : null;
  const selectedWorldMemory = useMemo(() => {
    if (!selectedServer || !selectedServerSummary) {
      return createWorldMemoryRegistry({ serverId: selectedServerId || 'unselected' });
    }

    if (selectedServer.game === 'valheim') {
      return createWorldMemoryRegistry({
        serverId: selectedServer.id,
        valheim: {
          serverId: selectedServer.id,
          playerIntelligence: selectedServerSummary.playerIntelligence,
          playerEngagement: selectedServerSummary.playerEngagement,
          knownPlayers: selectedServerSummary.knownPlayers,
          recentEvents: selectedServerSummary.recentEvents
        }
      });
    }

    return createWorldMemoryRegistry({
      serverId: selectedServer.id,
      palworld: {
        serverId: selectedServer.id,
        guildActivity
      }
    });
  }, [guildActivity, selectedServer, selectedServerId, selectedServerSummary]);
  const worldCards = useMemo(() => {
    return serverOptions
      .filter((server) => server.game === 'valheim' || server.game === 'palworld')
      .sort((left, right) => {
        const order = { valheim: 0, palworld: 1 } satisfies Record<ServerOption['game'], number>;
        return order[left.game] - order[right.game];
      })
      .map((server) => ({
        server,
        summary: fleetByServerId[server.id]
      }));
  }, [fleetByServerId, serverOptions]);
  const fleetCounts = useMemo(() => {
    const countedServers = activeWorkspace === 'overview' ? serverOptions : filteredServers;
    const visibleSummaries = countedServers
      .map((server) => fleetByServerId[server.id])
      .filter((summary): summary is ServerSummary => Boolean(summary));

    return {
      servers: countedServers.length,
      online: visibleSummaries.filter((summary) => summary.state === 'online').length,
      degraded: visibleSummaries.filter((summary) => summary.state === 'degraded').length,
      activePlayers: visibleSummaries.reduce((sum, summary) => sum + summary.activePlayers, 0)
    };
  }, [activeWorkspace, filteredServers, fleetByServerId, serverOptions]);

  const apiHealthLabel = health?.ok ? 'Online' : 'Unknown';
  const selectedWarningSummary = useMemo(
    () => summarizeWarnings(selectedServerSummary?.recentWarnings ?? []),
    [selectedServerSummary]
  );

  const detailTabs = useMemo(() => {
    if (selectedServer?.game === 'palworld') {
      return [
        { key: 'highlights', label: 'Chronicle' },
        { key: 'overview', label: 'Community' },
        { key: 'players', label: 'Players' },
        { key: 'guilds', label: 'Guilds' },
        { key: 'ops', label: 'Operations' }
      ] satisfies Array<{ key: DashboardTab; label: string }>;
    }

    return [
      { key: 'activity', label: 'Chronicle' },
      { key: 'overview', label: 'Community' },
      { key: 'players', label: 'Players' },
      { key: 'characters', label: 'Characters' },
      { key: 'ops', label: 'Operations' }
    ] satisfies Array<{ key: DashboardTab; label: string }>;
  }, [selectedServer?.game]);

  useEffect(() => {
    if (!detailTabs.some((tab) => tab.key === selectedDashboardTab)) {
      setSelectedDashboardTab('overview');
    }
  }, [detailTabs, selectedDashboardTab]);

  const selectedAlertCount = useMemo(() => {
    let count = selectedServerSummary?.recentWarnings.length ?? 0;

    if (selectedServer?.game === 'palworld' && palworldBaseCapacityAlerts) {
      if (palworldBaseCapacityAlerts.severity !== 'safe') {
        count += 1;
      }

      if (palworldBaseCapacityAlerts.growthAlert) {
        count += 1;
      }
    }

    return count;
  }, [palworldBaseCapacityAlerts, selectedServer?.game, selectedServerSummary]);

  const palworldOverviewHighlights = useMemo(() => {
    const items: string[] = [];
    const pushHighlight = (value: string | null | undefined): void => {
      const normalized = value?.trim();

      if (!normalized || items.includes(normalized)) {
        return;
      }

      items.push(normalized);
    };

    const largestGuild = [...guildActivity].sort((left, right) => right.memberCount - left.memberCount)[0];
    const recentlyActiveGuild = [...guildActivity]
      .filter((guild) => guild.lastMemberSeenAt)
      .sort((left, right) => (right.lastMemberSeenAt ?? '').localeCompare(left.lastMemberSeenAt ?? ''))[0];
    const activeTodayCount = guildActivity.filter((guild) => guild.daysInactive === 0).length;

    if (largestGuild) {
      pushHighlight(`Largest guild: ${largestGuild.guildName} with ${largestGuild.memberCount} members`);
    }

    if (recentlyActiveGuild?.lastMemberSeenAt) {
      pushHighlight(`Recently active guild: ${recentlyActiveGuild.guildName}`);
    }

    if (activeTodayCount > 0) {
      pushHighlight(`${activeTodayCount} guild${activeTodayCount === 1 ? '' : 's'} active today`);
    }

    if (palworldBaseCapacityAlerts?.growthAlert) {
      pushHighlight(palworldBaseCapacityAlerts.growthAlert);
    }

    if (hasPalworldBaseTelemetry && palworldBaseCapacity) {
      pushHighlight(`Base pressure ${palworldBaseCapacity.statusLabel.toLowerCase()} at ${palworldBaseCapacity.usagePercent}%`);
      pushHighlight(`${palworldBaseCapacity.estimatedBases} / 240 bases, ${palworldBaseCapacity.remainingCapacity} slots left`);
    }

    if (palworldMilestoneFeed[0]) {
      const entry = palworldMilestoneFeed[0];
      pushHighlight(`${entry.playerName ?? entry.accountName ?? entry.playerId} hit ${entry.signalLabel}`);
    }

    if (palworldTransitionEvents[0]) {
      const event = palworldTransitionEvents[0];
      pushHighlight(`${event.playerName ?? event.accountName ?? event.playerId}: ${event.eventType.toLowerCase().replace(/_/g, ' ')}`);
    }

    if (items.length === 0) {
      items.push('This archipelago is still building its history.');
    }

    return items.slice(0, 5);
  }, [
    guildActivity,
    hasPalworldBaseTelemetry,
    palworldBaseCapacity,
    palworldBaseCapacityAlerts,
    palworldMilestoneFeed,
    palworldTransitionEvents
  ]);

  const valheimOverviewHighlights = useMemo(() => {
    const items: string[] = [];
    const pushHighlight = (value: string | null | undefined): void => {
      const normalized = value?.trim();

      if (!normalized || items.includes(normalized)) {
        return;
      }

      items.push(normalized);
    };

    if (selectedWarningSummary[0]) {
      pushHighlight(selectedWarningSummary[0].snippet);
    }

    if (selectedServerSummary?.activityLog[0]) {
      const item = selectedServerSummary.activityLog[0];
      pushHighlight(item.description);
    }

    const topPlayer = [...(selectedServerSummary?.knownPlayers ?? [])]
      .sort((left, right) => right.observationCount - left.observationCount)[0];

    if (topPlayer) {
      pushHighlight(`Most observed player: ${topPlayer.displayName}`);
    }

    if ((selectedServerSummary?.activePlayers ?? 0) > 0) {
      pushHighlight(`${selectedServerSummary?.activePlayers ?? 0} active sessions detected`);
    }

    return items.slice(0, 5);
  }, [selectedServerSummary, selectedWarningSummary]);

  const valheimCorePlayers = useMemo(() => {
    return [...(selectedServerSummary?.knownPlayers ?? [])]
      .sort((left, right) => right.observationCount - left.observationCount)
      .slice(0, 5);
  }, [selectedServerSummary]);

  const activeHighlights = selectedServer?.game === 'palworld'
    ? palworldOverviewHighlights
    : valheimOverviewHighlights;
  const valheimCharacters = useMemo(() => {
    return selectedServer?.game === 'valheim' ? getValheimCharactersFromMemory(selectedWorldMemory) : [];
  }, [selectedServer?.game, selectedWorldMemory]);
  const selectedWorldEvents = useMemo(() => {
    if (!selectedServer) {
      return [];
    }

    const trustedEvents = worldMemoryChronicleToWorldEvents(selectedWorldMemory);
    if (trustedEvents.length > 0) {
      return createWorldEventRegistry(selectedServer.id, trustedEvents).events;
    }

    const previewWorldId = selectedServer.game === 'palworld'
      ? 'preview-palworld-world'
      : 'preview-valheim-world';
    return createWorldEventRegistry(previewWorldId, worldEventPreviewEvents).events;
  }, [selectedServer, selectedWorldMemory]);
  const selectedWorldEventsArePreviewFallback = useMemo(() => {
    if (!selectedServer) {
      return false;
    }

    return worldMemoryChronicleToWorldEvents(selectedWorldMemory).length === 0;
  }, [selectedServer, selectedWorldMemory]);
  const selectedWorldEventByChronicleId = useMemo(() => {
    const entries = selectedWorldEvents
      .map((event) => {
        const sourceChronicleEventId = event.metadata.sourceChronicleEventId;
        return typeof sourceChronicleEventId === 'string' ? [sourceChronicleEventId, event.id] as const : null;
      })
      .filter((entry): entry is readonly [string, string] => entry !== null);

    return new Map(entries);
  }, [selectedWorldEvents]);
  const selectedWorldEventChronicleEntries = useMemo(() => {
    return selectedWorldEventsArePreviewFallback ? worldEventsToChronicleEntries(selectedWorldEvents) : [];
  }, [selectedWorldEvents, selectedWorldEventsArePreviewFallback]);
  function openWorldEventDetail(worldEventId: string): void {
    const worldEvent = selectedWorldEvents.find((event) => event.id === worldEventId);

    if (worldEvent) {
      setSelectedWorldEventDetail(worldEvent);
    }
  }

  const valheimChronicleEvents = useMemo(() => {
    if (selectedServer?.game !== 'valheim') {
      return [];
    }

    return [...selectedWorldMemory.chronicleEvents, ...selectedWorldEventChronicleEntries]
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
      .slice(0, 14);
  }, [selectedServer?.game, selectedWorldEventChronicleEntries, selectedWorldMemory]);
  const palworldGuildIntelligence = useMemo(() => {
    return selectedServer?.game === 'palworld' ? getPalworldGuildIntelligenceFromMemory(selectedWorldMemory) : [];
  }, [selectedServer?.game, selectedWorldMemory]);
  const palworldChronicleEvents = useMemo(() => {
    if (selectedServer?.game !== 'palworld') {
      return [];
    }

    return [...selectedWorldMemory.chronicleEvents, ...selectedWorldEventChronicleEntries]
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
      .slice(0, 14);
  }, [selectedServer?.game, selectedWorldEventChronicleEntries, selectedWorldMemory]);
  const searchableWorldMemoryRecords = useMemo(() => {
    if (!selectedServer) {
      return [];
    }

    return selectedWorldMemory.records.filter((record) => record.game === selectedServer.game);
  }, [selectedServer, selectedWorldMemory]);
  const worldMemorySearchResults = useMemo(() => {
    if (!selectedServer) {
      return [];
    }

    return buildWorldMemorySearchResults(selectedWorldMemory.records, worldMemorySearchQuery, selectedServer.game);
  }, [selectedServer, selectedWorldMemory, worldMemorySearchQuery]);
  const selectedPalworldGuildMemoryDetail = useMemo(() => {
    if (!selectedPalworldGuild) {
      return null;
    }

    const guildMemory = palworldGuildIntelligence.find((entry) => entry.guild.guildName === selectedPalworldGuild.guildName);
    return guildMemory ? selectedWorldMemory.getDetail(guildMemory.memoryRecordId) : null;
  }, [palworldGuildIntelligence, selectedPalworldGuild, selectedWorldMemory]);
  const selectedValheimCharacterMemoryDetail = useMemo(() => {
    if (selectedServer?.game !== 'valheim' || (!selectedPlayerIntelligenceId && !selectedValheimPlayerLookupKey)) {
      return null;
    }

    const characterRecord = selectedWorldMemory.records.find((record) => (
      record.game === 'valheim'
      && record.type === 'character'
      && (
        String(record.metadata.playerId ?? record.id) === selectedPlayerIntelligenceId
        || normalizePlayerKey(record.displayName) === selectedValheimPlayerLookupKey
      )
    ));

    return characterRecord ? selectedWorldMemory.getDetail(characterRecord.id) : null;
  }, [selectedPlayerIntelligenceId, selectedServer?.game, selectedValheimPlayerLookupKey, selectedWorldMemory]);
  function openWorldMemoryRecord(record: WorldMemoryRecord): void {
    setSelectedMemoryDetail(null);

    if (record.game === 'valheim' && record.type === 'character') {
      setSelectedDashboardTab('characters');
      setSelectedPlayerIntelligenceId(String(record.metadata.playerId ?? record.id));
      setSelectedValheimPlayerLookupKey(normalizePlayerKey(record.displayName));
      return;
    }

    if (record.game === 'palworld' && record.type === 'guild') {
      setSelectedDashboardTab('guilds');
      setExpandedGuildActivityName(record.displayName);
      return;
    }

    if (record.game === 'palworld' && record.type === 'person') {
      const normalizedRecordName = normalizePlayerKey(record.displayName);
      const matchedProfile = playerProfiles.find((profile) => normalizePlayerKey(getProfileDisplayName(profile)) === normalizedRecordName);

      if (matchedProfile) {
        setSelectedDashboardTab('players');
        setSelectedPlayerProfile(matchedProfile);
        return;
      }
    }

    setSelectedMemoryDetail(selectedWorldMemory.getDetail(record.id));
  }
  const palworldCommunityPulse = useMemo(() => {
    const onlinePlayers = palworldLatestPlayers.filter((player) => player.isOnline).length;
    const activeGuilds = palworldGuildSummary.activeGuildsTwoPlus;
    const corePlayers = palworldCorePlayers.length;
    const pulseLoad = onlinePlayers + activeGuilds + corePlayers;

    if (pulseLoad >= 18 || (onlinePlayers >= 10 && activeGuilds >= 4)) {
      return {
        state: 'Surging',
        summary: 'Multiple groups are active and the world is moving quickly.'
      };
    }

    if (pulseLoad >= 10 || (onlinePlayers >= 6 && activeGuilds >= 2)) {
      return {
        state: 'Active',
        summary: 'Player and guild activity are clearly elevated.'
      };
    }

    if (pulseLoad >= 4) {
      return {
        state: 'Steady',
        summary: 'The world is engaged without unusual pressure.'
      };
    }

    return {
      state: 'Quiet',
      summary: 'Light activity across players and guilds right now.'
    };
  }, [palworldCorePlayers.length, palworldGuildSummary.activeGuildsTwoPlus, palworldLatestPlayers]);

  const valheimCommunityPulse = useMemo(() => {
    const activePlayers = selectedServerSummary?.activePlayers ?? 0;
    const recentWarnings = selectedWarningSummary.length;

    if (activePlayers >= 8) {
      return {
        state: 'Surging',
        summary: 'Heavy player traffic is hitting the server right now.'
      };
    }

    if (activePlayers >= 4) {
      return {
        state: 'Active',
        summary: 'Player activity is healthy and visible across the server.'
      };
    }

    if (activePlayers >= 1 || recentWarnings > 0) {
      return {
        state: 'Steady',
        summary: 'Some activity is present, but the server is not crowded.'
      };
    }

    return {
      state: 'Quiet',
      summary: 'Very little activity is visible right now.'
    };
  }, [selectedServerSummary, selectedWarningSummary.length]);

  const activeCommunityPulse = selectedServer?.game === 'palworld'
    ? palworldCommunityPulse
    : valheimCommunityPulse;

  const palworldServerHealthSummary = useMemo(() => {
    if (!hasPalworldBaseTelemetry || !palworldBaseCapacity) {
      return null;
    }

    return {
      status: palworldBaseCapacity.statusLabel,
      estimatedBasesLabel: `${palworldBaseCapacity.estimatedBases} / 240`,
      remainingSlotsLabel: `${palworldBaseCapacity.remainingCapacity}`,
      trendLabel: `${palworldBaseSignalTrend.indicator} ${palworldBaseSignalTrend.direction}`,
      summary: palworldBaseCapacity.summary
    };
  }, [hasPalworldBaseTelemetry, palworldBaseCapacity, palworldBaseSignalTrend.direction, palworldBaseSignalTrend.indicator]);

  const serverHealthTone = useMemo(() => {
    if (selectedServer?.game === 'palworld' && palworldServerHealthSummary) {
      const normalized = palworldServerHealthSummary.status.toLowerCase();

      if (normalized === 'safe') {
        return 'safe';
      }

      if (normalized === 'critical') {
        return 'critical';
      }

      if (normalized === 'high') {
        return 'high';
      }

      return 'warning';
    }

    if (selectedServerSummary?.state === 'online') {
      return 'safe';
    }

    if (selectedServerSummary?.state === 'degraded') {
      return 'warning';
    }

    if (selectedServerSummary?.state === 'offline') {
      return 'critical';
    }

    return 'high';
  }, [palworldServerHealthSummary, selectedServer?.game, selectedServerSummary?.state]);

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-title-row">
          <h1>GameOps Bridge</h1>
          <span className="dashboard-kicker">Live server operations</span>
        </div>

        <div className="dashboard-control-rail">
          <nav className="workspace-nav" aria-label="Workspace navigation">
            <button
              type="button"
              className={activeWorkspace === 'overview' ? 'workspace-nav-item workspace-nav-item-active' : 'workspace-nav-item'}
              onClick={() => {
                setActiveWorkspace('overview');
                setSelectedGameFilter('all');
              }}
            >
              <span className="workspace-nav-symbol" aria-hidden="true">O</span>
              <span>Overview</span>
            </button>
            <button
              type="button"
              className={activeWorkspace === 'valheim' ? 'workspace-nav-item workspace-nav-item-active workspace-nav-valheim' : 'workspace-nav-item workspace-nav-valheim'}
              onClick={() => {
                setActiveWorkspace('valheim');
                setSelectedGameFilter('valheim');
              }}
            >
              <span className="workspace-nav-symbol" aria-hidden="true">V</span>
              <span>Valheim</span>
            </button>
            <button
              type="button"
              className={activeWorkspace === 'palworld' ? 'workspace-nav-item workspace-nav-item-active workspace-nav-palworld' : 'workspace-nav-item workspace-nav-palworld'}
              onClick={() => {
                setActiveWorkspace('palworld');
                setSelectedGameFilter('palworld');
              }}
            >
              <span className="workspace-nav-symbol" aria-hidden="true">P</span>
              <span>Palworld</span>
            </button>
          </nav>

          <div className="status-strip">
            <div className="status-pill">
              <span className="status-label">API</span>
              <span className="status-value status-good">{apiHealthLabel}</span>
            </div>
            <div className="status-pill">
              <span className="status-label">Servers</span>
              <span className="status-value">{fleetCounts.servers}</span>
            </div>
            <div className="status-pill">
              <span className="status-label">Online</span>
              <span className="status-value">{fleetCounts.online}</span>
            </div>
            <div className="status-pill">
              <span className="status-label">Players</span>
              <span className="status-value">{fleetCounts.activePlayers}</span>
            </div>
            {lastUpdatedAt ? (
              <div className="status-pill">
                <span className="status-label">Updated</span>
                <span className="status-value">{formatClock(lastUpdatedAt)}</span>
              </div>
            ) : null}
            {activeWorkspace !== 'overview' && selectedServer && selectedServerSummary ? (
              <>
                <div className="status-pill selected-status-pill">
                  <span className="status-label">Selected</span>
                  <span className="status-value">{selectedServerSummary.displayName}</span>
                </div>
                <div className="status-pill">
                  <span className="status-label">Configured</span>
                  <span className="status-value status-good">{selectedServerSummary.operationalStatus.configured ? 'yes' : 'no'}</span>
                </div>
                <div className="status-pill">
                  <span className="status-label">Connector</span>
                  <span className={`status-value ${getConnectorStatusTone(selectedServerSummary.operationalStatus.connectorStatus)}`}>
                    {selectedServerSummary.operationalStatus.connectorStatus}
                  </span>
                </div>
                <div className="status-pill">
                  <span className="status-label">Telemetry</span>
                  <span className="status-value">{getTelemetryAvailabilityLabel(selectedServerSummary)}</span>
                </div>
                <div className="status-pill">
                  <span className="status-label">Alerts</span>
                  <span className="status-value">{selectedAlertCount}</span>
                </div>
              </>
            ) : null}
          </div>

          {activeWorkspace !== 'overview' && selectedServer && selectedServerSummary ? (
            <div className="dashboard-tab-row">
              {detailTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`review-button ${selectedDashboardTab === tab.key ? 'approve-button' : 'reject-button'}`}
                  onClick={() => setSelectedDashboardTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {serverOptionsLoading ? <p className="subtle dashboard-message">Loading configured servers...</p> : null}
        {serverOptionsError ? <p className="error dashboard-message">Server catalog unavailable: {serverOptionsError}</p> : null}
        {fleetError ? <p className="error dashboard-message">Fleet refresh failed: {fleetError}</p> : null}
      </header>

      {activeWorkspace === 'overview' ? (
        <section className="overview-shell" aria-label="Global Overview">
          <div className="overview-heading">
            <div>
              <span className="summary-label">Overview</span>
              <h2>How are all my worlds?</h2>
              <p className="subtle">One card per world. Open a world to inspect community, players, world history, and operations.</p>
            </div>
          </div>

          {fleetLoading ? <p className="subtle">Loading world status...</p> : null}

          <div className="world-card-grid">
            {worldCards.length === 0 && !serverOptionsLoading ? (
              <article className="card detail-card">
                <p className="subtle">No configured Valheim or Palworld servers found.</p>
              </article>
            ) : null}
            {worldCards.map(({ server, summary }) => {
              const onlineNow = summary?.game === 'palworld'
                ? summary.palworldLatestPlayers.filter((player) => player.isOnline).length || summary.activePlayers
                : summary?.activePlayers ?? 0;
              const activeThisWeek = summary?.serverAliveRhythm.sevenDays.uniqueActivePlayers ?? 0;

              return (
                <article
                  key={server.id}
                  className={`card world-card world-card-${server.game}`}
                >
                  <div className="world-card-top">
                    <div>
                      <span className="world-card-identity">
                        <span className="world-card-symbol" aria-hidden="true">{getGameSymbol(server.game)}</span>
                        <span className="summary-label">{getGameLabel(server.game)}</span>
                      </span>
                      <h3>{summary?.displayName ?? server.displayName}</h3>
                    </div>
                    <span className={`state-pill state-${summary?.state ?? 'offline'}`}>
                      {summary?.state ?? 'loading'}
                    </span>
                  </div>
                  <div className="world-card-stats">
                    <div>
                      <span className="world-stat-value">{onlineNow}</span>
                      <span className="world-stat-label">Online now</span>
                    </div>
                    <div>
                      <span className="world-stat-value">{activeThisWeek}</span>
                      <span className="world-stat-label">Active this week</span>
                    </div>
                  </div>
                  <div className="world-card-activity">
                    <span className="summary-label">Last activity</span>
                    <p>{getLatestActivityLabel(summary)}</p>
                  </div>
                  <button
                    type="button"
                    className="world-card-entry"
                    onClick={() => {
                      setSelectedServerId(server.id);
                      setSelectedGameFilter(server.game);
                      setActiveWorkspace(server.game);
                    }}
                  >
                    Enter {getGameLabel(server.game)}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeWorkspace !== 'overview' ? (
      <section className={`detail-section workspace-shell workspace-shell-${activeWorkspace}`}>
        {!selectedServer || !selectedServerSummary ? (
          <article className="card detail-card">
            <p className="subtle">Select a server from the fleet overview to inspect details.</p>
          </article>
        ) : (
          <>
            {detailLoading ? <p className="subtle">Loading game-specific telemetry...</p> : null}
            {detailError ? <p className="subtle dashboard-message">{detailError}</p> : null}
            <section className={`world-workspace-header world-workspace-header-${selectedServer.game}`}>
              <div className="world-workspace-presence">
                <span className="world-workspace-symbol" aria-hidden="true">{getGameSymbol(selectedServer.game)}</span>
                <div>
                  <span className="summary-label">{getGameLabel(selectedServer.game)} Workspace</span>
                  <h2>{selectedServerSummary.displayName}</h2>
                  <p>{selectedServer.game === 'palworld' ? 'Palworld players, guilds, world context, and operations for this server only.' : 'Valheim community, players, world history, and operations for this server only.'}</p>
                </div>
              </div>
              <span className={`state-pill state-${selectedServerSummary.state}`}>{selectedServerSummary.state}</span>
            </section>

            <section className="workspace-summary-strip" aria-label="World summary">
              <div>
                <span className="summary-label">Online now</span>
                <strong>{selectedServer.game === 'palworld' ? palworldLatestPlayers.filter((player) => player.isOnline).length || selectedServerSummary.activePlayers : selectedServerSummary.activePlayers}</strong>
              </div>
              <div>
                <span className="summary-label">Active this week</span>
                <strong>{selectedServerSummary.serverAliveRhythm.sevenDays.uniqueActivePlayers}</strong>
              </div>
              <div>
                <span className="summary-label">Last activity</span>
                <strong>{getLatestActivityLabel(selectedServerSummary)}</strong>
              </div>
              <div>
                <span className="summary-label">Data</span>
                <strong>{selectedServerSummary.dataFreshness.status}</strong>
              </div>
            </section>

            <WorldMemorySearch
              game={selectedServer.game}
              query={worldMemorySearchQuery}
              results={worldMemorySearchResults}
              totalMemories={searchableWorldMemoryRecords.length}
              onQueryChange={setWorldMemorySearchQuery}
              onOpenResult={openWorldMemoryRecord}
            />

            {selectedDashboardTab === 'overview' ? (
              <WorldChroniclePanel
                title={selectedServer.game === 'palworld' ? 'Archipelago Chronicle' : 'Realm Chronicle'}
                events={selectedServer.game === 'palworld' ? palworldChronicleEvents : valheimChronicleEvents}
                compact
                onOpenWorldEvent={openWorldEventDetail}
                getWorldEventIdForChronicleEvent={(event) => selectedWorldEventByChronicleId.get(event.id) ?? null}
                emptyMessage={selectedServer.game === 'palworld'
                  ? 'The archipelago has not recorded enough guild history yet. More memories will appear as players explore.'
                  : 'This realm is still writing its story. More memories will appear as players explore.'}
              />
            ) : null}

            {selectedDashboardTab === 'overview' ? (
              <WorldEventRenderer
                events={selectedWorldEvents}
                title={selectedWorldEventsArePreviewFallback ? 'World Events Preview' : 'World Events in the Chronicle'}
                description={selectedWorldEventsArePreviewFallback
                  ? 'No trusted World Events are available for this world yet, so this development preview shows how evidence will appear.'
                  : 'Trusted world events are drawn from Chronicle and World Memory records already available in this dashboard.'}
                onSelect={setSelectedWorldEventDetail}
              />
            ) : null}

            {selectedDashboardTab === 'ops' ? (
            <section className="workspace-operations-quiet" aria-label="Technical confidence">
              <DataFreshnessBanner freshness={selectedServerSummary.dataFreshness} />
              <article className="card connector-status-card">
                <div className="connector-status-row">
                <div>
                  <h2>Connector Status</h2>
                  <p className="subtle">{selectedServerSummary.operationalStatus.explanation}</p>
                </div>
                <span className={`state-pill state-${selectedServerSummary.operationalStatus.connectorStatus}`}>
                  {selectedServerSummary.operationalStatus.connectorStatus}
                </span>
              </div>
              <div className="connector-status-meta">
                <span>Configured: {selectedServerSummary.operationalStatus.configured ? 'yes' : 'no'}</span>
                <span>Mode: {selectedServerSummary.operationalStatus.connectorMode ?? 'unknown'}</span>
                <span>Telemetry: {getTelemetryAvailabilityLabel(selectedServerSummary)}</span>
                <span>Last heartbeat: {selectedServerSummary.operationalStatus.lastHeartbeatAt ? formatDurationFromSeconds(selectedServerSummary.operationalStatus.heartbeatAgeSeconds ?? 0) + ' ago' : 'never'}</span>
              </div>
              </article>
            </section>
            ) : null}
            {selectedDashboardTab === 'operator' ? (
              <OperatorWorkspace
                apiBaseUrl={apiBaseUrl}
                brief={operatorBrief}
                briefLoading={operatorBriefLoading}
                briefError={operatorBriefError}
                dailyBrief={operatorDailyBrief}
                dailyBriefLoading={operatorDailyBriefLoading}
                dailyBriefError={operatorDailyBriefError}
                changes={operatorChanges}
                changesLoading={operatorChangesLoading}
                changesError={operatorChangesError}
                insights={operatorInsights}
                insightsLoading={operatorInsightsLoading}
                insightsError={operatorInsightsError}
                memoryIndex={operatorMemoryIndex}
                memoryIndexLoading={operatorMemoryIndexLoading}
                memoryIndexError={operatorMemoryIndexError}
                timelineEvents={operatorTimelineEvents}
                timelineLoading={operatorTimelineLoading}
                timelineError={operatorTimelineError}
                debugServers={filteredServers
                  .map((server) => fleetByServerId[server.id])
                  .filter((summary): summary is ServerSummary => Boolean(summary))}
                serverHealth={filteredServers
                  .map((server) => fleetByServerId[server.id])
                  .filter((summary): summary is ServerSummary => Boolean(summary))
                  .map((summary) => ({
                    displayName: summary.displayName,
                    game: summary.game,
                    health: summary.serverHealth
                  }))}
                communityActivity={filteredServers
                  .map((server) => fleetByServerId[server.id])
                  .filter((summary): summary is ServerSummary => Boolean(summary))
                  .map((summary) => ({
                    displayName: summary.displayName,
                    game: summary.game,
                    activity: summary.communityActivity
                  }))}
                playerIntelligenceSummary={filteredServers
                  .map((server) => fleetByServerId[server.id])
                  .filter((summary): summary is ServerSummary => Boolean(summary))
                  .map((summary) => ({
                    displayName: summary.displayName,
                    game: summary.game,
                    summary: summary.playerIntelligenceSummary
                  }))}
              />
            ) : null}
            {selectedDashboardTab === 'overview' ? (
              <ServerAliveRhythmPanel rhythm={selectedServerSummary.serverAliveRhythm} />
            ) : null}

            <section className="game-section">
              {selectedServer.game === 'palworld' && selectedDashboardTab === 'overview' ? (
                <section className="palworld-command-center">
                  <article className={`card command-summary-card server-health-${serverHealthTone}`}>
                    <div className="command-summary-main">
                      <span className="summary-label">Command Summary</span>
                      <h2>{selectedServerSummary.displayName}</h2>
                      <p>{palworldServerHealthSummary ? `${palworldServerHealthSummary.status}: ${palworldServerHealthSummary.summary}` : selectedServerSummary.operationalStatus.explanation}</p>
                    </div>
                    <div className="command-summary-meta">
                      <span>{playerProfiles.filter((profile) => profile.isOnline).length || selectedServerSummary.activePlayers} online</span>
                      <span>{hasPalworldBaseTelemetry && palworldBaseCapacity ? `${palworldBaseCapacity.estimatedBases} / 240 bases used` : 'No base telemetry yet'}</span>
                      <span>{hasPalworldBaseTelemetry ? (palworldBaseCapacity?.remainingCapacity ?? 'N/A') : 'N/A'} slots left</span>
                      <span className="urgent">{palworldUrgentGuildRiskCount} urgent guild risks</span>
                    </div>
                  </article>

                  <article className="card command-panel-card player-activity-card">
                    <div className="command-panel-heading">
                      <h2>Player Activity</h2>
                    </div>
                    <div className="command-subsection-grid">
                      <section className="command-subsection command-subsection-online">
                        <h3>Online Now</h3>
                        <ul className="list review-list">
                          {nowOnlinePlayerProfiles.length === 0 ? <li className="empty-line">This world is quiet right now. Online players will appear here as soon as activity is collected.</li> : null}
                          {nowOnlinePlayerProfiles.map((profile) => (
                            <OnlinePlayerRow
                              key={`online:${profile.playerId}:${profile.lookupKey ?? 'profile'}`}
                              profile={profile}
                              onDetails={() => setSelectedPlayerProfile(profile)}
                            />
                          ))}
                        </ul>
                      </section>

                      <section className="command-subsection command-subsection-leaders">
                        <h3>7-Day Playtime Leaders</h3>
                        <ul className="list review-list">
                          {topPlayerProfiles.length === 0 ? <li className="empty-line">This world has not recorded enough session history for playtime leaders yet.</li> : null}
                          {topPlayerProfiles.map((profile, index) => (
                            <TopPlayerRow
                              key={`top:${profile.playerId}:${profile.lookupKey ?? 'profile'}`}
                              profile={profile}
                              rank={index + 1}
                              onDetails={() => setSelectedPlayerProfile(profile)}
                            />
                          ))}
                        </ul>
                      </section>

                      <section className="command-subsection command-subsection-save-rail">
                        <h3>Save Link Needed</h3>
                        <ul className="save-link-needed-list">
                          {saveLinkNeededPlayerProfiles.length === 0 ? <li className="empty-line">Save links look settled for the active players we can see.</li> : null}
                          {saveLinkNeededPlayerProfiles.map((profile) => (
                            <SaveLinkNeededRow key={`save-link:${profile.playerId}:${profile.lookupKey ?? 'profile'}`} profile={profile} />
                          ))}
                        </ul>
                      </section>
                    </div>
                  </article>

                  <section className="command-action-grid">
                    <article className="card command-panel-card">
                      <div className="command-panel-heading">
                        <h2>Guild Risk</h2>
                      </div>
                      <ul className="list review-list">
                        {palworldActionableGuildRisks.length === 0 ? (
                          <li className="empty-line guild-risk-empty">
                            <span>No guilds near palbox risk</span>
                            {unknownGuildActivityCount > 0 ? <span>{unknownGuildActivityCount} guilds still need activity mapping</span> : null}
                          </li>
                        ) : null}
                        {palworldActionableGuildRisks.map((guild) => (
                          <GuildRiskRow
                            key={guild.guildName}
                            guild={guild}
                            reviewed={reviewedGuildNames.has(guild.guildName)}
                            onOpen={() => setExpandedGuildActivityName(guild.guildName)}
                            onMarkReviewed={() => markGuildReviewedAndAdvance(guild.guildName)}
                          />
                        ))}
                      </ul>
                    </article>

                    <article className="card command-panel-card">
                      <div className="command-panel-heading">
                        <h2>Next Actions</h2>
                      </div>
                      <ul className="next-action-list">
                        {palworldNextActions.map((action) => (
                          <li key={action.label}>
                            <button
                              type="button"
                              onClick={() => setSelectedDashboardTab(action.targetTab)}
                            >
                              <span>{action.label}</span>
                              <small>{action.cta}</small>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </article>
                  </section>
                </section>
              ) : null}

              {selectedServer.game === 'valheim' ? (
                <>
                  <section className="card-grid command-card-grid">
                    <article className={`card summary-card signal-card server-health-card server-health-${serverHealthTone}`}>
                      <h2>Server Health</h2>
                      <div className="signal-main">
                        <div className="signal-value">{selectedServerSummary.state}</div>
                        <div className="signal-caption">{selectedWarningSummary[0]?.snippet ?? selectedServerSummary.operationalStatus.explanation}</div>
                      </div>
                      <div className="signal-metric-row">
                        <div className="signal-metric">
                          <span className="signal-metric-value">{selectedServerSummary.activePlayers}</span>
                          <span className="signal-metric-label">active</span>
                        </div>
                        <div className="signal-metric">
                          <span className="signal-metric-value">{selectedServerSummary.knownPlayerCount}</span>
                          <span className="signal-metric-label">known</span>
                        </div>
                      </div>
                      <div className="signal-inline-meta">{selectedServerSummary.reportedState}</div>
                    </article>

                    <article className="card summary-card signal-card">
                      <h2>Community Pulse</h2>
                      <div className="signal-main">
                        <div className="signal-value">{activeCommunityPulse.state}</div>
                        <div className="signal-caption">{activeCommunityPulse.summary}</div>
                      </div>
                      <div className="signal-inline-stats">
                        <span>{selectedServerSummary.activePlayers} active</span>
                        <span>{selectedServerSummary.knownPlayerCount} known</span>
                        <span>{selectedServerSummary.recentWarnings.length} warnings</span>
                      </div>
                    </article>
                  </section>

                  <section className="card-grid secondary-card-grid">
                    <article className="card valheim-world-highlights-card">
                      <h2>World Highlights</h2>
                      <ul className="list compact">
                        <li><span>Newest adventurer</span><span>{selectedServerSummary.playerIntelligenceSummary.mostRecentPlayer?.displayName ?? 'Not enough history yet'}</span></li>
                        <li><span>Longest active player</span><span>{selectedServerSummary.playerIntelligenceSummary.longestSessionPlayer?.displayName ?? 'Not enough sessions yet'}</span></li>
                        <li><span>Returning this week</span><span>{selectedServerSummary.playerIntelligenceSummary.returningPlayersThisWeek}</span></li>
                        <li><span>New this week</span><span>{selectedServerSummary.playerIntelligenceSummary.newPlayersThisWeek}</span></li>
                      </ul>
                    </article>

                    <article className="card">
                      <h2>Realm Regulars</h2>
                      <ul className="list review-list">
                        {valheimCorePlayers.length === 0 ? <li>This world has not recorded enough player history yet.</li> : null}
                        {valheimCorePlayers.map((player) => (
                          <li key={`${player.normalizedPlayerKey}:${player.lastSeenAt}`} className="review-row">
                            <div className="review-main">
                              <div className="review-header">
                                <span className="review-id">{player.displayName}</span>
                                <span className={`confidence-badge confidence-${player.confidence}`}>{player.confidence}</span>
                              </div>
                              <div className="subtle">observations {player.observationCount}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </article>

                    <article className="card summary-card signal-card">
                      <h2>Alerts Snapshot</h2>
                      <div className="signal-main">
                        <div className="signal-value">{selectedAlertCount > 0 ? 'Active' : 'Clear'}</div>
                        <div className="signal-caption">{selectedWarningSummary[0]?.snippet ?? 'No current alerts.'}</div>
                      </div>
                      <div className="signal-inline-stats">
                        <span>{selectedWarningSummary.length} warning groups</span>
                      </div>
                    </article>
                  </section>
                </>
              ) : null}

              <section className="card-grid">
                {selectedServer.game === 'valheim' ? (
                  <>
                    {selectedDashboardTab === 'overview' ? (
                      <PlayerEngagementPanel
                        engagement={selectedServerSummary.playerEngagement}
                        onSelectPlayer={setSelectedEngagementPlayerId}
                      />
                    ) : null}

                    {selectedDashboardTab === 'highlights' ? (
                      <article className="card">
                        <h2>Highlights</h2>
                        <ul className="list review-list">
                          {activeHighlights.map((item) => (
                            <li key={item} className="review-row"><div className="review-main">{item}</div></li>
                          ))}
                        </ul>
                      </article>
                    ) : null}

                    {selectedDashboardTab === 'players' ? (
                      <>
                        <PlayerEngagementPanel
                          engagement={selectedServerSummary.playerEngagement}
                          onSelectPlayer={setSelectedEngagementPlayerId}
                        />
                        <PlayerIntelligencePanel
                          players={selectedServerSummary.playerIntelligence}
                          explanation={selectedServerSummary.playerIntelligenceExplanation}
                          freshness={selectedServerSummary.dataFreshness}
                          selectedPlayerId={selectedPlayerIntelligenceId}
                          onSelectPlayer={setSelectedPlayerIntelligenceId}
                        />
                        <PlayerDetailPanel
                          detail={selectedPlayerDetail}
                          loading={selectedPlayerDetailLoading}
                          error={selectedPlayerDetailError}
                        />

                        <article className="card">
                          <h2>Known Player Details</h2>
                          <ul className="list">
                            {selectedServerSummary.knownPlayers.length === 0 ? <li>No named Valheim identity records yet.</li> : null}
                            {selectedServerSummary.knownPlayers.slice(0, 10).map((player) => (
                              <li
                                key={`${player.normalizedPlayerKey}:${player.lastSeenAt}`}
                                className={`clickable-row ${selectedValheimPlayerLookupKey === player.normalizedPlayerKey ? 'selected' : ''}`}
                                onClick={() => setSelectedValheimPlayerLookupKey(player.normalizedPlayerKey)}
                              >
                                <span>{player.displayName}</span>
                                <span className="known-meta">
                                  <span className={`confidence-badge confidence-${player.confidence}`}>{player.confidence}</span>
                                  <span className="subtle">obs {player.observationCount}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </article>

                        <article className="card">
                          <h2>Player Detail</h2>
                          {!selectedValheimPlayerProfile?.player ? <p className="subtle">Select a known player to inspect session and identity data.</p> : null}
                          {selectedValheimPlayerProfile?.player ? (
                            <>
                              <div className="detail-grid">
                                <div className="detail-block">
                                  <h3>Identity</h3>
                                  <ul className="list compact">
                                    <li><span>Name</span><span>{selectedValheimPlayerProfile.player.displayName}</span></li>
                                    <li><span>Confidence</span><span className={`confidence-badge confidence-${selectedValheimPlayerProfile.player.confidence}`}>{selectedValheimPlayerProfile.player.confidence}</span></li>
                                    <li><span>First Seen</span><span>{formatTimestamp(selectedValheimPlayerProfile.player.firstSeenAt)}</span></li>
                                    <li><span>Last Seen</span><span>{formatTimestamp(selectedValheimPlayerProfile.player.lastSeenAt)}</span></li>
                                  </ul>
                                </div>
                                <div className="detail-block">
                                  <h3>Adventures</h3>
                                  <ul className="list compact">
                                    <li><span>Status</span><span>{selectedValheimPlayerProfile.isOnline ? 'Online' : 'Offline'}</span></li>
                                    {selectedValheimPlayerProfile.recentSessions.slice(0, 4).map((session, index) => (
                                      <li key={`${session.startedAt}:${index}`}>
                                        <span>{formatTimestamp(session.startedAt)}</span>
                                        <span className="subtle">{formatDurationFromSeconds(session.durationSeconds ?? 0)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                              {selectedValheimCharacterMemoryDetail ? (
                                <WorldMemoryLivingTimeline
                                  items={buildMemoryTimeline(selectedValheimCharacterMemoryDetail)}
                                  emptyMessage="This story is just beginning."
                                />
                              ) : null}
                              {selectedValheimCharacterMemoryDetail ? (
                                <WorldMemoryRelationshipPanel
                                  detail={selectedValheimCharacterMemoryDetail}
                                  records={selectedWorldMemory.records}
                                  title="Related Memories"
                                  emptyMessage="No related memories have been recorded for this player yet."
                                />
                              ) : null}
                            </>
                          ) : null}
                          {!selectedValheimPlayerProfile?.player && selectedValheimCharacterMemoryDetail ? (
                            <>
                              <WorldMemoryLivingTimeline
                                items={buildMemoryTimeline(selectedValheimCharacterMemoryDetail)}
                                emptyMessage="This story is just beginning."
                              />
                              <WorldMemoryRelationshipPanel
                                detail={selectedValheimCharacterMemoryDetail}
                                records={selectedWorldMemory.records}
                                title="Related Memories"
                                emptyMessage="No related memories have been recorded for this player yet."
                              />
                            </>
                          ) : null}
                        </article>
                      </>
                    ) : null}

                    {selectedDashboardTab === 'characters' ? (
                      <>
                        <ValheimCharacterIntelligencePanel
                          characters={valheimCharacters}
                          onSelectCharacter={(character) => {
                            setSelectedPlayerIntelligenceId(character.id);
                            setSelectedValheimPlayerLookupKey(normalizePlayerKey(character.name));
                          }}
                        />

                        <article className="card">
                          <h2>Character Evidence</h2>
                          {!selectedValheimPlayerProfile?.player ? <p className="subtle">Select a character to inspect session and identity evidence for this realm.</p> : null}
                          {selectedValheimPlayerProfile?.player ? (
                            <>
                              <div className="detail-grid">
                                <div className="detail-block">
                                  <h3>Identity</h3>
                                  <ul className="list compact">
                                    <li><span>Name</span><span>{selectedValheimPlayerProfile.player.displayName}</span></li>
                                    <li><span>Confidence</span><span className={`confidence-badge confidence-${selectedValheimPlayerProfile.player.confidence}`}>{selectedValheimPlayerProfile.player.confidence}</span></li>
                                    <li><span>First Seen</span><span>{formatTimestamp(selectedValheimPlayerProfile.player.firstSeenAt)}</span></li>
                                    <li><span>Last Seen</span><span>{formatTimestamp(selectedValheimPlayerProfile.player.lastSeenAt)}</span></li>
                                    <li><span>Observations</span><span>{selectedValheimPlayerProfile.player.observationCount}</span></li>
                                  </ul>
                                </div>
                                <div className="detail-block">
                                  <h3>Recent Adventures</h3>
                                  <ul className="list compact">
                                    <li><span>Status</span><span>{selectedValheimPlayerProfile.isOnline ? 'Online' : 'Offline'}</span></li>
                                    {selectedValheimPlayerProfile.recentSessions.length === 0 ? <li><span>History</span><span>This character has not recorded enough session history yet.</span></li> : null}
                                    {selectedValheimPlayerProfile.recentSessions.slice(0, 5).map((session, index) => (
                                      <li key={`${session.startedAt}:${index}`}>
                                        <span>{formatTimestamp(session.startedAt)}</span>
                                        <span className="subtle">{formatDurationFromSeconds(session.durationSeconds ?? 0)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                              {selectedValheimCharacterMemoryDetail ? (
                                <WorldMemoryLivingTimeline
                                  items={buildMemoryTimeline(selectedValheimCharacterMemoryDetail)}
                                  emptyMessage="This story is just beginning."
                                />
                              ) : null}
                              {selectedValheimCharacterMemoryDetail ? (
                                <WorldMemoryRelationshipPanel
                                  detail={selectedValheimCharacterMemoryDetail}
                                  records={selectedWorldMemory.records}
                                  title="Related Memories"
                                  emptyMessage="No related memories have been recorded for this character yet."
                                />
                              ) : null}
                            </>
                          ) : null}
                          {!selectedValheimPlayerProfile?.player && selectedValheimCharacterMemoryDetail ? (
                            <>
                              <WorldMemoryLivingTimeline
                                items={buildMemoryTimeline(selectedValheimCharacterMemoryDetail)}
                                emptyMessage="This story is just beginning."
                              />
                              <WorldMemoryRelationshipPanel
                                detail={selectedValheimCharacterMemoryDetail}
                                records={selectedWorldMemory.records}
                                title="Related Memories"
                                emptyMessage="No related memories have been recorded for this character yet."
                              />
                            </>
                          ) : null}
                        </article>
                      </>
                    ) : null}

                    {selectedDashboardTab === 'activity' ? (
                      <>
                        <WorldChroniclePanel title="Realm Chronicle" events={valheimChronicleEvents} />

                        <article className="card valheim-world-highlights-card">
                          <h2>Recent World Highlights</h2>
                          <ul className="list review-list">
                            {activeHighlights.length === 0 ? <li>This realm is still writing its story.</li> : null}
                            {activeHighlights.map((item) => (
                              <li key={item} className="review-row"><div className="review-main">{item}</div></li>
                            ))}
                          </ul>
                        </article>

                        <SessionTimelinePanel timeline={selectedServerSummary.sessionTimeline} freshness={selectedServerSummary.dataFreshness} />
                        <ActivityLogPanel items={selectedServerSummary.activityLog} />

                        <article className="card">
                          <h2>Active Players</h2>
                          <ul className="list">
                            {selectedServerSummary.activePlayers === 0 ? <li>This world is quiet right now. Active players will appear here when join activity is collected.</li> : null}
                            {selectedServerSummary.recentEvents
                              .filter((event) => event.eventType === 'PLAYER_JOIN')
                              .slice(0, 8)
                              .map((event, index) => (
                                <li key={`${event.playerName ?? 'unknown'}:${index}`}>
                                  <button
                                    type="button"
                                    className="inline-player-link"
                                    onClick={() => {
                                      setSelectedValheimPlayerLookupKey(normalizePlayerKey(event.playerName ?? ''));
                                      setSelectedDashboardTab('players');
                                    }}
                                  >
                                    {event.playerName ?? 'Unknown player'}
                                  </button>
                                  <span className="subtle">{formatClock(event.occurredAt)}</span>
                                </li>
                              ))}
                          </ul>
                        </article>
                      </>
                    ) : null}

                    {selectedDashboardTab === 'metrics' ? (
                      <article className="card">
                        <h2>Metrics</h2>
                        <p className="subtle">Valheim metrics surface is still lightweight. Use fleet state, activity, and player detail while richer metrics are added.</p>
                      </article>
                    ) : null}

                    {selectedDashboardTab === 'ops' ? (
                      <>
                        <SettingsCapabilityPanel
                          capabilities={selectedServerSummary.settingsCapabilities}
                          onOpenObservedSettings={() => setObservedSettingsOpen(true)}
                        />
                        {selectedServerSummary.palworldRuntimeAudit ? (
                          <PalworldRuntimeAuditPanel audit={selectedServerSummary.palworldRuntimeAudit} />
                        ) : null}
                        {selectedServerSummary.palworldConfigAudit ? (
                          <PalworldConfigAuditPanel audit={selectedServerSummary.palworldConfigAudit} />
                        ) : null}
                        {selectedServerSummary.palworldBackupReadiness ? (
                          <PalworldBackupReadinessPanel readiness={selectedServerSummary.palworldBackupReadiness} />
                        ) : null}
                        <EventTemplateDraftPanel
                          catalog={selectedServerSummary.eventTemplateDrafts}
                          onEditDraft={setSelectedEventTemplateDraft}
                        />
                        <article className="card">
                          <h2>Ops</h2>
                          <p className="subtle">Ops workflows for Valheim remain unchanged. This tab is reserved for future command-center actions.</p>
                        </article>
                      </>
                    ) : null}

                    {selectedDashboardTab === 'diagnostics' ? (
                      <>
                        <article className="card">
                          <h2>Server Summary</h2>
                          <ul className="list compact">
                            <li><span>Server</span><span>{selectedServerSummary.displayName}</span></li>
                            <li><span>Game</span><span>{selectedServerSummary.game}</span></li>
                            <li><span>Status</span><span className={`state-pill state-${selectedServerSummary.state}`}>{selectedServerSummary.state}</span></li>
                            <li><span>Reported</span><span className="subtle">{selectedServerSummary.reportedState}</span></li>
                            <li><span>Active Players</span><span>{selectedServerSummary.activePlayers}</span></li>
                            <li><span>Known Players</span><span>{selectedServerSummary.knownPlayerCount}</span></li>
                          </ul>
                        </article>

                        <article className="card">
                          <h2>Recent Warnings</h2>
                          <ul className="list">
                            {selectedWarningSummary.length === 0 ? <li>No health warnings reported yet.</li> : null}
                            {selectedWarningSummary.map((warning, index) => (
                              <li key={`${warning.signature}:${index}`}>
                                <span className="warning-main">
                                  <span className={`warning-badge warning-${warning.category}`}>{formatWarningCategoryLabel(warning.category)}</span>
                                  {warning.snippet}
                                </span>
                                <span className="subtle">{formatClock(warning.latestAt)}</span>
                              </li>
                            ))}
                          </ul>
                        </article>
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    {selectedDashboardTab === 'highlights' ? (
                      <>
                        <WorldChroniclePanel
                          title="Archipelago Chronicle"
                          events={palworldChronicleEvents}
                          emptyMessage="The archipelago has not recorded enough guild history yet. More memories will appear as players explore."
                        />

                        <article className="card palworld-world-highlights-card">
                          <h2>World Highlights</h2>
                          <ul className="list review-list">
                            {activeHighlights.length === 0 ? <li>This archipelago is still building its history.</li> : null}
                            {activeHighlights.map((item) => (
                              <li key={item} className="review-row"><div className="review-main">{item}</div></li>
                            ))}
                          </ul>
                        </article>

                        <article className="card">
                          <h2>Current Milestone Feed</h2>
                          <ul className="list review-list">
                            {palworldMilestoneFeed.length === 0 ? <li>No milestone signals yet. Player progression appears after telemetry is reported.</li> : null}
                            {palworldMilestoneFeed.map((entry) => (
                              <li key={`${entry.playerId}:${entry.signalKey}`} className="review-row">
                                <div className="review-main">
                                  <div className="review-header">
                                    <span className="review-id">{entry.playerName ?? entry.accountName ?? entry.playerId}</span>
                                    <span className={`milestone-badge milestone-${entry.signalStrength}`}>{entry.signalStrength}</span>
                                  </div>
                                  <div><strong>{entry.signalLabel}</strong></div>
                                  <div className="subtle">{entry.signalReason}</div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </article>
                      </>
                    ) : null}

                    {selectedDashboardTab === 'players' ? (
                      <>
                        <PlayerEngagementPanel
                          engagement={selectedServerSummary.playerEngagement}
                          onSelectPlayer={setSelectedEngagementPlayerId}
                        />
                        <PlayerIntelligencePanel
                          players={selectedServerSummary.playerIntelligence}
                          explanation={selectedServerSummary.playerIntelligenceExplanation}
                          freshness={selectedServerSummary.dataFreshness}
                          selectedPlayerId={selectedPlayerIntelligenceId}
                          onSelectPlayer={setSelectedPlayerIntelligenceId}
                        />
                        <PlayerDetailPanel
                          detail={selectedPlayerDetail}
                          loading={selectedPlayerDetailLoading}
                          error={selectedPlayerDetailError}
                        />

                        <article className="card">
                          <h2>Palworld Telemetry</h2>
                          {palworldPlayerProfilesLoading ? <p className="subtle">Refreshing player intelligence...</p> : null}
                          <ul className="list telemetry-list">
                            {palworldLatestPlayers.length === 0 ? <li>This Palworld server has not recorded player activity for this view yet.</li> : null}
                            {palworldPlayerList.map(({ player, identityState }) => (
                              <li
                                key={`${player.lookupKey}:${player.lastSeenAt}`}
                                className={`clickable-row telemetry-row ${selectedPalworldPlayerKey === player.lookupKey ? 'selected' : ''}`}
                                onClick={() => setSelectedPalworldPlayerKey(player.lookupKey)}
                              >
                                <div className="telemetry-main">
                                  <div className="telemetry-heading">
                                    <span className="telemetry-player-name">{player.playerName ?? player.accountName ?? player.lookupKey}</span>
                                    <div className="telemetry-badges">
                                      <span className={`identity-badge identity-${identityState}`}>{identityState}</span>
                                      <span className={`state-pill state-${player.isOnline ? 'online' : 'offline'}`}>{player.isOnline ? 'online' : 'offline'}</span>
                                    </div>
                                  </div>
                                  <div className="telemetry-stats">
                                    <span>lvl {player.level ?? 'N/A'}</span>
                                    <span>{player.region ?? 'unknown region'}</span>
                                    <span>ping {formatMetric(player.ping)}</span>
                                    <span>session {formatDurationMaybe(player.currentSessionDurationSeconds)}</span>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </article>

                        <article className="card">
                          <h2>Player Profile / History</h2>
                          {!selectedPalworldPlayerProfile && !palworldPlayerDetailLoading ? <p className="subtle">Select a Palworld player to inspect live/save identity evidence and recent snapshots.</p> : null}
                          {palworldPlayerDetailLoading ? <p className="subtle">Loading selected player telemetry...</p> : null}
                          {selectedPalworldPlayerProfile ? (
                            <div className="detail-grid">
                              <div className="detail-block">
                                <h3>Unified Profile</h3>
                                <ul className="list compact">
                                  <li><span>Name</span><span>{selectedPalworldPlayerProfile.playerName ?? 'Unknown'}</span></li>
                                  <li><span>Account</span><span>{selectedPalworldPlayerProfile.accountName ?? 'Unknown'}</span></li>
                                  <li><span>Player ID</span><span>{selectedPalworldPlayerProfile.playerId}</span></li>
                                  <li><span>User ID</span><span>{selectedPalworldPlayerProfile.userId ?? 'N/A'}</span></li>
                                  <li><span>Level</span><span>{selectedPalworldPlayerProfile.level ?? 'N/A'}</span></li>
                                  <li><span>Region</span><span>{selectedPalworldPlayerProfile.region ?? 'Unknown'}</span></li>
                                  <li><span>Ping</span><span>{formatMetric(selectedPalworldPlayerProfile.ping ?? undefined)}</span></li>
                                  <li><span>Session</span><span>{formatDurationMaybe(selectedPalworldPlayerProfile.currentSessionDurationSeconds ?? undefined)}</span></li>
                                  <li><span>Session Tier</span><span>{selectedPalworldPlayerProfile.sessionTier ?? 'N/A'}</span></li>
                                  <li><span>Status</span><span>{selectedPalworldPlayerProfile.isOnline ? 'Online' : 'Offline'}</span></li>
                                  <li><span>Level Tier</span><span>{selectedPalworldPlayerProfile.levelTier ?? 'N/A'}</span></li>
                                  <li><span>Identity</span><span className={`confidence-badge confidence-${selectedPalworldPlayerProfile.identityState === 'approved' ? 'high' : selectedPalworldPlayerProfile.identityState === 'rejected' ? 'low' : 'medium'}`}>{selectedPalworldPlayerProfile.identityState}</span></li>
                                  <li><span>Reviewed By</span><span>{selectedPalworldPlayerProfile.review.reviewedBy ?? 'N/A'}</span></li>
                                  <li><span>Reviewed At</span><span>{selectedPalworldPlayerProfile.review.reviewedAt ? formatTimestamp(selectedPalworldPlayerProfile.review.reviewedAt) : 'N/A'}</span></li>
                                  <li><span>Save File</span><span>{selectedPalworldPlayerProfile.saveArtifact.present ? (selectedPalworldPlayerProfile.saveArtifact.savePlayerFileName ?? 'present') : 'Not found'}</span></li>
                                  <li><span>Save Parse</span><span>{selectedPalworldPlayerProfile.saveArtifact.parseStatus ?? 'N/A'}</span></li>
                                </ul>
                                <div className="milestone-block">
                                  <h4>Player Signals</h4>
                                  <ul className="list compact">
                                    <li><span>Likely Guild</span><span>{selectedPalworldPlayerProfile.playerIntelligence.likelyGuildName ?? 'N/A'}</span></li>
                                    <li><span>Guild Member Count</span><span>{selectedPalworldPlayerProfile.playerIntelligence.guildMemberCount ?? 'N/A'}</span></li>
                                    <li><span>Identity State</span><span>{selectedPalworldPlayerProfile.playerIntelligence.identityState}</span></li>
                                    <li><span>Level Tier</span><span>{selectedPalworldPlayerProfile.playerIntelligence.levelTier ?? 'N/A'}</span></li>
                                    <li><span>Session Tier</span><span>{selectedPalworldPlayerProfile.playerIntelligence.sessionTier ?? 'N/A'}</span></li>
                                    <li><span>Tracked activity</span><span>{selectedPalworldPlayerProfile.playerIntelligence.engagementScore}</span></li>
                                    <li><span>Classification</span><span>{selectedPalworldPlayerProfile.playerIntelligence.classification}</span></li>
                                    <li><span>Impact Level</span><span>{selectedPalworldPlayerProfile.playerIntelligence.impactLevel}</span></li>
                                  </ul>
                                </div>
                              </div>
                              <div className="detail-block">
                                <h3>History</h3>
                                <ul className="list compact">
                                  {selectedPalworldHistory.length === 0 ? <li>This player does not have enough snapshot history yet.</li> : null}
                                  {selectedPalworldHistory.map((snapshot) => (
                                    <li key={`${snapshot.lookupKey}:${snapshot.observedAt}`}>
                                      <div className="history-entry">
                                        <span>{formatTimestamp(snapshot.observedAt)}</span>
                                        <span className="subtle">lvl {snapshot.level ?? 'N/A'} • {snapshot.region ?? 'unknown region'} • ping {formatMetric(snapshot.ping)}</span>
                                        <span className="subtle">x {formatCoordinate(snapshot.locationX)} • y {formatCoordinate(snapshot.locationY)}</span>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      </>
                    ) : null}

                    {selectedDashboardTab === 'review-saves' ? (
                      <article className="card review-saves-card">
                        <div className="command-panel-heading">
                          <div>
                            <h2>Review Saves</h2>
                            <p className="subtle">Active 7-day players without linked saves.</p>
                          </div>
                          <span className="state-pill state-warning">{reviewSavePlayerProfiles.length} needed</span>
                        </div>
                        <ul className="list review-list review-saves-list">
                          {reviewSavePlayerProfiles.length === 0 ? <li className="empty-line">No active players need save links.</li> : null}
                          {reviewSavePlayerProfiles.map((profile) => (
                            <li key={`review-save:${profile.playerId}:${profile.lookupKey ?? 'profile'}`} className="review-save-item">
                              <button
                                type="button"
                                className="review-save-row"
                                onClick={() => setSelectedPlayerProfile(profile)}
                              >
                                <span className="review-save-main">
                                  <span className="homepage-player-name">{getProfileDisplayName(profile)}</span>
                                  <span className="homepage-player-meta">
                                    {profile.profile.level !== null ? <span>lvl {profile.profile.level}</span> : null}
                                    {profile.inferredGuildName ? <span>{profile.inferredGuildName}</span> : null}
                                    <span>{formatDurationFromSeconds(profile.trackedSeconds7d)} 7d playtime</span>
                                    <span>{profile.profile.lastSeenAt ? formatTimestamp(profile.profile.lastSeenAt) : 'last seen N/A'}</span>
                                  </span>
                                </span>
                                <span className="homepage-player-detail-button" aria-hidden="true">Details</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ) : null}

                    {selectedDashboardTab === 'guilds' ? (
                      <>
                        <PalworldGuildIntelligencePanel
                          guilds={palworldGuildIntelligence}
                          selectedGuildName={expandedGuildActivityName}
                          reviewedGuildNames={reviewedGuildNames}
                          onOpenGuild={setExpandedGuildActivityName}
                        />

                        <PalworldBaseLifecyclePanel
                          guilds={palworldGuildIntelligence}
                          hasBaseTelemetry={hasPalworldBaseTelemetry}
                          baseCapacity={palworldBaseCapacity}
                          baseTrend={palworldBaseSignalTrend}
                        />

                        <WorldChroniclePanel
                          title="Guild Chronicle"
                          events={palworldChronicleEvents}
                          emptyMessage="Guild tracking will appear as trusted Palworld activity is collected."
                        />

                        <article className="card guild-activity-card">
                          <div className="command-panel-heading">
                            <div>
                              <h2>Guild Review</h2>
                              <p className="subtle">Filter guilds by lifecycle and confidence while preserving the Palworld server scope.</p>
                            </div>
                            <div className="guild-activity-heading-actions">
                              {reviewedGuildNames.size > 0 ? (
                                <button type="button" onClick={() => setReviewedGuildNames(new Set())}>
                                  Clear Reviewed
                                </button>
                              ) : null}
                              <span className="state-pill state-warning">{guildActivity.length} guilds</span>
                            </div>
                          </div>
                          {palworldGuildsError ? <p className="error">{palworldGuildsError}</p> : null}
                          {!palworldGuildsError ? (
                            <div className="detail-block">
                              <ul className="list compact">
                                <li><span>Total Guild Hints</span><span>{palworldGuildSummary.totalGuildHints}</span></li>
                                <li><span>Likely Real Guilds</span><span>{palworldGuildSummary.likelyRealGuilds}</span></li>
                                <li><span>Guilds active today</span><span>{guildActivity.filter((guild) => guild.daysInactive === 0).length}</span></li>
                                <li><span>Reviewed</span><span>{guildActivityProgress.reviewedCount} / {guildActivityProgress.totalCount}</span></li>
                              </ul>
                            </div>
                          ) : null}
                          <div className="guild-activity-filter-row" aria-label="Guild activity filters">
                            <button
                              type="button"
                              className={guildFocusMode ? 'selected' : ''}
                              onClick={() => setGuildFocusMode((current) => !current)}
                            >
                              <span>Focus Mode</span>
                            </button>
                            {guildActivityFilterOptions.options.map((filter) => (
                              <button
                                key={filter.value}
                                type="button"
                                className={guildActivityFilter === filter.value ? 'selected' : ''}
                                onClick={() => setGuildActivityFilter(filter.value)}
                              >
                                <span>{filter.label}</span>
                                <small>{filter.count}</small>
                              </button>
                            ))}
                          </div>
                          <ul className="list review-list guild-activity-list">
                            {!palworldGuildsError && visibleGuildActivity.length === 0 ? <li className="empty-line">Guild activity will appear as players establish themselves.</li> : null}
                            {visibleGuildActivity.map((guild) => (
                              <GuildRiskRow
                                key={`all-guild:${guild.guildName}`}
                                guild={guild}
                                reviewed={reviewedGuildNames.has(guild.guildName)}
                                onOpen={() => setExpandedGuildActivityName(guild.guildName)}
                                onMarkReviewed={() => markGuildReviewedAndAdvance(guild.guildName)}
                              />
                            ))}
                          </ul>
                        </article>
                      </>
                    ) : null}

                    {selectedDashboardTab === 'activity' ? (
                      <>
                        <SessionTimelinePanel timeline={selectedServerSummary.sessionTimeline} freshness={selectedServerSummary.dataFreshness} />
                        <ActivityLogPanel items={selectedServerSummary.activityLog} />
                      </>
                    ) : null}

                    {selectedDashboardTab === 'metrics' ? (
                      <>
                        <article className="card">
                          <h2>Base Capacity</h2>
                          {hasPalworldBaseTelemetry ? (
                            <>
                              <div><strong>Raw Signal:</strong> {palworldBaseSignal}</div>
                              <div><strong>Estimated Bases:</strong> {palworldBaseCapacity.estimatedBases} / 240</div>
                              <div><strong>Usage:</strong> {palworldBaseCapacity.usagePercent}%</div>
                              <div><strong>Remaining Capacity:</strong> {palworldBaseCapacity.remainingCapacity}</div>
                              <div className="subtle"><strong>Status:</strong> {palworldBaseCapacity.statusLabel}</div>
                              <div className="subtle">{palworldBaseCapacity.summary}</div>
                              <div className="subtle"><strong>Last 5 Values:</strong> {palworldBaseSignalTrend.recentValues.length > 0 ? palworldBaseSignalTrend.recentValues.join(', ') : 'No history'}</div>
                              <div className="subtle"><strong>Trend:</strong> {palworldBaseSignalTrend.indicator} {palworldBaseSignalTrend.direction}</div>
                            </>
                          ) : <p className="subtle">No base capacity telemetry yet. Start the Palworld save parser to estimate base usage.</p>}
                        </article>

                        <article className="card">
                          <h2>Recent Metrics</h2>
                          <ul className="list">
                            {palworldMetrics.length === 0 ? <li>Connector has not reported metrics yet.</li> : null}
                            {palworldMetrics.map((metric) => (
                              <li key={metric.observedAt}>
                                <span>{formatTimestamp(metric.observedAt)}</span>
                                <span className="subtle">fps {metric.serverFps ?? 'N/A'} • players {metric.currentPlayerCount ?? 'N/A'} • uptime {metric.currentUptimeHours ?? 'N/A'}h</span>
                              </li>
                            ))}
                          </ul>
                        </article>
                      </>
                    ) : null}

                    {selectedDashboardTab === 'ops' ? (
                      <>
                        <SettingsCapabilityPanel
                          capabilities={selectedServerSummary.settingsCapabilities}
                          onOpenObservedSettings={() => setObservedSettingsOpen(true)}
                        />
                        {selectedServerSummary.palworldRuntimeAudit ? (
                          <PalworldRuntimeAuditPanel audit={selectedServerSummary.palworldRuntimeAudit} />
                        ) : null}
                        {selectedServerSummary.palworldConfigAudit ? (
                          <PalworldConfigAuditPanel audit={selectedServerSummary.palworldConfigAudit} />
                        ) : null}
                        {selectedServerSummary.palworldBackupReadiness ? (
                          <PalworldBackupReadinessPanel readiness={selectedServerSummary.palworldBackupReadiness} />
                        ) : null}
                        <EventTemplateDraftPanel
                          catalog={selectedServerSummary.eventTemplateDrafts}
                          onEditDraft={setSelectedEventTemplateDraft}
                        />
                        <article className="card">
                          <h2>Identity Review Candidates</h2>
                          {palworldIdentityLoading ? <p className="subtle">Loading identity link candidates...</p> : null}
                          {palworldIdentityError ? <p className="error">{palworldIdentityError}</p> : null}
                          <div className="review-actions-form">
                            <label className="review-field">
                              <span>Reviewed By</span>
                              <input type="text" value={palworldReviewActor} onChange={(event) => setPalworldReviewActor(event.target.value)} placeholder="your name" />
                            </label>
                            <label className="review-field">
                              <span>Notes</span>
                              <input type="text" value={palworldReviewNotes} onChange={(event) => setPalworldReviewNotes(event.target.value)} placeholder="optional review note" />
                            </label>
                          </div>
                          {palworldReviewActionError ? <p className="error">{palworldReviewActionError}</p> : null}
                          <ul className="list review-list">
                            {!palworldIdentityLoading && palworldIdentityCandidates.length === 0 ? <li>No candidate links found.</li> : null}
                            {palworldIdentityCandidates.map((candidate) => (
                              <li key={`${candidate.savePlayerFileName}:${candidate.telemetryLookupKey ?? 'none'}`} className="review-row">
                                <div className="review-main">
                                  <div className="review-header">
                                    <span className="review-id">{candidate.savePlayerSaveId}</span>
                                    <span className={`confidence-badge confidence-${candidate.confidence}`}>{candidate.confidence}</span>
                                  </div>
                                  <div className="subtle">save file {candidate.savePlayerFileName}</div>
                                  <div><strong>live:</strong> {candidate.candidate.playerName ?? candidate.candidate.accountName ?? candidate.telemetryLookupKey ?? 'unknown'}</div>
                                  <div className="subtle">score {candidate.score} • matched {candidate.matchedOn.join(', ') || 'none'}</div>
                                  <div className="subtle">{candidate.notes.join(' • ') || 'no additional notes'}</div>
                                  <div className="review-button-row">
                                    <button type="button" className="review-button approve-button" onClick={() => void submitPalworldReviewAction('approve', candidate.savePlayerSaveId)} disabled={palworldReviewSubmittingKey !== null}>
                                      {palworldReviewSubmittingKey === `approve:${candidate.savePlayerSaveId}` ? 'Approving...' : 'Approve'}
                                    </button>
                                    <button type="button" className="review-button reject-button" onClick={() => void submitPalworldReviewAction('reject', candidate.savePlayerSaveId)} disabled={palworldReviewSubmittingKey !== null}>
                                      {palworldReviewSubmittingKey === `reject:${candidate.savePlayerSaveId}` ? 'Rejecting...' : 'Reject'}
                                    </button>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </article>

                        <article className="card">
                          <h2>Manual Identity Link</h2>
                          {!selectedPalworldPlayerProfile ? <p className="subtle">Select a player in the Players tab to create a manual identity link.</p> : null}
                          {selectedPalworldPlayerProfile ? (
                            <>
                              <div className="review-actions-form">
                                <label className="review-field">
                                  <span>Save Player ID</span>
                                  <input type="text" value={palworldManualSavePlayerSaveId} onChange={(event) => setPalworldManualSavePlayerSaveId(event.target.value)} placeholder="save player id" />
                                </label>
                                <label className="review-field">
                                  <span>Save File Name</span>
                                  <input type="text" value={palworldManualSavePlayerFileName} onChange={(event) => setPalworldManualSavePlayerFileName(event.target.value)} placeholder="optional .sav file name" />
                                </label>
                              </div>
                              <div className="manual-link-summary">
                                <div className="subtle">telemetry target {selectedPalworldPlayerProfile.playerName ?? selectedPalworldPlayerProfile.accountName ?? selectedPalworldPlayerProfile.playerId}</div>
                                <div className="subtle">playerId {selectedPalworldPlayerProfile.playerId} • userId {selectedPalworldPlayerProfile.userId ?? 'N/A'} • lookup {selectedPalworldPlayerProfile.lookupKey ?? 'N/A'}</div>
                              </div>
                              {palworldManualLinkError ? <p className="error">{palworldManualLinkError}</p> : null}
                              {palworldManualLinkSuccess ? <p className="success-message">{palworldManualLinkSuccess}</p> : null}
                              <div className="review-button-row">
                                <button type="button" className="review-button approve-button" onClick={() => void submitPalworldManualLink()} disabled={palworldReviewSubmittingKey !== null}>
                                  {palworldReviewSubmittingKey?.startsWith('manual:') ? 'Linking...' : 'Manual Link'}
                                </button>
                              </div>
                            </>
                          ) : null}
                        </article>
                      </>
                    ) : null}

                    {selectedDashboardTab === 'diagnostics' ? (
                      <>
                        <article className="card">
                          <h2>Recent Transition Events</h2>
                          <ul className="list review-list">
                            {palworldTransitionEvents.length === 0 ? <li>No recent transition events.</li> : null}
                            {palworldTransitionEvents.map((event) => (
                              <li key={getTransitionEventKey(event)} className="review-row">
                                <div className="review-main">
                                  <div className="review-header">
                                    <span className="review-id">{event.playerName ?? event.accountName ?? event.playerId}</span>
                                    <span className={`confidence-badge confidence-${event.identityState === 'approved' ? 'high' : event.identityState === 'rejected' ? 'low' : 'medium'}`}>{event.identityState}</span>
                                  </div>
                                  <div><strong>{event.eventType}</strong></div>
                                  <div>{event.previewMessage}</div>
                                  <div className="subtle">{event.fromValue ?? 'N/A'} → {event.toValue ?? 'N/A'}</div>
                                  <div className="subtle">{formatTimestamp(event.occurredAt)}</div>
                                  <div className="review-button-row">
                                    <button type="button" className="review-button approve-button" onClick={() => void postPalworldTransitionEvent(event)} disabled={palworldTransitionPostSubmittingKey !== null}>
                                      {palworldTransitionPostSubmittingKey === getTransitionEventKey(event) ? 'Posting...' : 'Post to #palworld-activity'}
                                    </button>
                                  </div>
                                  {palworldTransitionPostSuccessKey === getTransitionEventKey(event) ? <p className="success-message">Posted to the configured Palworld activity channel.</p> : null}
                                  {palworldTransitionPostErrorKey === getTransitionEventKey(event) && palworldTransitionPostError ? <p className="error">{palworldTransitionPostError}</p> : null}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </article>

                        <article className="card">
                          <h2>Identity Review Failures</h2>
                          <ul className="list review-list">
                            {!palworldIdentityLoading && palworldIdentityFailures.length === 0 ? <li>No unmatched save players recorded.</li> : null}
                            {palworldIdentityFailures.map((failure) => (
                              <li key={`${failure.savePlayerFileName}:${failure.status}`} className="review-row">
                                <div className="review-main">
                                  <div className="review-header">
                                    <span className="review-id">{failure.savePlayerSaveId}</span>
                                    <span className="warning-badge warning-general">{failure.status}</span>
                                  </div>
                                  <div className="subtle">save file {failure.savePlayerFileName}</div>
                                  <div className="subtle">{failure.message}</div>
                                  <div className="review-button-row">
                                    <button type="button" className="review-button reject-button" onClick={() => void submitPalworldReviewAction('reject', failure.savePlayerSaveId)} disabled={palworldReviewSubmittingKey !== null}>
                                      {palworldReviewSubmittingKey === `reject:${failure.savePlayerSaveId}` ? 'Rejecting...' : 'Reject'}
                                    </button>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </article>
                      </>
                    ) : null}
                  </>
                )}
              </section>
            </section>
          </>
        )}
      </section>
      ) : null}
      {selectedPlayerProfile ? (
        <PlayerDetailDrawer
          profile={selectedPlayerProfile}
          onClose={() => setSelectedPlayerProfile(null)}
          savePlayerSaveId={drawerSavePlayerSaveId}
          savePlayerFileName={drawerSavePlayerFileName}
          notes={drawerLinkNotes}
          error={drawerLinkError}
          success={drawerLinkSuccess}
          submitting={drawerLinkSubmitting}
          onSavePlayerSaveIdChange={setDrawerSavePlayerSaveId}
          onSavePlayerFileNameChange={setDrawerSavePlayerFileName}
          onNotesChange={setDrawerLinkNotes}
          onSubmit={() => void submitDrawerManualLink(selectedPlayerProfile)}
        />
      ) : null}
      {selectedPalworldGuild ? (
        <PalworldGuildDrawer
          guild={selectedPalworldGuild}
          reviewed={reviewedGuildNames.has(selectedPalworldGuild.guildName)}
          memoryDetail={selectedPalworldGuildMemoryDetail}
          records={selectedWorldMemory.records}
          onClose={() => setExpandedGuildActivityName(null)}
          onMarkReviewed={() => markGuildReviewedAndAdvance(selectedPalworldGuild.guildName)}
        />
      ) : null}
      {selectedMemoryDetail ? (
        <WorldMemoryDetailDrawer
          detail={selectedMemoryDetail}
          records={selectedWorldMemory.records}
          onClose={() => setSelectedMemoryDetail(null)}
        />
      ) : null}
      {selectedWorldEventDetail ? (
        <WorldEventDetailDrawer
          event={selectedWorldEventDetail}
          onClose={() => setSelectedWorldEventDetail(null)}
        />
      ) : null}
      {selectedEngagementDetail ? (
        <PlayerEngagementDetailDrawer
          detail={selectedEngagementDetail}
          loading={selectedEngagementDetailLoading}
          error={selectedEngagementDetailError}
          onClose={() => {
            setSelectedEngagementPlayerId(null);
            setSelectedEngagementDetail(null);
            setSelectedEngagementDetailError(null);
          }}
        />
      ) : null}
      {observedSettingsOpen ? (
        <ObservedSettingsDrawer
          observedSettings={observedSettings}
          loading={observedSettingsLoading}
          error={observedSettingsError}
          onClose={() => {
            setObservedSettingsOpen(false);
            setObservedSettings(null);
            setObservedSettingsError(null);
          }}
        />
      ) : null}
      {selectedEventTemplateDraft ? (
        <EventTemplateDraftEditDrawer
          draft={selectedEventTemplateDraft}
          displayName={eventDraftDisplayName}
          targetMultiplier={eventDraftTargetMultiplier}
          targetValue={eventDraftTargetValue}
          durationHours={eventDraftDurationHours}
          notes={eventDraftNotes}
          scheduleLabel={eventDraftScheduleLabel}
          enabledInDashboard={eventDraftEnabled}
          saving={eventDraftSaving}
          error={eventDraftError}
          success={eventDraftSuccess}
          configDiffPreview={eventDraftConfigDiffPreview}
          configDiffLoading={eventDraftConfigDiffLoading}
          configDiffError={eventDraftConfigDiffError}
          manualChecklist={eventDraftManualChecklist}
          manualChecklistLoading={eventDraftManualChecklistLoading}
          manualChecklistError={eventDraftManualChecklistError}
          manualEditPlan={eventDraftManualEditPlan}
          manualEditPlanLoading={eventDraftManualEditPlanLoading}
          manualEditPlanError={eventDraftManualEditPlanError}
          onDisplayNameChange={setEventDraftDisplayName}
          onTargetMultiplierChange={setEventDraftTargetMultiplier}
          onTargetValueChange={setEventDraftTargetValue}
          onDurationHoursChange={setEventDraftDurationHours}
          onNotesChange={setEventDraftNotes}
          onScheduleLabelChange={setEventDraftScheduleLabel}
          onEnabledChange={setEventDraftEnabled}
          onSave={() => void saveSelectedEventTemplateDraft()}
          onClose={() => {
            setSelectedEventTemplateDraft(null);
            setEventDraftError(null);
            setEventDraftSuccess(null);
            setEventDraftConfigDiffPreview(null);
            setEventDraftConfigDiffError(null);
            setEventDraftManualChecklist(null);
            setEventDraftManualChecklistError(null);
          }}
        />
      ) : null}
    </main>
  );
}

function normalizePlayerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatClock(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const elapsedMs = Date.now() - date.getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));

  if (elapsedMinutes < 1) {
    return 'just now';
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 14) {
    return `${elapsedDays}d ago`;
  }

  return formatTimestamp(value);
}

function formatDurationFromSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getPlayerEngagementTrendLabel(detail: PlayerEngagementDetail): string {
  switch (detail.trendDirection) {
    case 'up':
      return 'Up this week';
    case 'down':
      return 'Down this week';
    case 'steady':
      return 'Steady';
    case 'unknown':
      return 'Unknown';
  }
}

function formatObservedSettingValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }

  if (typeof value === 'object') {
    return 'object';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'N/A';
  }

  if (typeof value === 'string') {
    return value;
  }

  return 'unknown';
}

function getObservedSettingRiskTone(risk: ObservedSettingsResponse['groups'][number]['settings'][number]['changeRisk']): string {
  switch (risk) {
    case 'safe_display':
      return 'high';
    case 'gameplay_balance':
    case 'likely_restart_required':
      return 'medium';
    case 'dangerous_access_related':
    case 'unknown':
      return 'low';
  }
}

function formatDurationMaybe(totalSeconds: number | undefined): string {
  if (totalSeconds === undefined || !Number.isFinite(totalSeconds)) {
    return 'N/A';
  }

  return formatDurationFromSeconds(totalSeconds);
}

function formatMetric(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  return value >= 100 ? `${Math.round(value)}` : `${value.toFixed(1)}`;
}

function formatCoordinate(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  return value.toFixed(1);
}

function summarizeWarnings(events: NormalizedEvent[]): WarningSummaryEntry[] {
  const summaries: WarningSummaryEntry[] = [];

  for (const event of events) {
    const rawMessage = event.message ?? 'Health warning';
    const category = categorizeWarning(rawMessage);
    const snippet = summarizeWarningMessage(rawMessage);
    const signature = normalizeWarningSignature(rawMessage);
    const occurredAtMs = Date.parse(event.occurredAt);
    const previous = summaries[summaries.length - 1];
    const previousMs = previous ? Date.parse(previous.latestAt) : Number.NaN;

    if (
      previous
      && previous.category === category
      && previous.signature === signature
      && Number.isFinite(occurredAtMs)
      && Number.isFinite(previousMs)
      && Math.abs(previousMs - occurredAtMs) <= WARNING_GROUP_WINDOW_MS
    ) {
      previous.count += 1;
      continue;
    }

    summaries.push({
      category,
      snippet,
      latestAt: event.occurredAt,
      count: 1,
      signature
    });
  }

  return summaries.slice(0, 6);
}

function categorizeWarning(message: string): WarningCategory {
  const text = message.toLowerCase();

  if (/(disconnect|connection lost|player connection lost|reconnect|zplayfabsocket::dispose)/.test(text)) {
    return 'disconnect';
  }

  if (/(save|storage|disk|file|serialize|write|backup)/.test(text)) {
    return 'save_storage';
  }

  if (/(network|socket|timeout|latency|packet|playfab)/.test(text)) {
    return 'network';
  }

  return 'general';
}

function summarizeWarningMessage(message: string): string {
  return message.trim().replace(/\s+/g, ' ').slice(0, 84);
}

function normalizeWarningSignature(message: string): string {
  return message
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatWarningCategoryLabel(category: WarningCategory): string {
  return category === 'save_storage' ? 'save' : category;
}

function isFreshTimestamp(value: string | undefined, windowMs: number): boolean {
  if (!value) {
    return false;
  }

  const timestampMs = Date.parse(value);

  if (!Number.isFinite(timestampMs)) {
    return false;
  }

  return (Date.now() - timestampMs) <= windowMs;
}

function deriveEffectiveServerState(input: {
  reportedState: ServerSummary['state'];
  game: ServerSummary['game'];
  activePlayers: number;
  recentEvents: NormalizedEvent[];
  recentWarnings: NormalizedEvent[];
  palworldLatestPlayers: PalworldLatestPlayerTelemetry[];
  palworldRecentMetrics: PalworldMetricsSummary[];
}): ServerSummary['state'] {
  const hasFreshEvent = input.recentEvents.some((event) => isFreshTimestamp(event.occurredAt, LIVE_SIGNAL_WINDOW_MS));
  const hasFreshPalworldMetric = input.palworldRecentMetrics.some((metric) => isFreshTimestamp(metric.observedAt, LIVE_SIGNAL_WINDOW_MS));
  const hasFreshPalworldPlayer = input.palworldLatestPlayers.some((player) => (
    player.isOnline || isFreshTimestamp(player.lastSeenAt, LIVE_SIGNAL_WINDOW_MS)
  ));
  const hasLiveSignal = input.activePlayers > 0 || hasFreshEvent || hasFreshPalworldMetric || hasFreshPalworldPlayer;

  if (hasLiveSignal) {
    return input.recentWarnings.length > 0 && input.reportedState === 'degraded' ? 'degraded' : 'online';
  }

  return input.reportedState;
}

export default App;
