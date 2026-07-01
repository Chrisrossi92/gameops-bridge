/* @jsxRuntime classic */
import type { ServerHealthSummary } from '@gameops/shared';
import React from 'react';

export interface OperatorServerHealthEntry {
  displayName: string;
  game: string;
  health: ServerHealthSummary;
}

interface OperatorServerHealthCardProps {
  servers: OperatorServerHealthEntry[];
}

function formatHealthTime(value: string | null): string {
  if (!value) {
    return 'never';
  }

  return value.replace(/\.\d{3}Z$/, 'Z').replace('T', ' ');
}

export function OperatorServerHealthCard({ servers }: OperatorServerHealthCardProps) {
  return (
    <article className="card operator-server-health-card" aria-label="Server health summary">
      <div className="operator-debug-heading">
        <div>
          <span className="summary-label">Health</span>
          <h2>Server Health</h2>
        </div>
        <span className="state-pill state-unknown">{servers.length} servers</span>
      </div>

      <div className="operator-health-list">
        {servers.map((server) => (
          <section className="operator-health-row" key={server.health.serverId}>
            <div className="operator-health-row-heading">
              <div>
                <strong>{server.displayName}</strong>
                <span>{server.game}</span>
              </div>
              <span className={`state-pill state-${server.health.status}`}>
                {server.health.status}
              </span>
            </div>
            <p>{server.health.headline}</p>
            <div className="operator-debug-meta">
              <span>Players: {server.health.currentPlayers}</span>
              <span>Week: {server.health.uniquePlayersThisWeek}</span>
              <span>Last activity: {formatHealthTime(server.health.lastPlayerActivityAt)}</span>
              <span>World save: {formatHealthTime(server.health.lastWorldSaveAt)}</span>
              <span>Collectors: {server.health.collectorHealth.status}</span>
              <span>Log Truth: {server.health.logTruthHealth?.status ?? 'unknown'}</span>
              <span>Sessions: {server.health.sessionHealth.status}</span>
            </div>
            {server.health.recommendedAction ? (
              <div className="operator-health-action">{server.health.recommendedAction}</div>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}
