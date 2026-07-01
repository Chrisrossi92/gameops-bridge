/* @jsxRuntime classic */
import type { PlayerIntelligenceSummaryResponse, PlayerIntelligenceSummaryRow } from '@gameops/shared';
import React from 'react';

export interface OperatorPlayerIntelligenceEntry {
  displayName: string;
  game: string;
  summary: PlayerIntelligenceSummaryResponse;
}

interface OperatorPlayerIntelligenceCardProps {
  servers: OperatorPlayerIntelligenceEntry[];
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

export function OperatorPlayerIntelligenceCard({ servers }: OperatorPlayerIntelligenceCardProps) {
  const hasPlayers = servers.some((server) => server.summary.totalKnownPlayers > 0);

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
                    <span>{player.displayName}</span>
                    <span>{formatMinutes(player.totalPlaytimeMinutes)} / {player.status}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}
