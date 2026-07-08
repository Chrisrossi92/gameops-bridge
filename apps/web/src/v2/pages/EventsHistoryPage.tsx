import {
  GameOpsCard,
  GameOpsHero,
  GameOpsHeroMedia,
  GameOpsPage,
  GameOpsPrimaryAction,
  GameOpsSection,
  GameOpsShell,
  GameOpsStatusPill,
  GameOpsTimelineDetail,
  type GameOpsTimelineItem
} from '../../gameops-v2.tsx';
import type { DashboardTab, ServerOption, ServerSummary, WorldCard } from '../types.ts';
import { getGameLabel } from '../utils.ts';

type OperationTone = 'ok' | 'warning' | 'offline' | 'unknown';

interface CurrentOperationItem {
  server: ServerOption;
  summary: ServerSummary | null;
  tone: OperationTone;
  label: string;
  detail: string;
  activity: string;
}

interface CrossOperationHistoryItem {
  server: ServerOption;
  summary: ServerSummary | null;
  tone: OperationTone;
  label: string;
  title: string;
  detail: string;
  observedAt: string | null;
  source: string;
}

interface EventScheduleDraftItem {
  id: string;
  server: ServerOption;
  summary: ServerSummary;
  draft: ServerSummary['eventTemplateDrafts']['drafts'][number];
}

interface EventsHistoryPageProps {
  currentOperationItems: CurrentOperationItem[];
  crossOperationHistoryItems: CrossOperationHistoryItem[];
  eventTimelineItems: GameOpsTimelineItem[];
  selectedEventsTimelineItemId: string | null;
  eventScheduleDraftItems: EventScheduleDraftItem[];
  worldCards: WorldCard[];
  onSelectEventsTimelineItem: (itemId: string) => void;
  onOpenServerTab: (server: ServerOption, tab: DashboardTab) => void;
  onOpenServersOverview: () => void;
  designMode?: boolean;
}

export function EventsHistoryPage({
  currentOperationItems,
  crossOperationHistoryItems,
  eventTimelineItems,
  selectedEventsTimelineItemId,
  eventScheduleDraftItems,
  worldCards,
  onSelectEventsTimelineItem,
  onOpenServerTab,
  onOpenServersOverview,
  designMode = false
}: EventsHistoryPageProps) {
  return (
    <GameOpsShell className="events-v2-shell">
      <GameOpsPage className="events-v2-page" aria-label="Events and history">
        <GameOpsHero
          eyebrow="Events"
          title="What just happened?"
          body="Recent work, history, and draft schedules are grouped by source and recency. Server-level raw evidence remains one click deeper."
          metricsLabel="Events and history summary"
          media={<GameOpsHeroMedia preset="events" designMode={designMode} label="Events atmosphere" themeClassName="gameops-theme-events" focalPoint="50% 46%" />}
          status={<GameOpsStatusPill tone={currentOperationItems.length > 0 ? 'warning' : eventTimelineItems.length > 0 ? 'healthy' : 'unknown'}>{currentOperationItems.length > 0 ? `${currentOperationItems.length} current` : `${crossOperationHistoryItems.length} history`}</GameOpsStatusPill>}
          primaryAction={(
            <GameOpsPrimaryAction
              aria-label={eventTimelineItems.length > 0 ? 'Review the first loaded timeline event' : 'Review timeline after event data loads'}
              disabled={eventTimelineItems.length === 0}
              onClick={() => {
                const firstItem = eventTimelineItems[0];
                if (firstItem) {
                  onSelectEventsTimelineItem(firstItem.id);
                }
              }}
            >
              Review Timeline
            </GameOpsPrimaryAction>
          )}
          metrics={[
            { label: 'Current work', value: currentOperationItems.length },
            { label: 'History records', value: crossOperationHistoryItems.length },
            { label: 'Warnings', value: worldCards.reduce((sum, { summary }) => sum + (summary?.recentWarnings.length ?? 0), 0) },
            { label: 'Schedule drafts', value: eventScheduleDraftItems.length }
          ]}
        />

        <GameOpsSection
          eyebrow="Timeline"
          title="Recent important activity"
          description="Current attention appears first, followed by cross-server history grouped by recency."
        >
          <GameOpsTimelineDetail
            items={eventTimelineItems}
            selectedItemId={selectedEventsTimelineItemId}
            onSelectItem={onSelectEventsTimelineItem}
            emptyTitle="No event timeline loaded"
            emptyDescription="No current work, activity log, recent event, or data-freshness history is available from the loaded fleet summaries yet."
            detailTitle="Selected event"
          />
        </GameOpsSection>

        <GameOpsSection
          eyebrow="Scheduled / upcoming"
          title="Schedule drafts"
          description="Only dashboard draft labels from existing event-template data are shown here. No automation is scheduled or implied."
        >
          <div className="events-v2-schedule-grid">
            {eventScheduleDraftItems.length === 0 ? (
              <GameOpsCard className="gameops-empty-card">
                <span className="gameops-eyebrow">No schedule drafts</span>
                <p>No event-template draft schedule labels are loaded for the current fleet. Upcoming automation is not inferred.</p>
              </GameOpsCard>
            ) : null}
            {eventScheduleDraftItems.map(({ server, summary, draft }) => (
              <GameOpsCard key={`${server.id}:${draft.templateId}`}>
                <span className="gameops-eyebrow">{getGameLabel(server.game)} | draft only</span>
                <h4>{draft.displayName ?? draft.name}</h4>
                <p>{draft.scheduleLabel ? `Draft label: ${draft.scheduleLabel}` : 'No schedule label has been entered for this dashboard draft.'}</p>
                <p>{summary.displayName}. {draft.reasonApplyDisabled}</p>
                <GameOpsPrimaryAction variant="secondary" onClick={() => onOpenServerTab(server, 'settings')}>
                  Open settings
                </GameOpsPrimaryAction>
              </GameOpsCard>
            ))}
          </div>
        </GameOpsSection>

        <details className="events-v2-details-disclosure">
          <summary>Expandable raw / technical details</summary>
          <div className="events-v2-detail-grid">
            <GameOpsCard>
              <span className="gameops-eyebrow">Loaded sources</span>
              <dl className="gameops-detail-list">
                <div><dt>Current work</dt><dd>{currentOperationItems.length}</dd></div>
                <div><dt>History records</dt><dd>{crossOperationHistoryItems.length}</dd></div>
                <div><dt>Servers with activity</dt><dd>{worldCards.filter(({ summary }) => (summary?.activityLog.length ?? 0) > 0).length}</dd></div>
                <div><dt>Timeline rows</dt><dd>{eventTimelineItems.length}</dd></div>
              </dl>
            </GameOpsCard>
            <GameOpsCard>
              <span className="gameops-eyebrow">Raw access</span>
              <p>Detailed timelines, session records, chronicle search, and raw event evidence remain available inside each server History tab.</p>
              <GameOpsPrimaryAction variant="secondary" onClick={onOpenServersOverview}>
                Open servers
              </GameOpsPrimaryAction>
            </GameOpsCard>
          </div>
        </details>
      </GameOpsPage>
    </GameOpsShell>
  );
}
