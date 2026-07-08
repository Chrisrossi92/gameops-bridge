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
  type GameOpsAtmospherePreset
} from '../../gameops-v2.tsx';
import palworldFantasyAtmosphere from '../../assets/gameops-v2/atmosphere/gameops-v2-atmosphere-palworld-fantasy-forest-21x9.avif';
import valheimNorthernAtmosphere from '../../assets/gameops-v2/atmosphere/gameops-v2-atmosphere-valheim-northern-forest-21x9.avif';
import type { DashboardTab, ServerOption, ServerSummary } from '../types.ts';
import { getGameLabel, getGameOpsToneFromServerState, getLatestActivityLabel } from '../utils.ts';

interface SupportingStatus {
  label: string;
  summary: string;
}

interface WarningSummaryPreview {
  snippet: string;
}

interface ServerOverviewPageProps {
  selectedServer: ServerOption;
  selectedServerSummary: ServerSummary;
  selectedRecommendedAction: string;
  selectedDecisionTargetTab: DashboardTab;
  selectedDecisionTargetLabel: string;
  selectedOnlinePlayerCount: number;
  selectedBackupStatus: SupportingStatus;
  selectedSettingsStatus: SupportingStatus;
  selectedAlertCount: number;
  selectedWarningSummary: WarningSummaryPreview[];
  selectedAttentionWarnings: string[];
  selectedServerOverviewActivityItems: GameOpsActivityItem[];
  selectedReadableSettingsCount: number;
  activeHighlights: string[];
  telemetryLabel: string;
  designMode?: boolean;
  onSelectDashboardTab: (tab: DashboardTab) => void;
}

function getServerAtmospherePreset(game: ServerOption['game']): GameOpsAtmospherePreset {
  if (game === 'valheim') {
    return 'valheim';
  }

  if (game === 'palworld') {
    return 'fantasy';
  }

  return 'vanilla';
}

function getServerAtmosphereImage(game: ServerOption['game']): string | undefined {
  if (game === 'valheim') {
    return valheimNorthernAtmosphere;
  }

  if (game === 'palworld') {
    return palworldFantasyAtmosphere;
  }

  return undefined;
}

function getServerAtmosphereFocalPoint(game: ServerOption['game']): string {
  if (game === 'valheim') {
    return '58% 48%';
  }

  if (game === 'palworld') {
    return '62% 48%';
  }

  return '50% 48%';
}

function getServerAtmosphereOverlayOpacity(game: ServerOption['game']): number | undefined {
  if (game === 'valheim') {
    return 0.64;
  }

  if (game === 'palworld') {
    return 0.64;
  }

  return undefined;
}

