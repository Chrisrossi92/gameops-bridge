import type { PalworldGuildActivityEntry } from '@gameops/shared';
import {
  GameOpsActivityList,
  GameOpsCard,
  GameOpsHero,
  GameOpsHeroMedia,
  GameOpsPage,
  GameOpsPrimaryAction,
  GameOpsSection,
  GameOpsShell,
  GameOpsStatusPill,
  type GameOpsActivityItem,
  type GameOpsTone
} from '../../gameops-v2.tsx';
import type { DashboardTab, ServerOption, ServerSummary, WorldCard } from '../types.ts';
import { formatRelativeTime, getGameLabel, getLatestActivityLabel } from '../utils.ts';

interface CommunityWorldItem {
  server: ServerOption;
  summary: ServerSummary | null;
  tone: GameOpsTone;
  onlineNow: number;
  activeWeek: number;
  knownPlayers: number;
  returningPlayers: number;
  recentlyActivePlayers: number;
  quietPlayers: number;
  sessionCount: number;
  latestActivity: string;
  groupDetail: string;
}

interface CommunityActivityRecord {
  id: string;
  server: ServerOption;
  title: string;
  detail: string;
  meta: string;
  tone: GameOpsTone;
}

interface CommunityPageProps {
  worldCards: WorldCard[];
  serverOptionsLoading: boolean;
  selectedServer: ServerOption | null;
  guildActivity: PalworldGuildActivityEntry[];
  onOpenPlayersArea: () => void;
  onOpenEventsArea: () => void;
  onOpenServerTab: (server: ServerOption, tab: DashboardTab) => void;
  designMode?: boolean;
}

function buildCommunityWorldItems(worldCards: WorldCard[]): CommunityWorldItem[] {
  return worldCards.map(({ server, summary }) => {
    if (!summary) {
      return {
        server,
        summary: null,
        tone: 'unknown',
        onlineNow: 0,
        activeWeek: 0,
        knownPlayers: 0,
        returningPlayers: 0,
        recentlyActivePlayers: 0,
        quietPlayers: 0,
        sessionCount: 0,
        latestActivity: 'Community activity is still loading for this world.',
        groupDetail: 'Group, guild, base, and character context is available after the server community sources load.'
      };
    }

    const onlineNow = summary.game === 'palworld'
      ? summary.palworldLatestPlayers.filter((player) => player.isOnline).length || summary.activePlayers
      : summary.activePlayers;
    const activity = summary.communityActivity;
    const tone: GameOpsTone = onlineNow > 0
      ? 'healthy'
      : activity.dataWarnings.length > 0
        ? 'warning'
        : activity.sevenDaySnapshot.uniquePlayers > 0
          ? 'neutral'
          : 'unknown';
    const groupDetail = summary.game === 'palworld'
      ? 'Guild and base-oriented records are available inside the Palworld server Players view when loaded.'
      : 'Character, identity, and session context is available inside the Valheim server Players and History views.';

    return {
      server,
      summary,
      tone,
      onlineNow,
      activeWeek: summary.serverAliveRhythm.sevenDays.uniqueActivePlayers,
      knownPlayers: summary.knownPlayerCount,
      returningPlayers: activity.returningPlayers.length,
      recentlyActivePlayers: activity.recentlyActive.length,
      quietPlayers: activity.quietPlayers.length,
      sessionCount: activity.sevenDaySnapshot.sessionCount,
      latestActivity: getLatestActivityLabel(summary),
      groupDetail
    };
  });
}

function buildCommunityTotals(communityWorldItems: CommunityWorldItem[]) {
  return communityWorldItems.reduce(
    (totals, item) => ({
      onlineNow: totals.onlineNow + item.onlineNow,
      activeWeek: totals.activeWeek + item.activeWeek,
      knownPlayers: totals.knownPlayers + item.knownPlayers,
      recentSessions: totals.recentSessions + item.sessionCount,
      worldsWithActivity: totals.worldsWithActivity + (item.activeWeek > 0 || item.onlineNow > 0 ? 1 : 0),
      loadedWorlds: totals.loadedWorlds + (item.summary ? 1 : 0),
      warnings: totals.warnings + (item.summary?.communityActivity.dataWarnings.length ?? 0)
    }),
    {
      onlineNow: 0,
      activeWeek: 0,
      knownPlayers: 0,
      recentSessions: 0,
      worldsWithActivity: 0,
      loadedWorlds: 0,
      warnings: 0
    }
  );
}

