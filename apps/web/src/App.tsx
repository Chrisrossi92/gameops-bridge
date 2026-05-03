import {
  activeSessionsResponseSchema,
  configuredServersResponseSchema,
  knownPlayerProfileResponseSchema,
  knownPlayersResponseSchema,
  palworldIdentityApprovalsResponseSchema,
  palworldIdentityLinksResponseSchema,
  palworldGuildActivityResponseSchema,
  palworldLatestPlayersResponseSchema,
  palworldMilestoneFeedResponseSchema,
  palworldMetricsSummariesResponseSchema,
  palworldPlayerSnapshotsResponseSchema,
  palworldPlayerProfileSessionSummariesResponseSchema,
  palworldTransitionMilestoneEventsResponseSchema,
  palworldUnifiedPlayerProfileSchema,
  recentEventsResponseSchema,
  serverStatusSchema,
  type ConfiguredServersResponse,
  type PalworldGuildActivityEntry,
  type PalworldGuildActivityMember,
  type KnownPlayerProfileResponse,
  type NormalizedEvent,
  type PalworldApprovedIdentity,
  type PalworldIdentityLinkCandidate,
  type PalworldIdentityLinkFailure,
  type PalworldLatestPlayerTelemetry,
  type PalworldManualTransitionPostResponse,
  type PalworldMilestoneFeedEntry,
  type PalworldMetricsSummary,
  type PalworldPlayerProfileSessionSummary,
  type PalworldPlayerSnapshot,
  type PalworldRejectedIdentity,
  type PalworldTransitionMilestoneEvent,
  type PalworldUnifiedPlayerProfile
} from '@gameops/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

interface HealthResponse {
  ok: boolean;
  service: string;
  timestamp: string;
}

