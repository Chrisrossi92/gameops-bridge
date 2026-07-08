import {
  GameOpsCard,
  GameOpsHero,
  GameOpsHeroMedia,
  GameOpsPage,
  GameOpsPrimaryAction,
  GameOpsSection,
  GameOpsShell,
  GameOpsStatusPill
} from '../../gameops-v2.tsx';
import type { DashboardTab, ServerOption, ServerSummary, WorldCard } from '../types.ts';
import { formatCapabilityState, formatWritePathStatus, getGameLabel, getGameOpsToneFromOperationTone } from '../utils.ts';

type AdministrationReferenceTone = 'ok' | 'warning' | 'offline' | 'unknown';

interface AdministrationReferenceItem {
  server: ServerOption;
  summary: ServerSummary | null;
  tone: AdministrationReferenceTone;
  label: string;
  title: string;
  detail: string;
  maintenance: string;
  source: string;
}

interface SettingsMaintenancePageProps {
  serverOptions: ServerOption[];
  worldCards: WorldCard[];
  onOpenServerTab: (server: ServerOption, tab: DashboardTab) => void;
  designMode?: boolean;
}

function buildAdministrationReferenceItems(worldCards: WorldCard[]): AdministrationReferenceItem[] {
  return worldCards.map<AdministrationReferenceItem>(({ server, summary }) => {
    if (!summary) {
      return {
        server,
        summary: null,
        tone: 'unknown',
        label: 'Loading reference',
        title: server.displayName,
        detail: 'Configuration and maintenance reference has not loaded for this server yet.',
        maintenance: 'Open the server console when data is available.',
        source: 'Configured server'
      };
    }

    const capabilities = summary.settingsCapabilities;
    const canRead = capabilities.canReadSettings === 'yes';
    const canWrite = capabilities.canWriteSettings === 'yes';
    const backupReadiness = summary.palworldBackupReadiness;
    const tone: AdministrationReferenceTone = canWrite
      ? 'warning'
      : canRead
        ? 'ok'
        : capabilities.canReadSettings === 'unknown'
          ? 'unknown'
          : 'offline';

    return {
      server,
      summary,
      tone,
      label: canWrite ? 'write path visible' : `read path ${formatCapabilityState(capabilities.canReadSettings)}`,
      title: summary.displayName,
      detail: `${getGameLabel(summary.game)} settings reference: ${capabilities.nextSafeStep}`,
      maintenance: backupReadiness
        ? `Backup readiness: ${backupReadiness.readinessStatus}.`
        : 'No backup readiness evidence is loaded at the top level.',
      source: `${capabilities.readSource} | write path ${formatWritePathStatus(capabilities.writePathStatus)}`
    };
  });
}

