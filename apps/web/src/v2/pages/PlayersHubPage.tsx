import {
  GameOpsCard,
  GameOpsHero,
  GameOpsHeroMedia,
  GameOpsPage,
  GameOpsPrimaryAction,
  GameOpsSection,
  GameOpsShell,
  GameOpsStatusPill,
  type GameOpsTone
} from '../../gameops-v2.tsx';
import { useEffect } from 'react';
import type { DashboardTab, ServerOption, WorldCard } from '../types.ts';
import {
  formatDurationFromSeconds,
  formatDurationMaybe,
  formatRelativeTime,
  getGameLabel,
  getGameOpsToneFromServerState,
  normalizePlayerKey
} from '../utils.ts';

type FleetPlayerSource = 'palworld_latest' | 'valheim_intelligence' | 'community_activity';

interface FleetPlayerRow {
  id: string;
  server: ServerOption;
  displayName: string;
  worldName: string;
  gameLabel: string;
  source: FleetPlayerSource;
  playerKey: string;
  playerId: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  statusLabel: string;
  statusTone: GameOpsTone;
  activityLabel: string;
  summaryLabel: string;
  detailLabel: string;
  sourceLabel: string;
}

interface PlayersHubPageProps {
  worldCards: WorldCard[];
  serverOptionsLoading: boolean;
  selectedFleetPlayerId: string | null;
  onSelectFleetPlayer: (playerId: string | null) => void;
  onOpenServerTab: (server: ServerOption, tab: DashboardTab) => void;
  onPreparePalworldPlayer: (playerKey: string) => void;
  onPrepareValheimPlayer: (playerId: string | null, playerKey: string) => void;
  designMode?: boolean;
}