export function ServerOverviewPage({
  selectedServer,
  selectedServerSummary,
  selectedRecommendedAction,
  selectedDecisionTargetTab,
  selectedDecisionTargetLabel,
  selectedOnlinePlayerCount,
  selectedBackupStatus,
  selectedSettingsStatus,
  selectedAlertCount,
  selectedWarningSummary,
  selectedAttentionWarnings,
  selectedServerOverviewActivityItems,
  selectedReadableSettingsCount,
  activeHighlights,
  telemetryLabel,
  designMode = false,
  onSelectDashboardTab
}: ServerOverviewPageProps) {
  return (
    <GameOpsShell className={`server-v2-shell server-v2-shell-${selectedServer.game}`}>
      <GameOpsPage className="server-v2-page" aria-label={`${selectedServerSummary.displayName} overview`}>
        <GameOpsHero
          eyebrow={`${getGameLabel(selectedServer.game)} Server`}
          title={selectedServerSummary.displayName}
          body={selectedRecommendedAction}
          metricsLabel={`${selectedServerSummary.displayName} server summary`}
          media={(
            <GameOpsHeroMedia
              preset={getServerAtmospherePreset(selectedServer.game)}
              designMode={designMode}
              label={`${selectedServerSummary.displayName} atmosphere`}
              themeClassName={`gameops-theme-${selectedServer.game}`}
              imageSrc={getServerAtmosphereImage(selectedServer.game)}
              focalPoint={getServerAtmosphereFocalPoint(selectedServer.game)}
              crop="cover"
              overlayOpacity={getServerAtmosphereOverlayOpacity(selectedServer.game)}
            />
          )}
          status={<GameOpsStatusPill tone={getGameOpsToneFromServerState(selectedServerSummary.state)}>{selectedServerSummary.state}</GameOpsStatusPill>}
          primaryAction={(
            <GameOpsPrimaryAction onClick={() => onSelectDashboardTab(selectedDecisionTargetTab)}>
              {selectedDecisionTargetTab === 'overview' ? 'Keep Watching' : `Open ${selectedDecisionTargetLabel}`}
            </GameOpsPrimaryAction>
          )}
          metrics={[
            { label: 'Online now', value: selectedOnlinePlayerCount },
            { label: 'Active this week', value: selectedServerSummary.serverAliveRhythm.sevenDays.uniqueActivePlayers },
            { label: 'Last activity', value: getLatestActivityLabel(selectedServerSummary) },
            { label: 'Backup', value: selectedBackupStatus.label }
          ]}
        />

        <GameOpsSection
          eyebrow="Primary information"
          title="World health"
          description="The first read uses only loaded server state, activity, player, data freshness, and recovery evidence."
        >
          <div className="server-v2-primary-grid">
            <GameOpsCard className="server-v2-health-card" tone={getGameOpsToneFromServerState(selectedServerSummary.state)}>
              <div className="server-v2-card-heading">
                <span className="gameops-eyebrow">Health</span>
                <GameOpsStatusPill tone={getGameOpsToneFromServerState(selectedServerSummary.state)}>{selectedServerSummary.state}</GameOpsStatusPill>
              </div>
              <h4>{selectedAlertCount > 0 ? `${selectedAlertCount} attention item${selectedAlertCount === 1 ? '' : 's'}` : 'No immediate action needed'}</h4>
              <p>{selectedWarningSummary[0]?.snippet ?? selectedServerSummary.operationalStatus.explanation}</p>
              {selectedAttentionWarnings.length > 0 ? (
                <ul className="server-v2-quiet-list">
                  {selectedAttentionWarnings.slice(0, 3).map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              ) : null}
            </GameOpsCard>

            <div className="server-v2-signal-stack">
              <GameOpsCard>
                <span className="gameops-eyebrow">Players</span>
                <h4>{selectedOnlinePlayerCount} online now</h4>
                <p>{selectedServerSummary.knownPlayerCount} known players. {selectedServerSummary.serverAliveRhythm.sevenDays.uniqueActivePlayers} active this week.</p>
              </GameOpsCard>
              <GameOpsCard>
                <span className="gameops-eyebrow">Recovery</span>
                <h4>{selectedBackupStatus.label}</h4>
                <p>{selectedBackupStatus.summary}</p>
              </GameOpsCard>
            </div>
          </div>
        </GameOpsSection>

        <GameOpsSection
          eyebrow="Quick actions"
          title="Route into this world"
          description="These routes open existing server tabs. No new controls are introduced."
        >
          <div className="server-v2-action-grid">
            <GameOpsCard>
              <span className="gameops-eyebrow">Players</span>
              <h4>Who is here?</h4>
              <p>{selectedOnlinePlayerCount} online now.</p>
              <GameOpsPrimaryAction variant="secondary" onClick={() => onSelectDashboardTab('players')}>Open Players</GameOpsPrimaryAction>
            </GameOpsCard>
            <GameOpsCard>
              <span className="gameops-eyebrow">Backups</span>
              <h4>Can I recover?</h4>
              <p>{selectedBackupStatus.label}</p>
              <GameOpsPrimaryAction variant="secondary" onClick={() => onSelectDashboardTab('backups')}>Open Backups</GameOpsPrimaryAction>
            </GameOpsCard>
            <GameOpsCard>
              <span className="gameops-eyebrow">Settings</span>
              <h4>Configuration</h4>
              <p>{selectedSettingsStatus.label}</p>
              <GameOpsPrimaryAction variant="secondary" onClick={() => onSelectDashboardTab('settings')}>Open Settings</GameOpsPrimaryAction>
            </GameOpsCard>
            <GameOpsCard>
              <span className="gameops-eyebrow">History</span>
              <h4>What happened?</h4>
              <p>{selectedServerSummary.activityLog.length} activity records.</p>
              <GameOpsPrimaryAction variant="secondary" onClick={() => onSelectDashboardTab('history')}>Open History</GameOpsPrimaryAction>
            </GameOpsCard>
          </div>
        </GameOpsSection>

        <GameOpsSection
          eyebrow="Recent activity"
          title="What just happened?"
          description="Recent activity is shown from loaded activity records first, then recent server events when activity records are unavailable."
        >
          <GameOpsActivityList
            items={selectedServerOverviewActivityItems}
            emptyTitle="No recent activity"
            emptyDescription="This server has not loaded join, leave, session, or recent event activity yet."
          />
        </GameOpsSection>

        <details className="server-v2-details-disclosure">
          <summary>Expandable details</summary>
          <div className="server-v2-detail-grid">
            <GameOpsCard>
              <span className="gameops-eyebrow">Technical diagnostics</span>
              <dl className="gameops-detail-list">
                <div><dt>Connector</dt><dd>{selectedServerSummary.operationalStatus.connectorStatus}</dd></div>
                <div><dt>Telemetry</dt><dd>{telemetryLabel}</dd></div>
                <div><dt>Configured</dt><dd>{selectedServerSummary.operationalStatus.configured ? 'yes' : 'no'}</dd></div>
                <div><dt>Data</dt><dd>{selectedServerSummary.dataFreshness.status}</dd></div>
              </dl>
            </GameOpsCard>
            <GameOpsCard>
              <span className="gameops-eyebrow">Supporting evidence</span>
              <dl className="gameops-detail-list">
                <div><dt>Readable settings</dt><dd>{selectedReadableSettingsCount}</dd></div>
                <div><dt>Backup files</dt><dd>{selectedServerSummary.palworldBackupReadiness?.filesToBackup.length ?? 0}</dd></div>
                <div><dt>Highlights</dt><dd>{activeHighlights.length}</dd></div>
                <div><dt>Capabilities</dt><dd>{selectedServerSummary.operationalStatus.capabilities.length}</dd></div>
              </dl>
            </GameOpsCard>
          </div>
        </details>
      </GameOpsPage>
    </GameOpsShell>
  );
}