export function SettingsMaintenancePage({
  serverOptions,
  worldCards,
  onOpenServerTab,
  designMode = false
}: SettingsMaintenancePageProps) {
  const administrationReferenceItems = buildAdministrationReferenceItems(worldCards);

  return (
    <GameOpsShell className="settings-v2-shell">
      <GameOpsPage className="settings-v2-page" aria-label="Settings and administration reference">
        <GameOpsHero
          eyebrow="Settings"
          title="How is everything configured?"
          body="Configuration, recovery evidence, capabilities, and diagnostics are grouped by world. This surface routes to existing read-only maintenance tabs and does not add write controls."
          metricsLabel="Settings and maintenance summary"
          media={<GameOpsHeroMedia preset="settings" designMode={designMode} label="Settings atmosphere" themeClassName="gameops-theme-settings" focalPoint="52% 48%" />}
          status={<GameOpsStatusPill tone={worldCards.some(({ summary }) => summary?.settingsCapabilities.canReadSettings === 'yes') ? 'healthy' : 'unknown'}>{serverOptions.length} configured</GameOpsStatusPill>}
          primaryAction={(
            <GameOpsPrimaryAction
              aria-label={administrationReferenceItems[0] ? `Open ${administrationReferenceItems[0].title} settings` : 'Open settings after maintenance reference data loads'}
              disabled={administrationReferenceItems.length === 0}
              onClick={() => {
                const firstReference = administrationReferenceItems[0];
                if (firstReference) {
                  onOpenServerTab(firstReference.server, 'settings');
                }
              }}
            >
              Open Settings
            </GameOpsPrimaryAction>
          )}
          metrics={[
            { label: 'Configured servers', value: serverOptions.length },
            { label: 'Readable settings', value: worldCards.filter(({ summary }) => summary?.settingsCapabilities.canReadSettings === 'yes').length },
            { label: 'Backup evidence', value: worldCards.filter(({ summary }) => Boolean(summary?.palworldBackupReadiness)).length },
            { label: 'Capabilities', value: worldCards.reduce((sum, { summary }) => sum + (summary?.operationalStatus.capabilities.length ?? 0), 0) }
          ]}
        />

        <GameOpsSection
          eyebrow="Primary maintenance"
          title="Maintenance by world"
          description="Start with configuration, recovery, and capability state before opening deeper technical views."
        >
          <div className="settings-v2-world-grid">
            {administrationReferenceItems.length === 0 ? (
              <GameOpsCard className="gameops-empty-card">
                <span className="gameops-eyebrow">No maintenance reference</span>
                <p>Configured server, settings capability, backup, and maintenance reference data has not loaded yet.</p>
              </GameOpsCard>
            ) : null}

            {administrationReferenceItems.map((item) => (
              <GameOpsCard key={item.server.id} className="settings-v2-world-card" tone={getGameOpsToneFromOperationTone(item.tone)}>
                <div className="settings-v2-card-heading">
                  <div>
                    <span className="gameops-eyebrow">{getGameLabel(item.server.game)}</span>
                    <h4>{item.title}</h4>
                  </div>
                  <GameOpsStatusPill tone={getGameOpsToneFromOperationTone(item.tone)}>{item.label}</GameOpsStatusPill>
                </div>
                <p>{item.detail}</p>
                <p>{item.maintenance}</p>
                <div className="settings-v2-route-row">
                  <GameOpsPrimaryAction variant="secondary" onClick={() => onOpenServerTab(item.server, 'settings')}>Settings</GameOpsPrimaryAction>
                  <GameOpsPrimaryAction variant="secondary" onClick={() => onOpenServerTab(item.server, 'backups')}>Backups</GameOpsPrimaryAction>
                  <GameOpsPrimaryAction variant="secondary" onClick={() => onOpenServerTab(item.server, 'capabilities')}>Capabilities</GameOpsPrimaryAction>
                  <GameOpsPrimaryAction variant="secondary" onClick={() => onOpenServerTab(item.server, 'history')}>History</GameOpsPrimaryAction>
                </div>
              </GameOpsCard>
            ))}
          </div>
        </GameOpsSection>

        <GameOpsSection
          eyebrow="Reference areas"
          title="What belongs where?"
          description="Each area routes to existing server detail. No new maintenance actions are introduced here."
        >
          <div className="settings-v2-area-grid">
            <GameOpsCard>
              <span className="gameops-eyebrow">Configuration</span>
              <h4>{worldCards.filter(({ summary }) => summary?.settingsCapabilities.canReadSettings === 'yes').length} readable</h4>
              <p>Open server Settings to inspect readable settings, safety posture, and existing configuration evidence.</p>
            </GameOpsCard>
            <GameOpsCard>
              <span className="gameops-eyebrow">Backups / recovery</span>
              <h4>{worldCards.filter(({ summary }) => Boolean(summary?.palworldBackupReadiness)).length} with evidence</h4>
              <p>Open server Backups for recovery readiness and backup evidence. This does not create or restore backups.</p>
            </GameOpsCard>
            <GameOpsCard>
              <span className="gameops-eyebrow">Capabilities</span>
              <h4>{worldCards.reduce((sum, { summary }) => sum + (summary?.operationalStatus.capabilities.length ?? 0), 0)} loaded</h4>
              <p>Open server Capabilities to inspect connectors, coverage, telemetry, and known limits.</p>
            </GameOpsCard>
            <GameOpsCard>
              <span className="gameops-eyebrow">Diagnostics</span>
              <h4>{worldCards.filter(({ summary }) => summary?.dataFreshness.status !== 'live').length} need review</h4>
              <p>Use History and Capabilities for raw technical evidence, freshness, and connector diagnostics.</p>
            </GameOpsCard>
          </div>
        </GameOpsSection>

        <details className="settings-v2-details-disclosure">
          <summary>Expandable raw technical/reference details</summary>
          <div className="settings-v2-detail-grid">
            {administrationReferenceItems.map((item) => (
              <GameOpsCard key={`detail:${item.server.id}`}>
                <span className="gameops-eyebrow">{item.title}</span>
                <dl className="gameops-detail-list">
                  <div><dt>Source</dt><dd>{item.source}</dd></div>
                  <div><dt>Settings</dt><dd>{item.summary?.settingsCapabilities.canReadSettings ?? 'loading'}</dd></div>
                  <div><dt>Write path</dt><dd>{item.summary?.settingsCapabilities.writePathStatus ?? 'loading'}</dd></div>
                  <div><dt>Data</dt><dd>{item.summary?.dataFreshness.status ?? 'loading'}</dd></div>
                </dl>
              </GameOpsCard>
            ))}
          </div>
        </details>
      </GameOpsPage>
    </GameOpsShell>
  );
}