function buildFleetPlayerRows(worldCards: WorldCard[]): FleetPlayerRow[] {
  const rows = worldCards.flatMap<FleetPlayerRow>(({ server, summary }) => {
    if (!summary) {
      return [];
    }

    const playerRows = new Map<string, FleetPlayerRow>();
    const addRow = (row: FleetPlayerRow): void => {
      if (!playerRows.has(row.id)) {
        playerRows.set(row.id, row);
      }
    };

    if (summary.game === 'palworld') {
      summary.palworldLatestPlayers.forEach((player) => {
        const displayName = player.playerName ?? player.accountName ?? player.lookupKey;
        addRow({
          id: `palworld:${server.id}:${player.lookupKey}`,
          server,
          displayName,
          worldName: summary.displayName,
          gameLabel: getGameLabel(summary.game),
          source: 'palworld_latest',
          playerKey: player.lookupKey,
          playerId: player.playerId ?? null,
          isOnline: player.isOnline,
          lastSeenAt: player.lastSeenAt,
          statusLabel: player.isOnline ? 'online' : 'offline',
          statusTone: player.isOnline ? 'healthy' : 'neutral',
          activityLabel: player.isOnline
            ? `session ${formatDurationMaybe(player.currentSessionDurationSeconds ?? undefined)}`
            : player.lastSeenAt
              ? `last seen ${formatRelativeTime(player.lastSeenAt)}`
              : 'last seen unknown',
          summaryLabel: `lvl ${player.level ?? 'N/A'} | ${player.region ?? 'unknown region'}`,
          detailLabel: 'Open this Palworld server Players tab for live telemetry, identity, save-link, guild, and raw snapshot evidence.',
          sourceLabel: 'Palworld latest player telemetry'
        });
      });
    }

    summary.playerIntelligence.forEach((player) => {
      addRow({
        id: `intelligence:${server.id}:${player.playerId}`,
        server,
        displayName: player.displayName,
        worldName: summary.displayName,
        gameLabel: getGameLabel(summary.game),
        source: 'valheim_intelligence',
        playerKey: normalizePlayerKey(player.displayName),
        playerId: player.playerId,
        isOnline: player.isOnline,
        lastSeenAt: player.lastSeenAt,
        statusLabel: player.isOnline ? 'online' : 'offline',
        statusTone: player.isOnline ? 'healthy' : player.identityConfidence === 'low' || player.identityConfidence === 'unknown' ? 'warning' : 'neutral',
        activityLabel: player.lastSeenAt ? `last seen ${formatRelativeTime(player.lastSeenAt)}` : 'last seen unknown',
        summaryLabel: `${player.sessionCount} sessions | ${formatDurationFromSeconds(player.totalTrackedSeconds)} tracked`,
        detailLabel: 'Open this server Players tab for identity confidence, session history, character records, and raw evidence.',
        sourceLabel: `${player.identityConfidence} identity confidence`
      });
    });

    const communityPlayers = [
      ...summary.communityActivity.returningPlayers.map((player) => ({ player, label: 'returning player' })),
      ...summary.communityActivity.recentlyActive.map((player) => ({ player, label: 'recently active player' }))
    ];

    communityPlayers.forEach(({ player, label }) => {
      const normalizedKey = normalizePlayerKey(player.displayName);
      addRow({
        id: `community:${server.id}:${player.playerId}`,
        server,
        displayName: player.displayName,
        worldName: summary.displayName,
        gameLabel: getGameLabel(summary.game),
        source: 'community_activity',
        playerKey: normalizedKey,
        playerId: player.playerId,
        isOnline: false,
        lastSeenAt: player.lastSeenAt,
        statusLabel: label,
        statusTone: 'neutral',
        activityLabel: player.lastSeenAt ? `last seen ${formatRelativeTime(player.lastSeenAt)}` : 'last seen unknown',
        summaryLabel: `${player.sessionCount} ${player.sessionCount === 1 ? 'session' : 'sessions'} | ${player.label}`,
        detailLabel: 'Open this server Players tab for the full source-backed player record and related sessions.',
        sourceLabel: 'Community activity summary'
      });
    });

    return Array.from(playerRows.values());
  });

  return rows.sort((left, right) => {
    if (left.isOnline !== right.isOnline) {
      return left.isOnline ? -1 : 1;
    }

    if (!left.lastSeenAt && !right.lastSeenAt) {
      return left.displayName.localeCompare(right.displayName);
    }

    if (!left.lastSeenAt) {
      return 1;
    }

    if (!right.lastSeenAt) {
      return -1;
    }

    return new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime();
  });
}

function buildFleetPlayerTotals(worldCards: WorldCard[]) {
  return worldCards.reduce(
    (totals, { summary }) => {
      if (!summary) {
        return totals;
      }

      const onlineNow = summary.game === 'palworld'
        ? summary.palworldLatestPlayers.filter((player) => player.isOnline).length || summary.activePlayers
        : summary.activePlayers;

      return {
        onlineNow: totals.onlineNow + onlineNow,
        recentlyActive: totals.recentlyActive + summary.serverAliveRhythm.sevenDays.uniqueActivePlayers,
        knownPlayers: totals.knownPlayers + summary.knownPlayerCount,
        returningPlayers: totals.returningPlayers + summary.communityActivity.returningPlayers.length,
        quietPlayers: totals.quietPlayers + summary.communityActivity.quietPlayers.length,
        loadedWorlds: totals.loadedWorlds + 1,
        sourceRows: totals.sourceRows + summary.playerIntelligence.length + summary.palworldLatestPlayers.length + summary.communityActivity.recentlyActive.length + summary.communityActivity.returningPlayers.length
      };
    },
    {
      onlineNow: 0,
      recentlyActive: 0,
      knownPlayers: 0,
      returningPlayers: 0,
      quietPlayers: 0,
      loadedWorlds: 0,
      sourceRows: 0
    }
  );
}

function getDefaultFleetPlayerId(worldCards: WorldCard[]): string | null {
  return buildFleetPlayerRows(worldCards)[0]?.id ?? null;
}

