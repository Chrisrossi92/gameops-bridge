import {
  activeSessionsResponseSchema,
  knownPlayerProfileResponseSchema,
  knownPlayersResponseSchema,
  recentEventsResponseSchema,
  type KnownPlayerProfileResponse,
  type NormalizedEvent
} from '@gameops/shared';
import { useEffect, useMemo, useState } from 'react';
import './App.css';

interface HealthResponse {
  ok: boolean;
  service: string;
  timestamp: string;
}

interface OnlineEntry {
  playerName: string;
  displayName: string;
  startedAt: string;
  lookupKey: string;
}

interface KnownPlayerEntry {
  displayName: string;
  normalizedPlayerKey: string;
  confidence: string;
  lastSeenAt: string;
  observationCount: number;
}

type WarningCategory = 'network' | 'disconnect' | 'save_storage' | 'general';

interface WarningSummaryEntry {
  category: WarningCategory;
  snippet: string;
  latestAt: string;
  count: number;
  signature: string;
}

const SERVER_OPTIONS = [
  { id: 'valheim-local-1', label: 'Valheim Local 1' }
];
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
const REFRESH_INTERVAL_MS = 15_000;
const WARNING_GROUP_WINDOW_MS = 8 * 60 * 1000;

function App() {
  const [serverId, setServerId] = useState<string>(SERVER_OPTIONS[0]?.id ?? 'valheim-local-1');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [onlineEntries, setOnlineEntries] = useState<OnlineEntry[]>([]);
  const [recentActivity, setRecentActivity] = useState<NormalizedEvent[]>([]);
  const [latestWarnings, setLatestWarnings] = useState<NormalizedEvent[]>([]);
  const [knownPlayerCount, setKnownPlayerCount] = useState(0);
  const [knownPlayerPreview, setKnownPlayerPreview] = useState<KnownPlayerEntry[]>([]);
  const [selectedPlayerLookupKey, setSelectedPlayerLookupKey] = useState<string | null>(null);
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState<KnownPlayerProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard(isInitialLoad: boolean) {
      try {
        if (isInitialLoad && isMounted) {
          setLoading(true);
        }

        const [healthResponse, sessionsResponse, knownPlayersResponse, eventsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/health`),
          fetch(`${apiBaseUrl}/servers/${serverId}/sessions/active`),
          fetch(`${apiBaseUrl}/servers/${serverId}/players/known?limit=100`),
          fetch(`${apiBaseUrl}/servers/${serverId}/events?limit=50`)
        ]);

        if (!healthResponse.ok) {
          throw new Error(`/health failed with status ${healthResponse.status}`);
        }

        if (!sessionsResponse.ok || !knownPlayersResponse.ok || !eventsResponse.ok) {
          const failingStatus = [sessionsResponse, knownPlayersResponse, eventsResponse].find((response) => !response.ok)?.status;
          throw new Error(`Server summary fetch failed with status ${failingStatus ?? 'unknown'}`);
        }

        const healthPayload = (await healthResponse.json()) as HealthResponse;
        const [sessionsPayload, knownPlayersPayload, eventsPayload] = await Promise.all([
          sessionsResponse.json(),
          knownPlayersResponse.json(),
          eventsResponse.json()
        ]);

        const sessionsParsed = activeSessionsResponseSchema.safeParse(sessionsPayload);
        const knownPlayersParsed = knownPlayersResponseSchema.safeParse(knownPlayersPayload);
        const eventsParsed = recentEventsResponseSchema.safeParse(eventsPayload);

        if (!sessionsParsed.success || !knownPlayersParsed.success || !eventsParsed.success) {
          throw new Error('Dashboard payload validation failed.');
        }

        const knownPlayers = knownPlayersParsed.data.players.map((player) => ({
          displayName: player.displayName,
          normalizedPlayerKey: normalizePlayerKey(player.normalizedPlayerKey),
          confidence: player.confidence,
          lastSeenAt: player.lastSeenAt,
          observationCount: player.observationCount
        }));

        const online = sessionsParsed.data.sessions.map((session) => {
          const normalizedSessionName = normalizePlayerKey(session.playerName);
          const knownMatch = knownPlayers.find((player) => {
            return player.normalizedPlayerKey === normalizedSessionName
              || normalizePlayerKey(player.displayName) === normalizedSessionName;
          });

          return {
            playerName: session.playerName,
            displayName: knownMatch?.displayName ?? session.playerName,
            startedAt: session.startedAt,
            lookupKey: knownMatch?.normalizedPlayerKey ?? normalizePlayerKey(session.playerName)
          };
        });

        const joinLeaveEvents = eventsParsed.data.events.filter((event) => (
          event.eventType === 'PLAYER_JOIN' || event.eventType === 'PLAYER_LEAVE'
        ));
        const warningEvents = eventsParsed.data.events
          .filter((event) => event.eventType === 'HEALTH_WARN')
          .slice(0, 20);

        if (!isMounted) {
          return;
        }

        setError(null);
        setHealth(healthPayload);
        setOnlineEntries(online);
        setRecentActivity(joinLeaveEvents.slice(0, 10));
        setLatestWarnings(warningEvents);
        setKnownPlayerCount(knownPlayersParsed.data.players.length);
        const sortedKnownPlayers = [...knownPlayersParsed.data.players].sort((a, b) => {
          const confidenceRankDiff = getConfidenceRank(b.confidence) - getConfidenceRank(a.confidence);

          if (confidenceRankDiff !== 0) {
            return confidenceRankDiff;
          }

          const recencyDiff = Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);

          if (Number.isFinite(recencyDiff) && recencyDiff !== 0) {
            return recencyDiff;
          }

          return b.observationCount - a.observationCount;
        });

        setKnownPlayerPreview(sortedKnownPlayers.slice(0, 8).map((player) => ({
          displayName: player.displayName,
          normalizedPlayerKey: normalizePlayerKey(player.normalizedPlayerKey),
          confidence: player.confidence,
          lastSeenAt: player.lastSeenAt,
          observationCount: player.observationCount
        })));
        setLastUpdatedAt(new Date().toISOString());
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Unknown error';
        if (isMounted) {
          setError(message);
        }
      } finally {
        if (isMounted && isInitialLoad) {
          setLoading(false);
        }
      }
    }

    void loadDashboard(true);
    const interval = setInterval(() => {
      void loadDashboard(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [serverId]);

  useEffect(() => {
    let isMounted = true;

    async function loadSelectedPlayerProfile(): Promise<void> {
      if (!selectedPlayerLookupKey) {
        setSelectedPlayerProfile(null);
        setProfileError(null);
        setProfileLoading(false);
        return;
      }

      try {
        setProfileLoading(true);
        setProfileError(null);

        const response = await fetch(
          `${apiBaseUrl}/servers/${serverId}/players/known/${encodeURIComponent(selectedPlayerLookupKey)}`
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
          setSelectedPlayerProfile(parsed.data);
        }
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Unknown error';
        if (isMounted) {
          setProfileError(message);
          setSelectedPlayerProfile(null);
        }
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    }

    void loadSelectedPlayerProfile();

    return () => {
      isMounted = false;
    };
  }, [serverId, selectedPlayerLookupKey]);

  const apiHealthLabel = useMemo(() => {
    if (!health) {
      return 'Unknown';
    }

    return health.ok ? 'Online' : 'Degraded';
  }, [health]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) {
      return 'N/A';
    }

    return new Date(lastUpdatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }, [lastUpdatedAt]);

  const selectedPlayer = selectedPlayerProfile?.player ?? null;
  const selectedRecentSessions = selectedPlayerProfile?.recentSessions ?? [];
  const warningSummaryEntries = useMemo(() => summarizeWarnings(latestWarnings), [latestWarnings]);

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <h1>GameOps Bridge Dashboard</h1>
        <p>Live Valheim operations snapshot</p>
        <div className="toolbar">
          <label htmlFor="server-select">Server</label>
          <select id="server-select" value={serverId} onChange={(event) => setServerId(event.target.value)}>
            {SERVER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <span className="meta">API: {apiHealthLabel}</span>
          <span className="meta">Updated: {lastUpdatedLabel}</span>
        </div>
      </header>

      {loading ? <p>Loading dashboard...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="card-grid">
        <article className="card">
          <h2>Online Now</h2>
          <p className="kpi">{onlineEntries.length}</p>
          <p className="subtle">current players online</p>
          <ul className="list">
            {onlineEntries.length === 0 ? <li>None</li> : null}
            {onlineEntries.map((entry) => (
              <li
                key={`${entry.playerName}:${entry.startedAt}`}
                className={`clickable-row ${selectedPlayerLookupKey === entry.lookupKey ? 'selected' : ''}`}
                onClick={() => setSelectedPlayerLookupKey(entry.lookupKey)}
              >
                <span>{entry.displayName}</span>
                <span className="subtle">{formatDuration(entry.startedAt)}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Recent Activity</h2>
          <ul className="list">
            {recentActivity.length === 0 ? <li>No recent joins/leaves</li> : null}
            {recentActivity.map((event, index) => (
              <li key={`${event.eventType}:${event.occurredAt}:${index}`}>
                <span>
                  {event.eventType === 'PLAYER_JOIN' ? '+ join' : '- leave'}
                  {event.playerName ? ' ' : ''}
                  {event.playerName ? (
                    <button
                      type="button"
                      className="inline-player-link"
                      onClick={() => setSelectedPlayerLookupKey(normalizePlayerKey(event.playerName ?? ''))}
                    >
                      {event.playerName}
                    </button>
                  ) : null}
                </span>
                <span className="subtle">{formatClock(event.occurredAt)}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Known Players</h2>
          <p className="kpi">{knownPlayerCount}</p>
          <p className="subtle">tracked identities</p>
          <ul className="list">
            {knownPlayerPreview.length === 0 ? <li>None tracked yet</li> : null}
            {knownPlayerPreview.map((player) => (
              <li
                key={`${player.displayName}:${player.lastSeenAt}`}
                className={`clickable-row ${selectedPlayerLookupKey === player.normalizedPlayerKey ? 'selected' : ''}`}
                onClick={() => setSelectedPlayerLookupKey(player.normalizedPlayerKey)}
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
          <h2>Latest Warnings</h2>
          <ul className="list">
            {warningSummaryEntries.length === 0 ? <li>No recent warnings</li> : null}
            {warningSummaryEntries.map((warning, index) => (
              <li key={`${warning.signature}:${warning.latestAt}:${index}`}>
                <span className="warning-main">
                  <span className={`warning-badge warning-${warning.category}`}>
                    {formatWarningCategoryLabel(warning.category)}
                  </span>
                  {warning.snippet}
                  {warning.count > 1 ? ` ×${warning.count}` : ''}
                </span>
                <span className="subtle">{formatClock(warning.latestAt)}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="detail-section">
        <article className="card detail-card">
          <div className="detail-header">
            <h2>Player Details</h2>
            {selectedPlayerLookupKey ? (
              <button type="button" onClick={() => setSelectedPlayerLookupKey(null)}>
                Clear
              </button>
            ) : null}
          </div>

          {!selectedPlayerLookupKey ? <p className="subtle">Select a player from Online Now or Known Players.</p> : null}
          {profileLoading ? <p className="subtle">Loading player profile...</p> : null}
          {profileError ? <p className="error">{profileError}</p> : null}
          {selectedPlayerLookupKey && !profileLoading && !profileError && !selectedPlayer ? (
            <p className="subtle">No known player profile found for this selection.</p>
          ) : null}

          {selectedPlayer ? (
            <>
              <p><strong>Name:</strong> {selectedPlayer.displayName}</p>
              <p><strong>Confidence:</strong> {selectedPlayer.confidence}</p>
              <p><strong>Observations:</strong> {selectedPlayer.observationCount}</p>
              <p><strong>First Seen:</strong> {formatTimestamp(selectedPlayer.firstSeenAt)}</p>
              <p><strong>Last Seen:</strong> {formatTimestamp(selectedPlayer.lastSeenAt)}</p>

              <div className="detail-grid">
                <div>
                  <h3>Recent Sessions</h3>
                  <ul className="list compact">
                    {selectedRecentSessions.length === 0 ? <li>None</li> : null}
                    {selectedRecentSessions.slice(0, 5).map((session, index) => (
                      <li key={`${session.startedAt}:${index}`}>
                        <span>{formatTimestamp(session.endedAt ?? session.startedAt)}</span>
                        <span className="subtle">{formatDurationFromSeconds(session.durationSeconds ?? 0)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Character IDs</h3>
                  <ul className="list compact">
                    {selectedPlayer.knownCharacterIds.length === 0 ? <li>None</li> : null}
                    {selectedPlayer.knownCharacterIds.slice(0, 8).map((id) => <li key={id}>{id}</li>)}
                  </ul>
                </div>
                <div>
                  <h3>Platform IDs</h3>
                  <ul className="list compact">
                    {selectedPlayer.knownPlatformIds.length === 0 ? <li>None</li> : null}
                    {selectedPlayer.knownPlatformIds.slice(0, 6).map((id) => <li key={id}>{truncate(id, 44)}</li>)}
                  </ul>
                </div>
                <div>
                  <h3>PlayFab IDs</h3>
                  <ul className="list compact">
                    {selectedPlayer.knownPlayFabIds.length === 0 ? <li>None</li> : null}
                    {selectedPlayer.knownPlayFabIds.slice(0, 6).map((id) => <li key={id}>{truncate(id, 44)}</li>)}
                  </ul>
                </div>
                <div>
                  <h3>Identity Sources</h3>
                  <ul className="list compact">
                    {selectedPlayer.identitySources.length === 0 ? <li>None</li> : null}
                    {selectedPlayer.identitySources.slice(0, 8).map((source) => <li key={source}>{source}</li>)}
                  </ul>
                </div>
              </div>
            </>
          ) : null}
        </article>
      </section>
    </main>
  );
}

function normalizePlayerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatDuration(startedAt: string): string {
  const startedAtMs = Date.parse(startedAt);

  if (!Number.isFinite(startedAtMs)) {
    return 'unknown';
  }

  const seconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function formatClock(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function truncate(value: string, maxLength: number): string {
  const compact = value.trim();

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 3)}...`;
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
      previous &&
      previous.category === category &&
      previous.signature === signature &&
      Number.isFinite(occurredAtMs) &&
      Number.isFinite(previousMs) &&
      Math.abs(previousMs - occurredAtMs) <= WARNING_GROUP_WINDOW_MS
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
  let compact = message.trim();
  compact = compact.replace(/^\[[^\]]+\]\s*/g, '');
  compact = compact.replace(/playfab\/[a-z0-9_-]+/gi, 'playfab/<id>');
  compact = compact.replace(/\s+/g, ' ');
  return truncate(compact, 84);
}

function normalizeWarningSignature(message: string): string {
  return message
    .toLowerCase()
    .replace(/playfab\/[a-z0-9_-]+/g, 'playfab/<id>')
    .replace(/\d+/g, '#')
    .replace(/[^a-z0-9<> ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatWarningCategoryLabel(category: WarningCategory): string {
  if (category === 'save_storage') {
    return 'save';
  }

  return category;
}

function getConfidenceRank(confidence: string): number {
  if (confidence === 'high') {
    return 3;
  }

  if (confidence === 'medium') {
    return 2;
  }

  return 1;
}

export default App;