function buildCommunityRecentActivityRecords(communityWorldItems: CommunityWorldItem[]): CommunityActivityRecord[] {
  const records = communityWorldItems.flatMap((item) => {
    const summary = item.summary;

    if (!summary) {
      return [];
    }

    const playerRecords = [
      ...summary.communityActivity.returningPlayers.map((player) => ({
        id: `returning:${item.server.id}:${player.playerId}`,
        server: item.server,
        title: player.displayName,
        detail: `${player.label}. ${player.sessionCount} ${player.sessionCount === 1 ? 'session' : 'sessions'} in the loaded activity window.`,
        meta: player.lastSeenAt ? formatRelativeTime(player.lastSeenAt) : 'last seen unknown',
        observedAt: player.lastSeenAt,
        tone: 'healthy' as GameOpsTone
      })),
      ...summary.communityActivity.recentlyActive.map((player) => ({
        id: `recent:${item.server.id}:${player.playerId}`,
        server: item.server,
        title: player.displayName,
        detail: `${player.label}. ${player.sessionCount} ${player.sessionCount === 1 ? 'session' : 'sessions'} in the loaded activity window.`,
        meta: player.lastSeenAt ? formatRelativeTime(player.lastSeenAt) : 'last seen unknown',
        observedAt: player.lastSeenAt,
        tone: 'neutral' as GameOpsTone
      }))
    ];

    const activityRecords = summary.activityLog.slice(0, 2).map((activity) => ({
      id: `activity:${item.server.id}:${activity.timestamp}:${activity.title}`,
      server: item.server,
      title: activity.title,
      detail: activity.description,
      meta: formatRelativeTime(activity.timestamp),
      observedAt: activity.timestamp,
      tone: activity.severity === 'critical'
        ? 'offline' as GameOpsTone
        : activity.severity === 'warning'
          ? 'warning' as GameOpsTone
          : 'neutral' as GameOpsTone
    }));

    return [...playerRecords, ...activityRecords];
  });

  return records
    .sort((left, right) => {
      const leftTime = left.observedAt ? new Date(left.observedAt).getTime() : 0;
      const rightTime = right.observedAt ? new Date(right.observedAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 8)
    .map((record) => ({
      id: record.id,
      server: record.server,
      title: record.title,
      detail: record.detail,
      meta: record.meta,
      tone: record.tone
    }));
}

export function CommunityPage({
  worldCards,
  serverOptionsLoading,
  selectedServer,
  guildActivity,
  onOpenPlayersArea,
  onOpenEventsArea,
  onOpenServerTab,
  designMode = false
}: CommunityPageProps) {
  const communityWorldItems = buildCommunityWorldItems(worldCards);
  const communityTotals = buildCommunityTotals(communityWorldItems);
  const communityRecentActivityRecords = buildCommunityRecentActivityRecords(communityWorldItems);

  return (
    <GameOpsShell className="community-v2-shell">
      <GameOpsPage className="community-v2-page" aria-label="Community">
        <GameOpsHero
          eyebrow="Community"
          title="What is happening socially?"
          body="Community activity is grouped by world using loaded player sessions, activity logs, and source-backed server evidence. Deeper guild, character, base, and raw history records stay in existing server views."
          metricsLabel="Community activity summary"
          media={<GameOpsHeroMedia preset="community" designMode={designMode} label="Community atmosphere" themeClassName="gameops-theme-community" focalPoint="50% 55%" />}
          status={<GameOpsStatusPill tone={communityTotals.onlineNow > 0 ? 'healthy' : communityTotals.warnings > 0 ? 'warning' : communityTotals.loadedWorlds > 0 ? 'neutral' : 'unknown'}>{communityTotals.onlineNow} online now</GameOpsStatusPill>}
          primaryAction={(
            <GameOpsPrimaryAction onClick={onOpenPlayersArea}>
              Open Players
            </GameOpsPrimaryAction>
          )}
          metrics={[
            { label: 'Active this week', value: communityTotals.activeWeek },
            { label: 'Known players', value: communityTotals.knownPlayers },
            { label: 'Worlds with activity', value: `${communityTotals.worldsWithActivity}/${communityWorldItems.length}` },
            { label: 'Recent sessions', value: communityTotals.recentSessions }
          ]}
        />

        <GameOpsSection
          eyebrow="Primary information"
          title="World activity"
          description="Start with who is active and which worlds have visible player activity before opening deeper records."
        >
          <div className="community-v2-world-grid">
            {communityWorldItems.length === 0 && !serverOptionsLoading ? (
              <GameOpsCard className="gameops-empty-card">
                <span className="gameops-eyebrow">No community data loaded</span>
                <p>Configured worlds are needed before community activity can be grouped by server.</p>
              </GameOpsCard>
            ) : null}

            {communityWorldItems.map((item) => (
              <GameOpsCard key={item.server.id} className="community-v2-world-card" tone={item.tone}>
                <div className="community-v2-card-heading">
                  <div>
                    <span className="gameops-eyebrow">{getGameLabel(item.server.game)} community</span>
                    <h4>{item.summary?.displayName ?? item.server.displayName}</h4>
                  </div>
                  <GameOpsStatusPill tone={item.tone}>{item.onlineNow} online</GameOpsStatusPill>
                </div>
                <p>{item.latestActivity}</p>
                <dl className="community-v2-stat-grid">
                  <div><dt>Active week</dt><dd>{item.activeWeek}</dd></div>
                  <div><dt>Recently active</dt><dd>{item.recentlyActivePlayers}</dd></div>
                  <div><dt>Returning</dt><dd>{item.returningPlayers}</dd></div>
                  <div><dt>Quiet</dt><dd>{item.quietPlayers}</dd></div>
                </dl>
                <div className="community-v2-route-row">
                  <GameOpsPrimaryAction variant="secondary" onClick={() => onOpenServerTab(item.server, 'players')}>Players</GameOpsPrimaryAction>
                  <GameOpsPrimaryAction variant="secondary" onClick={onOpenEventsArea}>Events</GameOpsPrimaryAction>
                  <GameOpsPrimaryAction variant="secondary" onClick={() => onOpenServerTab(item.server, 'history')}>History</GameOpsPrimaryAction>
                </div>
              </GameOpsCard>
            ))}
          </div>
        </GameOpsSection>

        <GameOpsSection
          eyebrow="Groups / guilds / bases"
          title="Visible community structures"
          description="Only source-backed group context is shown. When records are not loaded at this level, the card explains where the existing detail lives."
        >
          <div className="community-v2-structure-grid">
            {selectedServer?.game === 'palworld' && guildActivity.length > 0 ? (
              <>
                {guildActivity.slice(0, 3).map((guild) => (
                  <GameOpsCard key={guild.guildName} className="community-v2-structure-card">
                    <span className="gameops-eyebrow">Selected Palworld guild</span>
                    <h4>{guild.guildName}</h4>
                    <p>{guild.lastMemberSeenAt ? `Last member activity ${formatRelativeTime(guild.lastMemberSeenAt)}.` : 'No matched member activity is loaded for this guild yet.'}</p>
                    <dl className="community-v2-stat-grid">
                      <div><dt>Members</dt><dd>{guild.memberCount}</dd></div>
                      <div><dt>Risk label</dt><dd>{guild.riskLevel}</dd></div>
                    </dl>
                  </GameOpsCard>
                ))}
                <GameOpsCard className="community-v2-structure-card">
                  <span className="gameops-eyebrow">Source-backed access</span>
                  <h4>{guildActivity.length} guild records loaded</h4>
                  <p>Guild and base-oriented records remain in the selected Palworld server Players view.</p>
                  {selectedServer ? <GameOpsPrimaryAction variant="secondary" onClick={() => onOpenServerTab(selectedServer, 'players')}>Open Players</GameOpsPrimaryAction> : null}
                </GameOpsCard>
              </>
            ) : (
              <GameOpsCard className="gameops-empty-card">
                <span className="gameops-eyebrow">No group records at this level</span>
                <p>Top-level summaries expose player and activity evidence. Guild, base, character, and identity detail is available inside existing server Players views when those sources are loaded.</p>
              </GameOpsCard>
            )}
          </div>
        </GameOpsSection>

        <GameOpsSection
          eyebrow="Recent activity"
          title="Community activity feed"
          description="Recent player and activity records are shown as factual loaded evidence, with routes into the existing server detail."
        >
          <GameOpsActivityList
            items={communityRecentActivityRecords.map<GameOpsActivityItem>((record) => ({
              ...record,
              action: (
                <GameOpsPrimaryAction variant="secondary" onClick={() => onOpenServerTab(record.server, 'players')}>
                  Open players
                </GameOpsPrimaryAction>
              )
            }))}
            emptyTitle="No recent community activity"
            emptyDescription="Loaded community summaries do not contain recent player activity or activity-log records yet. This means the source data is missing here, not that the community is inactive."
          />
        </GameOpsSection>

        <details className="community-v2-details-disclosure">
          <summary>Expandable raw / source-backed details</summary>
          <div className="community-v2-detail-grid">
            {communityWorldItems.length === 0 ? (
              <GameOpsCard className="gameops-empty-card">
                <span className="gameops-eyebrow">No source counts</span>
                <p>No configured world summaries are loaded for Community yet.</p>
              </GameOpsCard>
            ) : null}
            {communityWorldItems.map((item) => (
              <GameOpsCard key={`community-detail:${item.server.id}`}>
                <span className="gameops-eyebrow">{getGameLabel(item.server.game)} sources</span>
                <h4>{item.summary?.displayName ?? item.server.displayName}</h4>
                <p>{item.groupDetail}</p>
                <dl className="gameops-detail-list">
                  <div><dt>Known players</dt><dd>{item.knownPlayers}</dd></div>
                  <div><dt>Seven-day sessions</dt><dd>{item.sessionCount}</dd></div>
                  <div><dt>Activity records</dt><dd>{item.summary?.activityLog.length ?? 0}</dd></div>
                  <div><dt>Recent events</dt><dd>{item.summary?.recentEvents.length ?? 0}</dd></div>
                  <div><dt>Data warnings</dt><dd>{item.summary?.communityActivity.dataWarnings.length ?? 0}</dd></div>
                </dl>
              </GameOpsCard>
            ))}
          </div>
        </details>
      </GameOpsPage>
    </GameOpsShell>
  );
}
