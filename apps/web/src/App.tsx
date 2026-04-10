import {
  activeSessionsResponseSchema,
  configuredServersResponseSchema,
  knownPlayerProfileResponseSchema,
  knownPlayersResponseSchema,
  palworldIdentityApprovalsResponseSchema,
  palworldIdentityLinksResponseSchema,
  palworldLatestPlayersResponseSchema,
  palworldMilestoneFeedResponseSchema,
  palworldMetricsSummariesResponseSchema,
  palworldPlayerSnapshotsResponseSchema,
  palworldTransitionMilestoneEventsResponseSchema,
  palworldUnifiedPlayerProfileSchema,
  recentEventsResponseSchema,
  serverStatusSchema,
  type ConfiguredServersResponse,
  type KnownPlayerProfileResponse,
  type NormalizedEvent,
  type PalworldApprovedIdentity,
  type PalworldIdentityLinkCandidate,
  type PalworldIdentityLinkFailure,
  type PalworldLatestPlayerTelemetry,
  type PalworldMilestoneFeedEntry,
  type PalworldMetricsSummary,
  type PalworldPlayerSnapshot,
  type PalworldRejectedIdentity,
  type PalworldTransitionMilestoneEvent,
  type PalworldUnifiedPlayerProfile
} from '@gameops/shared';
import { useEffect, useMemo, useState } from 'react';
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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
const REFRESH_INTERVAL_MS = 15_000;
const WARNING_GROUP_WINDOW_MS = 8 * 60 * 1000;
const LIVE_SIGNAL_WINDOW_MS = 10 * 60 * 1000;

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
  const [palworldPlayerDetailLoading, setPalworldPlayerDetailLoading] = useState(false);
  const [palworldLatestPlayers, setPalworldLatestPlayers] = useState<PalworldLatestPlayerTelemetry[]>([]);
  const [palworldMetrics, setPalworldMetrics] = useState<PalworldMetricsSummary[]>([]);
  const [palworldMilestoneFeed, setPalworldMilestoneFeed] = useState<PalworldMilestoneFeedEntry[]>([]);
  const [palworldTransitionEvents, setPalworldTransitionEvents] = useState<PalworldTransitionMilestoneEvent[]>([]);
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
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    setSelectedValheimPlayerLookupKey(null);
    setSelectedValheimPlayerProfile(null);
    setSelectedPalworldPlayerKey(null);
    setSelectedPalworldPlayerProfile(null);
    setSelectedPalworldHistory([]);
    setPalworldPlayerDetailLoading(false);
    setPalworldLatestPlayers([]);
    setPalworldMetrics([]);
    setPalworldMilestoneFeed([]);
    setPalworldTransitionEvents([]);
    setPalworldApprovedIdentities([]);
    setPalworldRejectedIdentities([]);
    setPalworldIdentityCandidates([]);
    setPalworldIdentityFailures([]);
    setPalworldIdentityLoading(false);
    setPalworldIdentityError(null);
    setPalworldReviewNotes('');
    setPalworldReviewSubmittingKey(null);
    setPalworldReviewActionError(null);
    setDetailError(null);
  }, [selectedServerId]);

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

  useEffect(() => {
    let isMounted = true;

    async function loadServerDetail(): Promise<void> {
      if (!selectedServer || selectedServer.game !== 'palworld') {
        setPalworldLatestPlayers([]);
        setPalworldMetrics([]);
        setPalworldMilestoneFeed([]);
        setPalworldTransitionEvents([]);
        setDetailLoading(false);
        setDetailError(null);
        return;
      }

      try {
        setDetailLoading(true);
        setDetailError(null);

        const [latestPlayersResponse, metricsResponse, milestonesResponse, transitionsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/servers/${selectedServer.id}/palworld/players/latest?limit=40`),
          fetch(`${apiBaseUrl}/servers/${selectedServer.id}/palworld/metrics/recent?limit=16`),
          fetch(`${apiBaseUrl}/servers/${selectedServer.id}/palworld/milestones/current?limit=24`),
          fetch(`${apiBaseUrl}/servers/${selectedServer.id}/palworld/milestones/transitions/recent?limit=24`)
        ]);

        if (!latestPlayersResponse.ok || !metricsResponse.ok || !milestonesResponse.ok || !transitionsResponse.ok) {
          const statusCode = [latestPlayersResponse, metricsResponse, milestonesResponse, transitionsResponse].find((response) => !response.ok)?.status;
          throw new Error(`Palworld detail fetch failed with status ${statusCode ?? 'unknown'}`);
        }

        const [latestPlayersPayload, metricsPayload, milestonesPayload, transitionsPayload] = await Promise.all([
          latestPlayersResponse.json(),
          metricsResponse.json(),
          milestonesResponse.json(),
          transitionsResponse.json()
        ]);

        const latestPlayersParsed = palworldLatestPlayersResponseSchema.safeParse(latestPlayersPayload);
        const metricsParsed = palworldMetricsSummariesResponseSchema.safeParse(metricsPayload);
        const milestonesParsed = palworldMilestoneFeedResponseSchema.safeParse(milestonesPayload);
        const transitionsParsed = palworldTransitionMilestoneEventsResponseSchema.safeParse(transitionsPayload);

        if (!latestPlayersParsed.success || !metricsParsed.success || !milestonesParsed.success || !transitionsParsed.success) {
          throw new Error('Palworld detail payload validation failed.');
        }

        if (!isMounted) {
          return;
        }

        setPalworldLatestPlayers(latestPlayersParsed.data.players);
        setPalworldMetrics(metricsParsed.data.metrics);
        setPalworldMilestoneFeed(milestonesParsed.data.milestones);
        setPalworldTransitionEvents(transitionsParsed.data.events);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Unknown error';

        if (isMounted) {
          setDetailError(message);
          setPalworldLatestPlayers([]);
          setPalworldMetrics([]);
          setPalworldMilestoneFeed([]);
          setPalworldTransitionEvents([]);
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

      <section className="fleet-section">
        <div className="section-heading">
          <h2>Fleet Overview</h2>
          <p className="subtle">All configured servers in one view, filterable by game.</p>
        </div>

        {fleetLoading ? <p className="subtle">Loading fleet telemetry...</p> : null}

        <div className="fleet-grid">
          {filteredServers.map((server) => {
            const summary = fleetByServerId[server.id];
            const warnings = summarizeWarnings(summary?.recentWarnings ?? []);

            return (
              <article
                key={server.id}
                className={`card fleet-card ${selectedServerId === server.id ? 'fleet-card-selected' : ''}`}
                onClick={() => setSelectedServerId(server.id)}
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
                <div className="fleet-metrics">
                  {summary?.game === 'palworld' ? (
                    <>
                      <div className="summary-item">
                        <span className="summary-label">Players</span>
                        <span className="kpi-small">{summary.palworldLatestPlayers.filter((player) => player.isOnline).length || summary.activePlayers}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Server FPS</span>
                        <span className="kpi-small">{formatQuickValue(summary.palworldRecentMetrics[0]?.serverFps)}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Uptime</span>
                        <span className="kpi-small">{formatHours(summary.palworldRecentMetrics[0]?.currentUptimeHours)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="summary-item">
                        <span className="summary-label">Active</span>
                        <span className="kpi-small">{summary?.activePlayers ?? 0}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Known</span>
                        <span className="kpi-small">{summary?.knownPlayerCount ?? 0}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Warnings</span>
                        <span className="kpi-small">{summary?.recentWarnings.length ?? 0}</span>
                      </div>
                    </>
                  )}
                </div>
                <ul className="list compact">
                  {warnings.length === 0 ? <li>No recent warnings</li> : null}
                  {warnings.slice(0, 2).map((warning) => (
                    <li key={`${warning.signature}:${warning.latestAt}`}>
                      <span className={`warning-badge warning-${warning.category}`}>{formatWarningCategoryLabel(warning.category)}</span>
                      <span className="subtle">{warning.snippet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
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
            <section className="card-grid">
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
            </section>

            {detailLoading ? <p className="subtle">Loading game-specific telemetry...</p> : null}
            {detailError ? <p className="error">{detailError}</p> : null}

            {selectedServer.game === 'valheim' ? (
              <section className="game-section">
                <div className="section-heading">
                  <h2>Valheim Panels</h2>
                  <p className="subtle">Existing player and identity views stay grouped under Valheim.</p>
                </div>

                <section className="card-grid">
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
                              onClick={() => setSelectedValheimPlayerLookupKey(normalizePlayerKey(event.playerName ?? ''))}
                            >
                              {event.playerName ?? 'Unknown player'}
                            </button>
                            <span className="subtle">{formatClock(event.occurredAt)}</span>
                          </li>
                        ))}
                    </ul>
                  </article>

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
                            <li>
                              <span>Status</span>
                              <span>{selectedValheimPlayerProfile.isOnline ? 'Online' : 'Offline'}</span>
                            </li>
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
                </section>
              </section>
            ) : null}

            {selectedServer.game === 'palworld' ? (
              <section className="game-section">
                <div className="section-heading">
                  <h2>Palworld Panels</h2>
                  <p className="subtle">Latest players, per-player detail/history, and recent metrics.</p>
                </div>

                <section className="card-grid">
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
                                <span className={`identity-badge identity-${identityState}`}>
                                  {identityState}
                                </span>
                                <span className={`state-pill state-${player.isOnline ? 'online' : 'offline'}`}>
                                  {player.isOnline ? 'online' : 'offline'}
                                </span>
                              </div>
                            </div>
                            <div className="telemetry-stats">
                              <span>lvl {player.level ?? 'N/A'}</span>
                              <span>{player.region ?? 'unknown region'}</span>
                              <span>ping {formatMetric(player.ping)}</span>
                              <span>avg {formatMetric(player.avgPing)}</span>
                              <span>max {formatMetric(player.maxPing)}</span>
                              <span>sd {formatMetric(player.pingStdDev)}</span>
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
                      <>
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
                              <li><span>Avg Ping</span><span>{formatMetric(selectedPalworldPlayerProfile.avgPing)}</span></li>
                              <li><span>Max Ping</span><span>{formatMetric(selectedPalworldPlayerProfile.maxPing)}</span></li>
                              <li><span>Ping Std Dev</span><span>{formatMetric(selectedPalworldPlayerProfile.pingStdDev)}</span></li>
                              <li><span>Session</span><span>{formatDurationMaybe(selectedPalworldPlayerProfile.currentSessionDurationSeconds)}</span></li>
                              <li><span>Session Tier</span><span>{selectedPalworldPlayerProfile.sessionTier ?? 'N/A'}</span></li>
                              <li><span>Status</span><span>{selectedPalworldPlayerProfile.isOnline ? 'Online' : 'Offline'}</span></li>
                              <li><span>Level Tier</span><span>{selectedPalworldPlayerProfile.levelTier ?? 'N/A'}</span></li>
                              <li><span>Online Rank by Level</span><span>{selectedPalworldPlayerProfile.onlineRankByLevel ?? 'N/A'}</span></li>
                              <li><span>Online Rank by Session</span><span>{selectedPalworldPlayerProfile.onlineRankBySessionDuration ?? 'N/A'}</span></li>
                              <li><span>Identity</span><span className={`confidence-badge confidence-${selectedPalworldPlayerProfile.identityState === 'approved' ? 'high' : selectedPalworldPlayerProfile.identityState === 'rejected' ? 'low' : 'medium'}`}>{selectedPalworldPlayerProfile.identityState}</span></li>
                              <li><span>Reviewed By</span><span>{selectedPalworldPlayerProfile.review.reviewedBy ?? 'N/A'}</span></li>
                              <li><span>Reviewed At</span><span>{selectedPalworldPlayerProfile.review.reviewedAt ? formatTimestamp(selectedPalworldPlayerProfile.review.reviewedAt) : 'N/A'}</span></li>
                              <li><span>Review Notes</span><span>{selectedPalworldPlayerProfile.review.notes || 'None'}</span></li>
                              <li><span>Save File</span><span>{selectedPalworldPlayerProfile.saveArtifact.present ? (selectedPalworldPlayerProfile.saveArtifact.savePlayerFileName ?? 'present') : 'Not found'}</span></li>
                              <li><span>Save Path</span><span>{selectedPalworldPlayerProfile.saveArtifact.path ?? 'N/A'}</span></li>
                              <li><span>Save Parse</span><span>{selectedPalworldPlayerProfile.saveArtifact.parseStatus ?? 'N/A'}</span></li>
                              <li><span>Save MTime</span><span>{selectedPalworldPlayerProfile.saveArtifact.modifiedAt ? formatTimestamp(selectedPalworldPlayerProfile.saveArtifact.modifiedAt) : 'N/A'}</span></li>
                            </ul>
                            <div className="milestone-block">
                              <h4>Milestone Signals</h4>
                              <ul className="list compact">
                                {selectedPalworldPlayerProfile.milestoneSignals.length === 0 ? <li>No current milestone signals.</li> : null}
                                {selectedPalworldPlayerProfile.milestoneSignals.map((signal) => (
                                  <li key={signal.key}>
                                    <span className={`milestone-badge milestone-${signal.strength}`}>{signal.label}</span>
                                    <span className="subtle">{signal.reason}</span>
                                  </li>
                                ))}
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
                                    <span className="subtle">
                                      lvl {snapshot.level ?? 'N/A'} • {snapshot.region ?? 'unknown region'} • ping {formatMetric(snapshot.ping)}
                                    </span>
                                    <span className="subtle">
                                      x {formatCoordinate(snapshot.locationX)} • y {formatCoordinate(snapshot.locationY)}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </>
                    ) : null}
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
                            <div>
                              <strong>{entry.signalLabel}</strong>
                            </div>
                            <div className="subtle">{entry.signalReason}</div>
                            <div className="subtle">
                              identity {entry.identityState} • lvl {entry.level ?? 'N/A'} • session {entry.sessionTier ?? 'N/A'} • tier {entry.levelTier ?? 'N/A'}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="card">
                    <h2>Recent Transition Events</h2>
                    <ul className="list review-list">
                      {palworldTransitionEvents.length === 0 ? <li>No recent transition events.</li> : null}
                      {palworldTransitionEvents.map((event) => (
                        <li key={`${event.playerId}:${event.eventType}:${event.occurredAt}`} className="review-row">
                          <div className="review-main">
                            <div className="review-header">
                              <span className="review-id">{event.playerName ?? event.accountName ?? event.playerId}</span>
                              <span className={`confidence-badge confidence-${event.identityState === 'approved' ? 'high' : event.identityState === 'rejected' ? 'low' : 'medium'}`}>
                                {event.identityState}
                              </span>
                            </div>
                            <div><strong>{event.eventType}</strong></div>
                            <div className="subtle">
                              {event.fromValue ?? 'N/A'} → {event.toValue ?? 'N/A'}
                            </div>
                            <div className="subtle">
                              {formatTimestamp(event.occurredAt)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="card">
                    <h2>Recent Metrics</h2>
                    <ul className="list">
                      {palworldMetrics.length === 0 ? <li>No metrics snapshots</li> : null}
                      {palworldMetrics.map((metric) => (
                        <li key={metric.observedAt}>
                          <span>{formatTimestamp(metric.observedAt)}</span>
                          <span className="subtle">
                            fps {metric.serverFps ?? 'N/A'} • players {metric.currentPlayerCount ?? 'N/A'} • uptime {metric.currentUptimeHours ?? 'N/A'}h
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="card">
                    <h2>Identity Review Candidates</h2>
                    {palworldIdentityLoading ? <p className="subtle">Loading identity link candidates...</p> : null}
                    {palworldIdentityError ? <p className="error">{palworldIdentityError}</p> : null}
                    <div className="review-actions-form">
                      <label className="review-field">
                        <span>Reviewed By</span>
                        <input
                          type="text"
                          value={palworldReviewActor}
                          onChange={(event) => setPalworldReviewActor(event.target.value)}
                          placeholder="your name"
                        />
                      </label>
                      <label className="review-field">
                        <span>Notes</span>
                        <input
                          type="text"
                          value={palworldReviewNotes}
                          onChange={(event) => setPalworldReviewNotes(event.target.value)}
                          placeholder="optional review note"
                        />
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
                            <div className="subtle">
                              save file {candidate.savePlayerFileName}
                            </div>
                            <div>
                              <strong>live:</strong> {candidate.candidate.playerName ?? candidate.candidate.accountName ?? candidate.telemetryLookupKey ?? 'unknown'}
                            </div>
                            <div className="subtle">
                              score {candidate.score} • matched {candidate.matchedOn.join(', ') || 'none'}
                            </div>
                            <div className="subtle">
                              {candidate.notes.join(' • ') || 'no additional notes'}
                            </div>
                            <div className="review-button-row">
                              <button
                                type="button"
                                className="review-button approve-button"
                                onClick={() => void submitPalworldReviewAction('approve', candidate.savePlayerSaveId)}
                                disabled={palworldReviewSubmittingKey !== null}
                              >
                                {palworldReviewSubmittingKey === `approve:${candidate.savePlayerSaveId}` ? 'Approving...' : 'Approve'}
                              </button>
                              <button
                                type="button"
                                className="review-button reject-button"
                                onClick={() => void submitPalworldReviewAction('reject', candidate.savePlayerSaveId)}
                                disabled={palworldReviewSubmittingKey !== null}
                              >
                                {palworldReviewSubmittingKey === `reject:${candidate.savePlayerSaveId}` ? 'Rejecting...' : 'Reject'}
                              </button>
                            </div>
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
                              <button
                                type="button"
                                className="review-button reject-button"
                                onClick={() => void submitPalworldReviewAction('reject', failure.savePlayerSaveId)}
                                disabled={palworldReviewSubmittingKey !== null}
                              >
                                {palworldReviewSubmittingKey === `reject:${failure.savePlayerSaveId}` ? 'Rejecting...' : 'Reject'}
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </article>
                </section>
              </section>
            ) : null}
          </>
        )}
      </section>
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