function hasFleetPlayerId(worldCards: WorldCard[], playerId: string): boolean {
  return buildFleetPlayerRows(worldCards).some((row) => row.id === playerId);
}

export function PlayersHubPage({
  worldCards,
  serverOptionsLoading,
  selectedFleetPlayerId,
  onSelectFleetPlayer,
  onOpenServerTab,
  onPreparePalworldPlayer,
  onPrepareValheimPlayer,
  designMode = false
}: PlayersHubPageProps) {
  const fleetPlayerRows = buildFleetPlayerRows(worldCards);
  const fleetPlayerTotals = buildFleetPlayerTotals(worldCards);
  const selectedFleetPlayer = fleetPlayerRows.find((row) => row.id === selectedFleetPlayerId) ?? fleetPlayerRows[0] ?? null;

  useEffect(() => {
    const defaultFleetPlayerId = getDefaultFleetPlayerId(worldCards);

    if (!defaultFleetPlayerId) {
      if (selectedFleetPlayerId !== null) {
        onSelectFleetPlayer(null);
      }
      return;
    }

    if (!selectedFleetPlayerId || !hasFleetPlayerId(worldCards, selectedFleetPlayerId)) {
      onSelectFleetPlayer(defaultFleetPlayerId);
    }
  }, [onSelectFleetPlayer, selectedFleetPlayerId, worldCards]);

  const openFleetPlayer = (row: FleetPlayerRow): void => {
    if (row.source === 'palworld_latest') {
      onPreparePalworldPlayer(row.playerKey);
    }

    if (row.source === 'valheim_intelligence' && row.playerId) {
      onPrepareValheimPlayer(row.playerId, row.playerKey);
    }

    if (row.source === 'community_activity' && row.server.game === 'valheim') {
      onPrepareValheimPlayer(null, row.playerKey);
    }

    onOpenServerTab(row.server, 'players');
  };

  return (
    <GameOpsShell className="fleet-players-v2-shell">
      <GameOpsPage className="fleet-players-v2-page" aria-label="Players">
        <GameOpsHero
          eyebrow="Players"
          title="Who is active across my worlds?"
          body="Fleet-wide player activity is built from loaded server summaries, session telemetry, player intelligence, and community activity. Detailed identity, guild, save, character, and raw evidence remain inside each server Players tab."
          metricsLabel="Fleet player summary"
          media={<GameOpsHeroMedia preset="players" designMode={designMode} label="Players atmosphere" themeClassName="gameops-theme-players" focalPoint="50% 52%" />}
          status={<GameOpsStatusPill tone={fleetPlayerTotals.onlineNow > 0 ? 'healthy' : fleetPlayerTotals.loadedWorlds > 0 ? 'neutral' : 'unknown'}>{fleetPlayerTotals.onlineNow} online now</GameOpsStatusPill>}
          primaryAction={(
            <GameOpsPrimaryAction
              aria-label={selectedFleetPlayer ? `Open ${selectedFleetPlayer.displayName} in ${selectedFleetPlayer.worldName} Players` : 'Open player detail after selecting a loaded player'}
              onClick={() => {
                if (selectedFleetPlayer) {
                  openFleetPlayer(selectedFleetPlayer);
                }
              }}
              disabled={!selectedFleetPlayer}
            >
              Open Player Detail
            </GameOpsPrimaryAction>
          )}
          metrics={[
            { label: 'Recently active', value: fleetPlayerTotals.recentlyActive },
            { label: 'Known players', value: fleetPlayerTotals.knownPlayers },
            { label: 'Returning', value: fleetPlayerTotals.returningPlayers },
            { label: 'Quiet', value: fleetPlayerTotals.quietPlayers }
          ]}
        />

        <GameOpsSection
          eyebrow="Primary information"
          title="Fleet player activity"
          description="Online players sort first, followed by recently seen players with their world context and source label."
        >
          <div className="fleet-players-v2-master-detail">
            <GameOpsCard className="fleet-players-v2-master-card">
              <div className="fleet-players-v2-master-heading">
                <div>
                  <span className="gameops-eyebrow">Master list</span>
                  <h4>Players by world</h4>
                </div>
                <GameOpsStatusPill tone="neutral">{fleetPlayerRows.length} loaded</GameOpsStatusPill>
              </div>

              {fleetPlayerRows.length === 0 ? (
                <div className="fleet-players-v2-empty">
                  No fleet player rows are loaded yet. Player rows appear after server summaries include telemetry, player intelligence, or community activity records.
                </div>
              ) : null}

              <div className="fleet-players-v2-list" role="list" aria-label="Fleet player list">
                {worldCards.map(({ server, summary }) => {
                  const rows = fleetPlayerRows.filter((row) => row.server.id === server.id);

                  if (rows.length === 0) {
                    return null;
                  }

                  return (
                    <section key={`fleet-player-group:${server.id}`} className="fleet-players-v2-group" aria-label={`${summary?.displayName ?? server.displayName} players`}>
                      <div className="fleet-players-v2-group-heading">
                        <span>{summary?.displayName ?? server.displayName}</span>
                        <small>{getGameLabel(server.game)} | {rows.length} players</small>
                      </div>
                      {rows.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          className={`fleet-players-v2-row ${selectedFleetPlayer?.id === row.id ? 'selected' : ''}`}
                          aria-pressed={selectedFleetPlayer?.id === row.id}
                          aria-label={`${row.displayName}, ${row.statusLabel}, ${row.worldName}, ${row.sourceLabel}`}
                          onClick={() => onSelectFleetPlayer(row.id)}
                        >
                          <span className="fleet-players-v2-row-main">
                            <strong>{row.displayName}</strong>
                            <span>{row.activityLabel}</span>
                          </span>
                          <span className="fleet-players-v2-row-meta">
                            <GameOpsStatusPill tone={row.statusTone}>{row.statusLabel}</GameOpsStatusPill>
                            <small>{row.sourceLabel}</small>
                          </span>
                        </button>
                      ))}
                    </section>
                  );
                })}
              </div>
            </GameOpsCard>

            <GameOpsCard className="fleet-players-v2-detail-card" tone={selectedFleetPlayer?.statusTone ?? 'unknown'}>
              <span className="gameops-eyebrow">Selected player</span>
              {selectedFleetPlayer ? (
                <>
                  <div className="fleet-players-v2-detail-heading">
                    <div>
                      <h4>{selectedFleetPlayer.displayName}</h4>
                      <p>{selectedFleetPlayer.worldName} | {selectedFleetPlayer.gameLabel}</p>
                    </div>
                    <GameOpsStatusPill tone={selectedFleetPlayer.statusTone}>{selectedFleetPlayer.statusLabel}</GameOpsStatusPill>
                  </div>
                  <p>{selectedFleetPlayer.detailLabel}</p>
                  <dl className="gameops-detail-list">
                    <div><dt>Activity</dt><dd>{selectedFleetPlayer.activityLabel}</dd></div>
                    <div><dt>Summary</dt><dd>{selectedFleetPlayer.summaryLabel}</dd></div>
                    <div><dt>Source</dt><dd>{selectedFleetPlayer.sourceLabel}</dd></div>
                    <div><dt>World</dt><dd>{selectedFleetPlayer.worldName}</dd></div>
                  </dl>
                  <div className="fleet-players-v2-route-row">
                    <GameOpsPrimaryAction onClick={() => openFleetPlayer(selectedFleetPlayer)}>Open Players</GameOpsPrimaryAction>
                    <GameOpsPrimaryAction variant="secondary" onClick={() => onOpenServerTab(selectedFleetPlayer.server, 'history')}>Open History</GameOpsPrimaryAction>
                  </div>
                </>
              ) : (
                <p>Select a player once telemetry, player intelligence, or community activity has loaded.</p>
              )}
            </GameOpsCard>
          </div>
        </GameOpsSection>

        <GameOpsSection
          eyebrow="World context"
          title="Known player coverage"
          description="Each world remains the owner of its detailed player records. These cards route to existing server Players tabs."
        >
          <div className="fleet-players-v2-world-grid">
            {worldCards.length === 0 && !serverOptionsLoading ? (
              <GameOpsCard className="gameops-empty-card">
                <span className="gameops-eyebrow">No worlds available</span>
                <p>Configured server data is required before player surfaces can be grouped by world.</p>
              </GameOpsCard>
            ) : null}

            {worldCards.map(({ server, summary }) => {
              const onlineNow = summary?.game === 'palworld'
                ? summary.palworldLatestPlayers.filter((player) => player.isOnline).length || summary.activePlayers
                : summary?.activePlayers ?? 0;

              return (
                <GameOpsCard key={`fleet-player-world:${server.id}`} className="fleet-players-v2-world-card" tone={getGameOpsToneFromServerState(summary?.state)}>
                  <div className="fleet-players-v2-card-heading">
                    <div>
                      <span className="gameops-eyebrow">{getGameLabel(server.game)}</span>
                      <h4>{summary?.displayName ?? server.displayName}</h4>
                    </div>
                    <GameOpsStatusPill tone={getGameOpsToneFromServerState(summary?.state)}>{summary?.state ?? 'loading'}</GameOpsStatusPill>
                  </div>
                  <p>{summary ? `${onlineNow} online now. ${summary.serverAliveRhythm.sevenDays.uniqueActivePlayers} active this week.` : 'Player data is still loading for this world.'}</p>
                  <dl className="fleet-players-v2-stat-grid">
                    <div><dt>Known</dt><dd>{summary?.knownPlayerCount ?? 0}</dd></div>
                    <div><dt>Returning</dt><dd>{summary?.communityActivity.returningPlayers.length ?? 0}</dd></div>
                    <div><dt>Quiet</dt><dd>{summary?.communityActivity.quietPlayers.length ?? 0}</dd></div>
                    <div><dt>Rows</dt><dd>{fleetPlayerRows.filter((row) => row.server.id === server.id).length}</dd></div>
                  </dl>
                  <GameOpsPrimaryAction variant="secondary" onClick={() => onOpenServerTab(server, 'players')}>Open Players</GameOpsPrimaryAction>
                </GameOpsCard>
              );
            })}
          </div>
        </GameOpsSection>

        <details className="fleet-players-v2-details-disclosure">
          <summary>Expandable raw / source-backed details</summary>
          <div className="fleet-players-v2-detail-grid">
            <GameOpsCard>
              <span className="gameops-eyebrow">Loaded sources</span>
              <dl className="gameops-detail-list">
                <div><dt>Worlds loaded</dt><dd>{fleetPlayerTotals.loadedWorlds}</dd></div>
                <div><dt>Player rows</dt><dd>{fleetPlayerRows.length}</dd></div>
                <div><dt>Source rows</dt><dd>{fleetPlayerTotals.sourceRows}</dd></div>
                <div><dt>Online now</dt><dd>{fleetPlayerTotals.onlineNow}</dd></div>
              </dl>
            </GameOpsCard>
            <GameOpsCard>
              <span className="gameops-eyebrow">Raw access</span>
              <p>Identity evidence, session timelines, guild records, save-link data, characters, and raw telemetry remain in each server Players tab.</p>
              <GameOpsPrimaryAction
                variant="secondary"
                onClick={() => {
                  if (selectedFleetPlayer) {
                    openFleetPlayer(selectedFleetPlayer);
                  }
                }}
                disabled={!selectedFleetPlayer}
              >
                Open selected server
              </GameOpsPrimaryAction>
            </GameOpsCard>
          </div>
        </details>
      </GameOpsPage>
    </GameOpsShell>
  );
}