interface KnownPlayerEntry {
  displayName: string;
  normalizedPlayerKey: string;
  confidence: string;
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
  activePlayers: number;
  knownPlayerCount: number;
  recentEvents: NormalizedEvent[];
  recentWarnings: NormalizedEvent[];
  knownPlayers: KnownPlayerEntry[];
  palworldLatestPlayers: PalworldLatestPlayerTelemetry[];
  palworldRecentMetrics: PalworldMetricsSummary[];
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

interface PalworldNextAction {
  label: string;
  destination?: string;
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

function PlayerProfileCard({ profile }: PlayerProfileCardProps) {
  return (
    <li className="review-row">
      <div className="review-main">
        <div className="review-header">
          <span className="review-id">{profile.playerName ?? profile.accountName ?? profile.playerId}</span>
          <span className={`state-pill state-${profile.isOnline ? 'online' : 'offline'}`}>
            {profile.isOnline ? 'online' : 'offline'}
          </span>
        </div>
        <div className="telemetry-stats">
          <span>session {formatDurationMaybe(profile.currentSessionDurationSeconds ?? undefined)}</span>
          <span>recent {formatDurationFromSeconds(profile.recentTrackedSeconds)}</span>
          <span>guild {profile.inferredGuildName ?? 'N/A'}</span>
          <span>{formatSaveLinkLabel(profile.saveArtifact.present)}</span>
          {profile.profile.level !== null ? <span>lvl {profile.profile.level}</span> : null}
        </div>
      </div>
    </li>
  );
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
  const recentSessions = profile.recentSessions.slice(0, 5);
  const playerDisplayName = getProfileDisplayName(profile);

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

        <dl className="player-drawer-grid">
          <dt>Level</dt>
          <dd>{profile.profile.level ?? 'N/A'}</dd>
          <dt>Save</dt>
          <dd>{formatSaveLinkLabel(profile.saveArtifact.present)}</dd>
          {profile.isOnline ? (
            <>
              <dt>Current session</dt>
              <dd>{formatDurationMaybe(profile.currentSessionDurationSeconds ?? undefined)}</dd>
            </>
          ) : null}
          <dt>Last session</dt>
          <dd>{formatDurationMaybe(lastSessionDurationSeconds)}</dd>
          <dt>Last ended</dt>
          <dd>{lastSessionEndedAt ? formatTimestamp(lastSessionEndedAt) : 'N/A'}</dd>
          <dt>24h playtime</dt>
          <dd>{formatDurationFromSeconds(profile.trackedSeconds24h)}</dd>
          <dt>7d playtime</dt>
          <dd>{formatDurationFromSeconds(profile.trackedSeconds7d)}</dd>
          <dt>30d playtime</dt>
          <dd>{formatDurationFromSeconds(profile.trackedSeconds30d)}</dd>
          <dt>Last seen</dt>
          <dd>{profile.profile.lastSeenAt ? formatTimestamp(profile.profile.lastSeenAt) : 'N/A'}</dd>
        </dl>

        <section className="player-drawer-actions">
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

        <section className="player-drawer-sessions">
          <h3>Recent Sessions</h3>
          <ul>
            {recentSessions.length === 0 ? <li className="empty-line">No recent sessions</li> : null}
            {recentSessions.map((session, index) => (
              <li key={`${session.startedAt}:${session.endedAt ?? 'open'}:${index}`}>
                <span>{formatDurationMaybe(session.durationSeconds)}</span>
                <span>{session.endedAt ? formatTimestamp(session.endedAt) : 'In progress'}</span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

interface GuildRiskRowProps {
  guild: PalworldGuildActivityEntry;
  expanded: boolean;
  reviewed: boolean;
  onToggle: () => void;
  onMarkReviewed: () => void;
}

function GuildRiskRow({ guild, expanded, reviewed, onToggle, onMarkReviewed }: GuildRiskRowProps) {
  const riskText = guild.daysInactive !== null
    ? `${guild.daysInactive}d inactive`
    : guild.daysUntilPalboxRisk !== null
      ? `${guild.daysUntilPalboxRisk}d to risk`
      : null;
  const riskLabel = guild.riskLevel === 'unknown' ? 'No activity data' : guild.riskLevel;
  const lastActivityLabel = guild.lastMemberSeenAt
    ? `Last activity: ${guild.lastSeenMemberName ?? 'Unknown member'}${guild.daysInactive !== null ? ` — ${guild.daysInactive}d ago` : ''}`
    : 'No matched activity';
  const palboxRiskLabel = guild.daysUntilPalboxRisk !== null ? `${guild.daysUntilPalboxRisk}d to palbox risk` : 'Activity unknown';

  return (
    <li className={`guild-activity-row ${expanded ? 'guild-activity-row-expanded' : ''}`}>
      <button type="button" className="guild-activity-toggle" onClick={onToggle}>
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
            <span>{lastActivityLabel}</span>
            <span>{palboxRiskLabel}</span>
            {riskText ? <span>{riskText}</span> : null}
          </div>
        </div>
        <span className="homepage-player-detail-button" aria-hidden="true">{expanded ? 'Hide' : 'Details'}</span>
      </button>
      {expanded ? (
        <GuildActivityDetail
          guildName={guild.guildName}
          members={guild.members}
          reviewed={reviewed}
          onMarkReviewed={onMarkReviewed}
        />
      ) : null}
    </li>
  );
}

interface GuildActivityDetailProps {
  guildName: string;
  members: PalworldGuildActivityMember[];
  reviewed: boolean;
  onMarkReviewed: () => void;
}

function GuildActivityDetail({ guildName, members, reviewed, onMarkReviewed }: GuildActivityDetailProps) {
  const sortedMembers = [...members].sort((left, right) => {
    if (Number(right.matched) !== Number(left.matched)) {
      return Number(right.matched) - Number(left.matched);
    }

    return (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? '');
  });
  const trackedMemberCount = sortedMembers.filter((member) => member.matched).length;

  return (
    <div className="guild-activity-detail">
      <div className="guild-activity-detail-meta">
        <span>Tracked members: {trackedMemberCount} / {sortedMembers.length}</span>
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
              {member.lastSeenAt ? <span>{formatTimestamp(member.lastSeenAt)}</span> : <span>last seen unknown</span>}
              {member.daysSinceSeen !== null ? <span>{member.daysSinceSeen}d ago</span> : null}
              {member.level !== null ? <span>lvl {member.level}</span> : null}
              {member.saveLinked !== null ? <span>{member.saveLinked ? 'Save linked' : 'Save link needed'}</span> : null}
              {member.matchedPlayerName && member.matchedPlayerName !== member.memberName ? <span>as {member.matchedPlayerName}</span> : null}
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

interface PalworldBaseSignalHistoryEntry {
  timestamp: string;
  baseSignal: number;
}

type DashboardTab = 'overview' | 'highlights' | 'players' | 'review-saves' | 'guilds' | 'activity' | 'metrics' | 'ops' | 'diagnostics';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
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

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [serverOptions, setServerOptions] = useState<ServerOption[]>([]);
  const [fleetByServerId, setFleetByServerId] = useState<Record<string, ServerSummary>>({});
  const [serverOptionsLoading, setServerOptionsLoading] = useState(true);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [serverOptionsError, setServerOptionsError] = useState<string | null>(null);
  const [fleetError, setFleetError] = useState<string | null>(null);
  const [selectedGameFilter, setSelectedGameFilter] = useState<GameFilter>('all');
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [selectedValheimPlayerLookupKey, setSelectedValheimPlayerLookupKey] = useState<string | null>(null);
  const [selectedValheimPlayerProfile, setSelectedValheimPlayerProfile] = useState<KnownPlayerProfileResponse | null>(null);
  const [selectedPalworldPlayerKey, setSelectedPalworldPlayerKey] = useState<string | null>(null);
  const [selectedPalworldPlayerProfile, setSelectedPalworldPlayerProfile] = useState<PalworldUnifiedPlayerProfile | null>(null);
  const [selectedPalworldHistory, setSelectedPalworldHistory] = useState<PalworldPlayerSnapshot[]>([]);
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
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState<PalworldPlayerProfileSessionSummary | null>(null);
  const [drawerSavePlayerSaveId, setDrawerSavePlayerSaveId] = useState('');
  const [drawerSavePlayerFileName, setDrawerSavePlayerFileName] = useState('');
  const [drawerLinkNotes, setDrawerLinkNotes] = useState('');
  const [drawerLinkError, setDrawerLinkError] = useState<string | null>(null);
  const [drawerLinkSuccess, setDrawerLinkSuccess] = useState<string | null>(null);
  const [drawerLinkSubmitting, setDrawerLinkSubmitting] = useState(false);
  const [isFleetExpanded, setIsFleetExpanded] = useState(false);
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
    if (!selectedPlayerProfile) {
      return;
    }

    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === 'Escape') {
        setSelectedPlayerProfile(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPlayerProfile]);

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
            fetch(`${apiBaseUrl}/servers/${server.id}/events?limit=50`)
          ];
          const palworldRequests = server.game === 'palworld'
            ? [
                fetch(`${apiBaseUrl}/servers/${server.id}/palworld/players/latest?limit=8`),
                fetch(`${apiBaseUrl}/servers/${server.id}/palworld/metrics/recent?limit=8`)
              ]
            : [];
          const responses = await Promise.all([...sharedRequests, ...palworldRequests]);
          const statusResponse = responses[0];
          const sessionsResponse = responses[1];
          const knownPlayersResponse = responses[2];
          const eventsResponse = responses[3];
          const palworldLatestPlayersResponse = server.game === 'palworld' ? responses[4] : null;
          const palworldMetricsResponse = server.game === 'palworld' ? responses[5] : null;

          if (!statusResponse.ok || !sessionsResponse.ok || !knownPlayersResponse.ok || !eventsResponse.ok) {
            const statusCode = [statusResponse, sessionsResponse, knownPlayersResponse, eventsResponse]
              .find((response) => !response.ok)?.status;
            throw new Error(`Server ${server.id} summary fetch failed with status ${statusCode ?? 'unknown'}`);
          }

          if (palworldLatestPlayersResponse && !palworldLatestPlayersResponse.ok) {
            throw new Error(`Server ${server.id} Palworld players fetch failed with status ${palworldLatestPlayersResponse.status}`);
          }

          if (palworldMetricsResponse && !palworldMetricsResponse.ok) {
            throw new Error(`Server ${server.id} Palworld metrics fetch failed with status ${palworldMetricsResponse.status}`);
          }

          const [statusPayload, sessionsPayload, knownPlayersPayload, eventsPayload, palworldLatestPlayersPayload, palworldMetricsPayload] = await Promise.all([
            statusResponse.json(),
            sessionsResponse.json(),
            knownPlayersResponse.json(),
            eventsResponse.json(),
            palworldLatestPlayersResponse ? palworldLatestPlayersResponse.json() : Promise.resolve(null),
            palworldMetricsResponse ? palworldMetricsResponse.json() : Promise.resolve(null)
          ]);

          const statusParsed = serverStatusSchema.safeParse(statusPayload);
          const sessionsParsed = activeSessionsResponseSchema.safeParse(sessionsPayload);
          const knownPlayersParsed = knownPlayersResponseSchema.safeParse(knownPlayersPayload);
          const eventsParsed = recentEventsResponseSchema.safeParse(eventsPayload);
          const palworldLatestPlayersParsed = server.game === 'palworld'
            ? palworldLatestPlayersResponseSchema.safeParse(palworldLatestPlayersPayload)
            : null;
          const palworldMetricsParsed = server.game === 'palworld'
            ? palworldMetricsSummariesResponseSchema.safeParse(palworldMetricsPayload)
            : null;

          if (!statusParsed.success || !sessionsParsed.success || !knownPlayersParsed.success || !eventsParsed.success) {
            throw new Error(`Server ${server.id} payload validation failed.`);
          }

          if (palworldLatestPlayersParsed && !palworldLatestPlayersParsed.success) {
            throw new Error(`Server ${server.id} Palworld players payload validation failed.`);
          }

          if (palworldMetricsParsed && !palworldMetricsParsed.success) {
            throw new Error(`Server ${server.id} Palworld metrics payload validation failed.`);
          }

          const recentEvents = [...eventsParsed.data.events]
            .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
            .slice(0, 10);
          const recentWarnings = recentEvents
            .filter((event) => event.eventType === 'HEALTH_WARN')
            .slice(0, 12);
          const palworldLatestPlayers = palworldLatestPlayersParsed?.data.players ?? [];
          const palworldRecentMetrics = palworldMetricsParsed?.data.metrics ?? [];
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
            activePlayers: sessionsParsed.data.sessions.length,
            knownPlayerCount: knownPlayersParsed.data.players.length,
            recentEvents,
            recentWarnings,
            knownPlayers: knownPlayersParsed.data.players.map((player) => ({
              displayName: player.displayName,
              normalizedPlayerKey: normalizePlayerKey(player.normalizedPlayerKey),
              confidence: player.confidence,
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

  const selectedServer = useMemo(
    () => serverOptions.find((server) => server.id === selectedServerId) ?? null,
    [selectedServerId, serverOptions]
  );

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

  const palworldBaseCapacityAlerts = useMemo(() => {
    if (palworldBaseCapacity === null) {
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
  }, [palworldBaseCapacity, palworldBaseSignalTrend]);

  const palworldNextActions = useMemo<PalworldNextAction[]>(() => {
    const actions: PalworldNextAction[] = [];

    if (palworldUrgentGuildRiskCount > 0) {
      actions.push({
        label: `${palworldUrgentGuildRiskCount} urgent guild ${palworldUrgentGuildRiskCount === 1 ? 'risk needs' : 'risks need'} review`
      });
    }

    if (activeSaveLinkNeededCount > 0) {
      actions.push({
        label: `Link saves for ${activeSaveLinkNeededCount} active ${activeSaveLinkNeededCount === 1 ? 'player' : 'players'}`,
        destination: 'Review Saves'
      });
    }

    if (unknownGuildActivityCount > 0) {
      actions.push({
        label: `Resolve missing activity data for ${unknownGuildActivityCount} ${unknownGuildActivityCount === 1 ? 'guild' : 'guilds'}`,
        destination: 'View Players'
      });
    }

    if (palworldBaseCapacityAlerts && palworldBaseCapacityAlerts.severity !== 'safe') {
      actions.push({ label: palworldBaseCapacityAlerts.alertMessage });
    }

    if (palworldBaseCapacityAlerts?.growthAlert) {
      actions.push({ label: palworldBaseCapacityAlerts.growthAlert });
    }

    if (actions.length === 0) {
      actions.push({ label: 'No immediate action needed' });
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

  const palworldWorldCapacitySummary = useMemo(() => {
    return {
      likelyRealGuilds: palworldGuildSummary.likelyRealGuilds,
      activeGuilds: palworldGuildSummary.activeGuildsTwoPlus,
      estimatedBases: palworldBaseCapacity?.estimatedBases ?? null,
      remainingBaseSlots: palworldBaseCapacity?.remainingCapacity ?? null,
      pressureStatus: palworldBaseCapacity?.statusLabel ?? 'Unknown'
    };
  }, [palworldBaseCapacity, palworldGuildSummary]);

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
    return serverOptions.filter((server) => (
      selectedGameFilter === 'all' || server.game === selectedGameFilter
    ));
  }, [selectedGameFilter, serverOptions]);

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
  const fleetCounts = useMemo(() => {
    const visibleSummaries = filteredServers
      .map((server) => fleetByServerId[server.id])
      .filter((summary): summary is ServerSummary => Boolean(summary));

    return {
      servers: filteredServers.length,
      online: visibleSummaries.filter((summary) => summary.state === 'online').length,
      degraded: visibleSummaries.filter((summary) => summary.state === 'degraded').length,
      activePlayers: visibleSummaries.reduce((sum, summary) => sum + summary.activePlayers, 0)
    };
  }, [filteredServers, fleetByServerId]);

  const apiHealthLabel = health?.ok ? 'Online' : 'Unknown';
  const lastUpdatedLabel = lastUpdatedAt ? formatTimestamp(lastUpdatedAt) : 'N/A';
  const selectedWarningSummary = useMemo(
    () => summarizeWarnings(selectedServerSummary?.recentWarnings ?? []),
    [selectedServerSummary]
  );

  const detailTabs = useMemo(() => {
    if (selectedServer?.game === 'palworld') {
      return [
        { key: 'overview', label: 'Overview' },
        { key: 'highlights', label: 'Highlights' },
        { key: 'players', label: 'Players' },
        { key: 'review-saves', label: 'Review Saves' },
        { key: 'guilds', label: 'Guilds' },
        { key: 'metrics', label: 'Metrics' },
        { key: 'ops', label: 'Ops' },
        { key: 'diagnostics', label: 'Diagnostics' }
      ] satisfies Array<{ key: DashboardTab; label: string }>;
    }

    return [
      { key: 'overview', label: 'Overview' },
      { key: 'highlights', label: 'Highlights' },
      { key: 'players', label: 'Players' },
      { key: 'activity', label: 'Activity' },
      { key: 'metrics', label: 'Metrics' },
      { key: 'ops', label: 'Ops' },
      { key: 'diagnostics', label: 'Diagnostics' }
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

    if (palworldBaseCapacity) {
      pushHighlight(`Base pressure ${palworldBaseCapacity.statusLabel.toLowerCase()} at ${palworldBaseCapacity.usagePercent}%`);
      pushHighlight(`${palworldBaseCapacity.estimatedBases} / 240 bases, ${palworldBaseCapacity.remainingCapacity} slots left`);
    }

    if (palworldBaseCapacityAlerts?.growthAlert) {
      pushHighlight(palworldBaseCapacityAlerts.growthAlert);
    } else if (palworldBaseSignalTrend.direction === 'increasing') {
      pushHighlight(`Base trend ${palworldBaseSignalTrend.indicator} increasing`);
    }

    if (palworldGuildSummary.activeGuildsThreePlus > 0) {
      pushHighlight(`${palworldGuildSummary.activeGuildsThreePlus} guilds have 3+ active members`);
    } else if (palworldGuildSummary.activeGuildsTwoPlus > 0) {
      pushHighlight(`${palworldGuildSummary.activeGuildsTwoPlus} guilds have 2+ active members`);
    } else if (palworldGuildSummary.likelyRealGuilds > 0) {
      pushHighlight(`${palworldGuildSummary.likelyRealGuilds} likely real guilds detected`);
    }

    if (palworldCorePlayers[0]) {
      const player = palworldCorePlayers[0];
      pushHighlight(`Core player: ${player.playerName ?? player.accountName ?? player.playerId}`);
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
      items.push('Highlights engine coming next');
    }

    return items.slice(0, 5);
  }, [
    palworldBaseCapacity,
    palworldBaseCapacityAlerts,
    palworldBaseSignalTrend.direction,
    palworldBaseSignalTrend.indicator,
    palworldCorePlayers,
    palworldGuildSummary.activeGuildsThreePlus,
    palworldGuildSummary.activeGuildsTwoPlus,
    palworldGuildSummary.likelyRealGuilds,
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

    if (selectedServerSummary?.recentEvents[0]) {
      const event = selectedServerSummary.recentEvents[0];
      pushHighlight(event.message ?? `${formatEventLabel(event.eventType)} detected`);
    }

    const topPlayer = [...(selectedServerSummary?.knownPlayers ?? [])]
      .sort((left, right) => right.observationCount - left.observationCount)[0];

    if (topPlayer) {
      pushHighlight(`Most observed player: ${topPlayer.displayName}`);
    }

    if ((selectedServerSummary?.activePlayers ?? 0) > 0) {
      pushHighlight(`${selectedServerSummary?.activePlayers ?? 0} active sessions detected`);
    }

    if (items.length === 0) {
      items.push('Highlights engine coming next');
    }

    return items.slice(0, 5);
  }, [selectedServerSummary, selectedWarningSummary]);

  const valheimCorePlayers = useMemo(() => {
    return [...(selectedServerSummary?.knownPlayers ?? [])]
      .sort((left, right) => right.observationCount - left.observationCount)
      .slice(0, 5);
  }, [selectedServerSummary]);

  const valheimWorldCapacitySummary = useMemo(() => {
    return {
      likelyRealGuilds: selectedServerSummary?.knownPlayerCount ?? 0,
      activeGuilds: selectedServerSummary?.activePlayers ?? 0,
      estimatedBases: null,
      remainingBaseSlots: null,
      pressureStatus: selectedWarningSummary.length > 0 ? 'Watch' : 'Stable'
    };
  }, [selectedServerSummary, selectedWarningSummary]);

  const activeWorldCapacitySummary = selectedServer?.game === 'palworld'
    ? palworldWorldCapacitySummary
    : valheimWorldCapacitySummary;
  const activeHighlights = selectedServer?.game === 'palworld'
    ? palworldOverviewHighlights
    : valheimOverviewHighlights;
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
    if (!palworldBaseCapacity) {
      return null;
    }

    return {
      status: palworldBaseCapacity.statusLabel,
      estimatedBasesLabel: `${palworldBaseCapacity.estimatedBases} / 240`,
      remainingSlotsLabel: `${palworldBaseCapacity.remainingCapacity}`,
      trendLabel: `${palworldBaseSignalTrend.indicator} ${palworldBaseSignalTrend.direction}`,
      summary: palworldBaseCapacity.summary
    };
  }, [palworldBaseCapacity, palworldBaseSignalTrend.direction, palworldBaseSignalTrend.indicator]);

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
        <h1>GameOps Bridge Dashboard</h1>
        <p>Fleet overview with shared server telemetry and game-specific detail panels.</p>

        <div className="toolbar toolbar-wide">
          <div className="toolbar-group">
            <label htmlFor="game-filter">Game</label>
            <select id="game-filter" value={selectedGameFilter} onChange={(event) => setSelectedGameFilter(event.target.value as GameFilter)}>
              <option value="all">All Games</option>
              <option value="valheim">Valheim</option>
              <option value="palworld">Palworld</option>
            </select>
          </div>

          <div className="toolbar-group">
            <label htmlFor="server-select">Server Detail</label>
            <select
              id="server-select"
              value={selectedServerId}
              onChange={(event) => setSelectedServerId(event.target.value)}
              disabled={serverOptionsLoading || filteredServers.length === 0}
            >
              {filteredServers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.displayName} ({server.game})
                </option>
              ))}
            </select>
          </div>
        </div>

        {serverOptionsLoading ? <p className="subtle">Loading configured servers...</p> : null}
        {serverOptionsError ? <p className="error">Server catalog unavailable: {serverOptionsError}</p> : null}
        {fleetError ? <p className="error">Fleet refresh failed: {fleetError}</p> : null}

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
            <span className="status-label">Degraded</span>
            <span className="status-value">{fleetCounts.degraded}</span>
          </div>
          <div className="status-pill">
            <span className="status-label">Active Players</span>
            <span className="status-value">{fleetCounts.activePlayers}</span>
          </div>
          <div className="status-pill">
            <span className="status-label">Updated</span>
            <span className="status-value">{lastUpdatedLabel}</span>
          </div>
        </div>
      </header>

      {selectedServer && selectedServerSummary ? (
        <section className="dashboard-tab-shell">
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
        </section>
      ) : null}

      <section className="fleet-section">
        <div className="section-heading fleet-heading">
          <h2>Fleet</h2>
          {selectedServer ? (
            <button
              type="button"
              className="fleet-toggle-button"
              onClick={() => setIsFleetExpanded((current) => !current)}
            >
              {isFleetExpanded ? 'Hide Fleet' : 'Show Fleet'}
            </button>
          ) : null}
        </div>

        {fleetLoading ? <p className="subtle">Loading fleet telemetry...</p> : null}

        {selectedServer && !isFleetExpanded ? (
          <div className="fleet-collapsed-note">
            <span>{selectedServer.displayName}</span>
            <span>{selectedServer.game}</span>
          </div>
        ) : (
          <div className="fleet-grid">
            {filteredServers.map((server) => {
              const summary = fleetByServerId[server.id];

              return (
                <article
                  key={server.id}
                  className={`card fleet-card ${selectedServerId === server.id ? 'fleet-card-selected' : ''}`}
                  onClick={() => {
                    setSelectedServerId(server.id);
                    setIsFleetExpanded(false);
                  }}
                >
                  <div className="fleet-card-top">
                    <div>
                      <h3>{server.displayName}</h3>
                      <p className="subtle">{server.game}</p>
                    </div>
                    <span className={`state-pill state-${summary?.state ?? 'offline'}`}>
                      {summary?.state ?? 'loading'}
                    </span>
                  </div>
                  <div className="fleet-card-meta">
                    {summary?.game === 'palworld' ? (
                      <>
                        <span>{summary.palworldLatestPlayers.filter((player) => player.isOnline).length || summary.activePlayers} players</span>
                        <span>{formatQuickValue(summary.palworldRecentMetrics[0]?.serverFps)} FPS</span>
                        <span>{formatHours(summary.palworldRecentMetrics[0]?.currentUptimeHours)} uptime</span>
                      </>
                    ) : (
                      <>
                        <span>{summary?.activePlayers ?? 0} active</span>
                        <span>{summary?.knownPlayerCount ?? 0} known</span>
                        <span>{summary?.recentWarnings.length ?? 0} warnings</span>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="detail-section">
        <div className="section-heading">
          <h2>Server Detail</h2>
          <p className="subtle">Shared telemetry first, then game-specific views.</p>
        </div>

        {!selectedServer || !selectedServerSummary ? (
          <article className="card detail-card">
            <p className="subtle">Select a server from the fleet overview to inspect details.</p>
          </article>
        ) : (
          <>
            <section className="top-status-rail">
              <div className="top-status-chip">
                <span className="top-status-key">Server</span>
                <span className="top-status-value">{selectedServerSummary.displayName}</span>
              </div>
              <div className="top-status-chip">
                <span className="top-status-key">Game</span>
                <span className="top-status-value">{selectedServerSummary.game}</span>
              </div>
              <div className="top-status-chip">
                <span className="top-status-key">Connection</span>
                <span className="top-status-value">{health?.ok ? `${apiHealthLabel} / ${selectedServerSummary.state}` : selectedServerSummary.state}</span>
              </div>
              <div className="top-status-chip">
                <span className="top-status-key">Alerts</span>
                <span className="top-status-value">{selectedAlertCount}</span>
              </div>
              <div className="top-status-chip">
                <span className="top-status-key">Updated</span>
                <span className="top-status-value">{lastUpdatedLabel}</span>
              </div>
            </section>

            {detailLoading ? <p className="subtle">Loading game-specific telemetry...</p> : null}
            {detailError ? <p className="error">{detailError}</p> : null}

            <section className="game-section">
              {selectedServer.game === 'palworld' && selectedDashboardTab === 'overview' ? (
                <section className="palworld-command-center">
                  <article className={`card command-summary-card server-health-${serverHealthTone}`}>
                    <div className="command-summary-main">
                      <span className="summary-label">Command Summary</span>
                      <h2>{selectedServerSummary.displayName}</h2>
                      <p>{palworldServerHealthSummary ? `${palworldServerHealthSummary.status}: ${palworldServerHealthSummary.summary}` : selectedServerSummary.state}</p>
                    </div>
                    <div className="command-summary-meta">
                      <span>{playerProfiles.filter((profile) => profile.isOnline).length || selectedServerSummary.activePlayers} online</span>
                      <span>{palworldBaseCapacity ? `${palworldBaseCapacity.estimatedBases} / 240` : 'N/A'} bases used</span>
                      <span>{palworldBaseCapacity?.remainingCapacity ?? 'N/A'} slots left</span>
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
                          {nowOnlinePlayerProfiles.length === 0 ? <li className="empty-line">No players online</li> : null}
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
                          {topPlayerProfiles.length === 0 ? <li className="empty-line">No tracked playtime yet</li> : null}
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
                          {saveLinkNeededPlayerProfiles.length === 0 ? <li className="empty-line">All active saves linked</li> : null}
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
                            expanded={expandedGuildActivityName === guild.guildName}
                            reviewed={reviewedGuildNames.has(guild.guildName)}
                            onToggle={() => setExpandedGuildActivityName((current) => current === guild.guildName ? null : guild.guildName)}
                            onMarkReviewed={() => setReviewedGuildNames((current) => new Set(current).add(guild.guildName))}
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
                              onClick={() => {
                                if (action.destination === 'Review Saves') {
                                  setSelectedDashboardTab('review-saves');
                                } else if (action.destination === 'View Players') {
                                  setSelectedDashboardTab('players');
                                }
                              }}
                            >
                              <span>{action.label}</span>
                              {action.destination ? <small>{action.destination}</small> : null}
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
                        <div className="signal-caption">{selectedWarningSummary[0]?.snippet ?? 'Server status looks stable.'}</div>
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
                    <article className="card">
                      <h2>World Capacity Summary</h2>
                      <ul className="list compact">
                        <li><span>Likely Real Guilds</span><span>{activeWorldCapacitySummary.likelyRealGuilds}</span></li>
                        <li><span>Active Guilds</span><span>{activeWorldCapacitySummary.activeGuilds}</span></li>
                        <li><span>Estimated Bases</span><span>{activeWorldCapacitySummary.estimatedBases ?? 'N/A'}</span></li>
                        <li><span>Remaining Base Slots</span><span>{activeWorldCapacitySummary.remainingBaseSlots ?? 'N/A'}</span></li>
                        <li><span>Pressure Status</span><span>{activeWorldCapacitySummary.pressureStatus}</span></li>
                      </ul>
                    </article>

                    <article className="card">
                      <h2>Core Players</h2>
                      <ul className="list review-list">
                        {valheimCorePlayers.length === 0 ? <li>Player intelligence not available for Valheim yet.</li> : null}
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
                      <article className="card overview-note-card">
                        <h2>Overview</h2>
                        <p className="subtle">Use tabs for player, activity, ops, and diagnostics detail.</p>
                      </article>
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
                        <article className="card">
                          <h2>Known Players</h2>
                          <ul className="list">
                            {selectedServerSummary.knownPlayers.length === 0 ? <li>None tracked yet</li> : null}
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
                                <h3>Sessions</h3>
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
                          ) : null}
                        </article>
                      </>
                    ) : null}

                    {selectedDashboardTab === 'activity' ? (
                      <>
                        <article className="card">
                          <h2>Recent Events</h2>
                          <ul className="list activity-list">
                            {selectedServerSummary.recentEvents.length === 0 ? <li>No recent events</li> : null}
                            {selectedServerSummary.recentEvents.map((event, index) => (
                              <li key={`${event.eventType}:${event.occurredAt}:${index}`} className="activity-row">
                                <span className="activity-main">
                                  <span className={`activity-badge ${getEventBadgeClass(event.eventType)}`}>{formatEventLabel(event.eventType)}</span>
                                  <span>{event.message ?? event.playerName ?? 'Event'}</span>
                                </span>
                                <span className="subtle activity-time">{formatClock(event.occurredAt)}</span>
                              </li>
                            ))}
                          </ul>
                        </article>

                        <article className="card">
                          <h2>Active Players</h2>
                          <ul className="list">
                            {selectedServerSummary.activePlayers === 0 ? <li>None online</li> : null}
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
                      <article className="card">
                        <h2>Ops</h2>
                        <p className="subtle">Ops workflows for Valheim remain unchanged. This tab is reserved for future command-center actions.</p>
                      </article>
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
                            {selectedWarningSummary.length === 0 ? <li>No recent warnings</li> : null}
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
                        <article className="card">
                          <h2>Highlights</h2>
                          <ul className="list review-list">
                            {activeHighlights.map((item) => (
                              <li key={item} className="review-row"><div className="review-main">{item}</div></li>
                            ))}
                          </ul>
                        </article>

                        <article className="card">
                          <h2>Current Milestone Feed</h2>
                          <ul className="list review-list">
                            {palworldMilestoneFeed.length === 0 ? <li>No active milestone signals.</li> : null}
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
                        <article className="card">
                          <h2>Player Telemetry</h2>
                          <ul className="list telemetry-list">
                            {palworldLatestPlayers.length === 0 ? <li>No player telemetry yet</li> : null}
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
                          {!selectedPalworldPlayerProfile && !palworldPlayerDetailLoading ? <p className="subtle">Select a Palworld player to inspect the unified live/save identity profile and recent snapshots.</p> : null}
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
                                  <li><span>Ping</span><span>{formatMetric(selectedPalworldPlayerProfile.ping)}</span></li>
                                  <li><span>Session</span><span>{formatDurationMaybe(selectedPalworldPlayerProfile.currentSessionDurationSeconds)}</span></li>
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
                                  <h4>Player Intelligence</h4>
                                  <ul className="list compact">
                                    <li><span>Likely Guild</span><span>{selectedPalworldPlayerProfile.playerIntelligence.likelyGuildName ?? 'N/A'}</span></li>
                                    <li><span>Guild Member Count</span><span>{selectedPalworldPlayerProfile.playerIntelligence.guildMemberCount ?? 'N/A'}</span></li>
                                    <li><span>Identity State</span><span>{selectedPalworldPlayerProfile.playerIntelligence.identityState}</span></li>
                                    <li><span>Level Tier</span><span>{selectedPalworldPlayerProfile.playerIntelligence.levelTier ?? 'N/A'}</span></li>
                                    <li><span>Session Tier</span><span>{selectedPalworldPlayerProfile.playerIntelligence.sessionTier ?? 'N/A'}</span></li>
                                    <li><span>Engagement Score</span><span>{selectedPalworldPlayerProfile.playerIntelligence.engagementScore}</span></li>
                                    <li><span>Classification</span><span>{selectedPalworldPlayerProfile.playerIntelligence.classification}</span></li>
                                    <li><span>Impact Level</span><span>{selectedPalworldPlayerProfile.playerIntelligence.impactLevel}</span></li>
                                  </ul>
                                </div>
                              </div>
                              <div className="detail-block">
                                <h3>History</h3>
                                <ul className="list compact">
                                  {selectedPalworldHistory.length === 0 ? <li>No snapshots</li> : null}
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
                      <article className="card guild-activity-card">
                        <div className="command-panel-heading">
                          <div>
                            <h2>Guild Activity</h2>
                            <p className="subtle">All parsed guilds with matched member activity.</p>
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
                              <li><span>Active Guilds (2+)</span><span>{palworldGuildSummary.activeGuildsTwoPlus}</span></li>
                              <li><span>Active Guilds (3+)</span><span>{palworldGuildSummary.activeGuildsThreePlus}</span></li>
                            </ul>
                          </div>
                        ) : null}
                        <ul className="list review-list guild-activity-list">
                          {!palworldGuildsError && guildActivity.length === 0 ? <li className="empty-line">No guild activity available.</li> : null}
                          {guildActivity.map((guild) => (
                            <GuildRiskRow
                              key={`all-guild:${guild.guildName}`}
                              guild={guild}
                              expanded={expandedGuildActivityName === guild.guildName}
                              reviewed={reviewedGuildNames.has(guild.guildName)}
                              onToggle={() => setExpandedGuildActivityName((current) => current === guild.guildName ? null : guild.guildName)}
                              onMarkReviewed={() => setReviewedGuildNames((current) => new Set(current).add(guild.guildName))}
                            />
                          ))}
                        </ul>
                      </article>
                    ) : null}

                    {selectedDashboardTab === 'metrics' ? (
                      <>
                        <article className="card">
                          <h2>Base Capacity</h2>
                          {palworldBaseSignal !== null && palworldBaseCapacity !== null ? (
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
                          ) : <p className="subtle">No base capacity signal available.</p>}
                        </article>

                        <article className="card">
                          <h2>Recent Metrics</h2>
                          <ul className="list">
                            {palworldMetrics.length === 0 ? <li>No metrics snapshots</li> : null}
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

function formatEventLabel(eventType: string): string {
  if (eventType === 'PLAYER_JOIN') {
    return 'join';
  }

  if (eventType === 'PLAYER_LEAVE') {
    return 'leave';
  }

  if (eventType === 'HEALTH_WARN') {
    return 'warn';
  }

  if (eventType === 'SERVER_ONLINE') {
    return 'online';
  }

  return eventType.toLowerCase();
}

function formatQuickValue(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  return value >= 100 ? String(Math.round(value)) : value.toFixed(1);
}

function formatHours(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  return `${value.toFixed(1)}h`;
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

function getEventBadgeClass(eventType: string): string {
  if (eventType === 'PLAYER_JOIN') {
    return 'activity-badge-join';
  }

  if (eventType === 'PLAYER_LEAVE') {
    return 'activity-badge-leave';
  }

  return 'activity-badge-neutral';
}

export default App;
