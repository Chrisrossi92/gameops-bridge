/* @jsxRuntime classic */
import type { CommunityActivityResponse } from '@gameops/shared';
import React from 'react';

export interface OperatorCommunityActivityEntry {
  displayName: string;
  game: string;
  activity: CommunityActivityResponse;
}

interface OperatorCommunityActivityCardProps {
  servers: OperatorCommunityActivityEntry[];
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) {
    return '0m';
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatDelta(value: number, formatter: (input: number) => string = String): string {
  if (value === 0) {
    return 'same';
  }

  return `${value > 0 ? '+' : ''}${formatter(value)}`;
}

function formatHour(hourUtc: number): string {
  const hour = String(hourUtc).padStart(2, '0');
  return `${hour}:00 UTC`;
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <li className="operator-community-empty">{children}</li>;
}

export function OperatorCommunityActivityCard({ servers }: OperatorCommunityActivityCardProps) {
  const hasActivity = servers.some((server) => server.activity.sevenDaySnapshot.sessionCount > 0 || server.activity.recentlyActive.length > 0);

  return (
    <article className="card operator-community-activity-card" aria-label="Community activity">
      <div className="operator-debug-heading">
        <div>
          <span className="summary-label">Community</span>
          <h2>Community Activity</h2>
        </div>
        <span className="state-pill state-unknown">{servers.length} servers</span>
      </div>

      {!hasActivity ? <p className="operator-empty-note">No community activity captured yet.</p> : null}

      <div className="operator-community-list">
        {servers.map((server) => {
          const snapshot = server.activity.sevenDaySnapshot;
          const comparison = server.activity.sevenDayComparison;

          return (
            <section className="operator-community-row" key={server.activity.serverId}>
              <div className="operator-health-row-heading">
                <div>
                  <strong>{server.displayName}</strong>
                  <span>{server.game}</span>
                </div>
                <span className="state-pill state-active">{snapshot.uniquePlayers} active</span>
              </div>

              <div className="operator-community-snapshot">
                <div><span>Sessions</span><strong>{snapshot.sessionCount}</strong></div>
                <div><span>Players</span><strong>{snapshot.uniquePlayers}</strong></div>
                <div><span>Playtime</span><strong>{formatDuration(snapshot.totalPlaytimeSeconds)}</strong></div>
                <div><span>Avg session</span><strong>{formatDuration(snapshot.averageSessionSeconds)}</strong></div>
              </div>

              <div className="operator-community-comparison">
                <span>7d vs previous</span>
                <strong>{formatDelta(comparison.sessions.delta)} sessions</strong>
                <strong>{formatDelta(comparison.uniquePlayers.delta)} players</strong>
                <strong>{formatDelta(comparison.totalPlaytimeSeconds.delta, formatDuration)} playtime</strong>
              </div>

              <div className="operator-community-grid">
                <section>
                  <h3>Returning Players</h3>
                  <ul>
                    {server.activity.returningPlayers.length === 0 ? <EmptyLine>Not enough spaced session history yet.</EmptyLine> : null}
                    {server.activity.returningPlayers.slice(0, 4).map((player) => (
                      <li key={player.playerId}><span>{player.displayName}</span><span>{player.label}</span></li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3>Recently Active</h3>
                  <ul>
                    {server.activity.recentlyActive.length === 0 ? <EmptyLine>No recent players observed.</EmptyLine> : null}
                    {server.activity.recentlyActive.slice(0, 4).map((player) => (
                      <li key={player.playerId}><span>{player.displayName}</span><span>{player.label}</span></li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3>Quiet Players</h3>
                  <ul>
                    {server.activity.quietPlayers.length === 0 ? <EmptyLine>No quiet players with enough history.</EmptyLine> : null}
                    {server.activity.quietPlayers.slice(0, 4).map((player) => (
                      <li key={player.playerId}><span>{player.displayName}</span><span>{player.label}</span></li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3>Peak Play Hours</h3>
                  <ul>
                    {server.activity.peakPlayHours.length === 0 ? <EmptyLine>No peak hour pattern yet.</EmptyLine> : null}
                    {server.activity.peakPlayHours.slice(0, 4).map((hour) => (
                      <li key={hour.hourUtc}>
                        <span>{formatHour(hour.hourUtc)}</span>
                        <span>{hour.sessionCount} sessions / {formatDuration(hour.totalPlaytimeSeconds)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}
