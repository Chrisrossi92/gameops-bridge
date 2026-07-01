/* @jsxRuntime classic */
import { playerDetailResponseSchema, type PlayerDetailResponse, type PlayerIntelligenceSummaryResponse, type PlayerIntelligenceSummaryRow } from '@gameops/shared';
import React, { useEffect, useState } from 'react';

export interface OperatorPlayerIntelligenceEntry {
  displayName: string;
  game: string;
  summary: PlayerIntelligenceSummaryResponse;
}

interface OperatorPlayerIntelligenceCardProps {
  apiBaseUrl: string;
  servers: OperatorPlayerIntelligenceEntry[];
}

interface SelectedOperatorPlayer {
  serverId: string;
  playerId: string;
  displayName: string;
  serverDisplayName: string;
  game: string;
  trend: PlayerIntelligenceSummaryRow['trend'];
}

function formatMinutes(value: number): string {
  if (value >= 60) {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${value}m`;
}

function playerLabel(player: PlayerIntelligenceSummaryRow | null): string {
  return player ? `${player.displayName} (${player.status})` : 'none';
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatEventLabel(eventType: PlayerDetailResponse['recentEvents'][number]['eventType']): string {
  return eventType.toLowerCase().replace(/_/g, ' ');
}

function getEventDescription(event: PlayerDetailResponse['recentEvents'][number]): string {
  return event.message ?? event.playerName ?? event.source;
}

function OperatorPlayerDetailDrawer({
  selectedPlayer,
  detail,
  loading,
  error,
  onClose
}: {
  selectedPlayer: SelectedOperatorPlayer;
  detail: PlayerDetailResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const player = detail?.player;
  const recentJoinsLeaves = detail?.recentEvents.filter((event) => event.eventType === 'PLAYER_JOIN' || event.eventType === 'PLAYER_LEAVE') ?? [];
  const recentEvents = detail?.recentEvents ?? [];
  const serversPlayed = detail ? Array.from(new Set([detail.serverId, detail.player.serverId])).filter(Boolean) : [selectedPlayer.serverId];

  return (
    <div className="operator-player-drawer-shell" role="presentation">
      <button type="button" className="operator-player-drawer-backdrop" aria-label="Close player detail" onClick={onClose} />
      <aside className="operator-player-drawer" aria-label={`Player detail for ${selectedPlayer.displayName}`}>
        <div className="operator-player-drawer-header">
          <div>
            <span className="summary-label">Player Detail</span>
            <h2>{player?.displayName ?? selectedPlayer.displayName}</h2>
            <p>{selectedPlayer.serverDisplayName} · {selectedPlayer.game}</p>
          </div>
          <button type="button" className="player-drawer-close" onClick={onClose}>Close</button>
        </div>

        {loading ? <p className="operator-loading">Loading trusted player telemetry...</p> : null}
        {error ? <p className="player-drawer-error">{error}</p> : null}

        {detail ? (
          <>
            <section className="operator-player-drawer-section">
              <div className="operator-player-detail-status">
                <span className={`state-pill ${player?.isOnline ? 'state-ok' : 'state-unknown'}`}>
                  {player?.isOnline ? 'online' : 'offline'}
                </span>
                <span className={`operator-confidence-badge operator-confidence-${player?.identityConfidence === 'unknown' ? 'low' : player?.identityConfidence}`}>
                  {player?.identityConfidence} confidence
                </span>
              </div>
              <p className="subtle">{detail.status}</p>
            </section>

            <section className="operator-player-drawer-section">
              <h3>Player</h3>
              <dl className="operator-player-detail-grid">
                <div><dt>First seen</dt><dd>{formatTimestamp(player?.firstSeenAt ?? null)}</dd></div>
                <div><dt>Last seen</dt><dd>{formatTimestamp(player?.lastSeenAt ?? null)}</dd></div>
                <div><dt>Sessions</dt><dd>{player?.sessionCount ?? 0}</dd></div>
                <div><dt>Total playtime</dt><dd>{formatMinutes(Math.floor((player?.trackedPlaytimeSeconds ?? 0) / 60))}</dd></div>
                <div><dt>Average session</dt><dd>{formatMinutes(Math.floor((player?.averageSessionSeconds ?? 0) / 60))}</dd></div>
                <div><dt>Existing trend</dt><dd>{selectedPlayer.trend}</dd></div>
              </dl>
            </section>

            <section className="operator-player-drawer-section">
              <h3>Recent session timeline</h3>
              <ul className="operator-player-detail-list">
                {detail.recentSessions.length === 0 ? <li>No recent sessions stored yet.</li> : null}
                {detail.recentSessions.slice(0, 8).map((session) => (
                  <li key={session.sessionId}>
                    <span>{formatTimestamp(session.startedAt)}</span>
                    <span>{session.endedAt ? formatMinutes(Math.floor(session.durationSeconds / 60)) : 'active'}</span>
                    <span>{session.closeReason ?? session.explanation}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="operator-player-drawer-section">
              <h3>Recent joins/leaves</h3>
              <ul className="operator-player-detail-list">
                {recentJoinsLeaves.length === 0 ? <li>No recent join or leave events found.</li> : null}
                {recentJoinsLeaves.slice(0, 8).map((event) => (
                  <li key={`${event.eventType}:${event.occurredAt}:${event.id ?? event.playerName ?? 'event'}`}>
                    <span>{formatEventLabel(event.eventType)}</span>
                    <span>{formatTimestamp(event.occurredAt)}</span>
                    <span>{getEventDescription(event)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="operator-player-drawer-section">
              <h3>Recent events</h3>
              <ul className="operator-player-detail-list">
                {recentEvents.length === 0 ? <li>No recent matching events found.</li> : null}
                {recentEvents.slice(0, 8).map((event) => (
                  <li key={`${event.eventType}:${event.occurredAt}:${event.id ?? event.playerName ?? 'event'}`}>
                    <span>{formatEventLabel(event.eventType)}</span>
                    <span>{formatTimestamp(event.occurredAt)}</span>
                    <span>{getEventDescription(event)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="operator-player-drawer-section">
              <h3>Session duration history</h3>
              <div className="operator-session-bars">
                {detail.recentSessions.length === 0 ? <span className="subtle">No durations available.</span> : null}
                {detail.recentSessions.slice(0, 10).map((session) => {
                  const maxDuration = Math.max(...detail.recentSessions.map((item) => item.durationSeconds), 1);
                  const width = Math.max(6, Math.round((session.durationSeconds / maxDuration) * 100));

                  return (
                    <div key={session.sessionId} className="operator-session-bar-row">
                      <span>{formatTimestamp(session.startedAt)}</span>
                      <span className="operator-session-bar"><span style={{ width: `${width}%` }} /></span>
                      <span>{session.endedAt ? formatMinutes(Math.floor(session.durationSeconds / 60)) : 'active'}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="operator-player-drawer-section">
              <h3>Servers played on</h3>
              <div className="operator-player-token-row">
                {serversPlayed.map((serverId) => <span key={serverId}>{serverId}</span>)}
              </div>
            </section>

            <section className="operator-player-drawer-section">
              <h3>Identity confidence</h3>
              <p className="subtle">{player?.identityExplanation}</p>
              <p className="subtle">Sources: {player?.sourceSummary.length ? player.sourceSummary.join(', ') : 'none recorded'}</p>
            </section>

            <details className="operator-player-drawer-debug">
              <summary>Raw telemetry references</summary>
              <ul>
                {recentEvents.length === 0 ? <li>No raw telemetry references available.</li> : null}
                {recentEvents.map((event) => (
                  <li key={`${event.eventType}:${event.occurredAt}:${event.id ?? event.playerName ?? 'event'}`}>
                    <code>{event.id ?? `${event.eventType}:${event.occurredAt}`}</code>
                    <span>{event.source}</span>
                    <span>{event.raw ? JSON.stringify(event.raw) : 'no raw payload'}</span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        ) : null}
      </aside>
    </div>
  );
}

export function OperatorPlayerIntelligenceCard({ apiBaseUrl, servers }: OperatorPlayerIntelligenceCardProps) {
  const hasPlayers = servers.some((server) => server.summary.totalKnownPlayers > 0);
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedOperatorPlayer | null>(null);
  const [detail, setDetail] = useState<PlayerDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPlayerDetail(): Promise<void> {
      if (!selectedPlayer) {
        setDetail(null);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/servers/${selectedPlayer.serverId}/players/${encodeURIComponent(selectedPlayer.playerId)}/detail`);

        if (!response.ok) {
          throw new Error(response.status === 404 ? 'No trusted detail found for this player yet.' : `Player detail fetch failed with status ${response.status}`);
        }

        const parsed = playerDetailResponseSchema.safeParse(await response.json());

        if (!parsed.success) {
          throw new Error('Player detail payload validation failed.');
        }

        if (isMounted) {
          setDetail(parsed.data);
        }
      } catch (caughtError) {
        if (isMounted) {
          setDetail(null);
          setError(caughtError instanceof Error ? caughtError.message : 'Unknown player detail error.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadPlayerDetail();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, selectedPlayer]);

  return (
    <article className="card operator-player-intelligence-card" aria-label="Player intelligence summary">
      <div className="operator-debug-heading">
        <div>
          <span className="summary-label">Players</span>
          <h2>Player Intelligence</h2>
        </div>
        <span className="state-pill state-unknown">{servers.length} servers</span>
      </div>

      {!hasPlayers ? <p className="operator-empty-note">No player activity captured yet.</p> : null}

      <div className="operator-player-intelligence-list">
        {servers.map((server) => (
          <section className="operator-player-intelligence-row" key={server.summary.serverId}>
            <div className="operator-health-row-heading">
              <div>
                <strong>{server.displayName}</strong>
                <span>{server.game}</span>
              </div>
              <span className="state-pill state-active">{server.summary.activePlayersThisWeek} active</span>
            </div>
            <div className="operator-debug-meta">
              <span>Known: {server.summary.totalKnownPlayers}</span>
              <span>New: {server.summary.newPlayersThisWeek}</span>
              <span>At risk: {server.summary.playersAtRisk.length}</span>
              <span>Most recent: {playerLabel(server.summary.mostRecentPlayer)}</span>
            </div>
            {server.summary.topPlayersByPlaytime.length > 0 ? (
              <ul className="operator-player-mini-list">
                {server.summary.topPlayersByPlaytime.slice(0, 5).map((player) => (
                  <li key={player.playerId}>
                    <button
                      type="button"
                      className="operator-player-link"
                      onClick={() => setSelectedPlayer({
                        serverId: server.summary.serverId,
                        playerId: player.playerId,
                        displayName: player.displayName,
                        serverDisplayName: server.displayName,
                        game: server.game,
                        trend: player.trend
                      })}
                    >
                      {player.displayName}
                    </button>
                    <span>{formatMinutes(player.totalPlaytimeMinutes)} / {player.status}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      {selectedPlayer ? (
        <OperatorPlayerDetailDrawer
          selectedPlayer={selectedPlayer}
          detail={detail}
          loading={loading}
          error={error}
          onClose={() => setSelectedPlayer(null)}
        />
      ) : null}
    </article>
  );
}
