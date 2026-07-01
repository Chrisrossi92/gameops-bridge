/* @jsxRuntime classic */
import type {
  OperatorBriefResponse,
  OperatorChangesSummaryResponse,
  OperatorDailyBriefResponse,
  OperatorInsightsResponse,
  OperatorMemoryIndexResponse,
  OperatorTimelineEvent
} from '@gameops/shared';
import React from 'react';
import { OperatorDebugPanel, type OperatorDebugServer } from './operator-debug-panel.tsx';
import { OperatorAskCard } from './operator-ask-card.tsx';
import { OperatorChangesCard } from './operator-changes-card.tsx';
import { OperatorCurrentStateCard } from './operator-current-state-card.tsx';
import { OperatorDailyBriefCard } from './operator-daily-brief-card.tsx';
import { OperatorInsightsCard } from './operator-insights-card.tsx';
import { OperatorMemoryIndexCard } from './operator-memory-index-card.tsx';
import { OperatorPlayerIntelligenceCard, type OperatorPlayerIntelligenceEntry } from './operator-player-intelligence-card.tsx';
import { OperatorReasonCard } from './operator-reason-card.tsx';
import { OperatorServerHealthCard, type OperatorServerHealthEntry } from './operator-server-health-card.tsx';
import { OperatorTimelineCard } from './operator-timeline-card.tsx';

interface OperatorSummaryCardProps {
  brief: OperatorBriefResponse | null;
  loading: boolean;
  error: string | null;
  onOpen: () => void;
}

interface OperatorWorkspaceProps {
  apiBaseUrl: string;
  brief: OperatorBriefResponse | null;
  briefLoading: boolean;
  briefError: string | null;
  dailyBrief: OperatorDailyBriefResponse | null;
  dailyBriefLoading: boolean;
  dailyBriefError: string | null;
  changes: OperatorChangesSummaryResponse | null;
  changesLoading: boolean;
  changesError: string | null;
  insights: OperatorInsightsResponse | null;
  insightsLoading: boolean;
  insightsError: string | null;
  memoryIndex: OperatorMemoryIndexResponse | null;
  memoryIndexLoading: boolean;
  memoryIndexError: string | null;
  timelineEvents: OperatorTimelineEvent[];
  timelineLoading: boolean;
  timelineError: string | null;
  debugServers: OperatorDebugServer[];
  serverHealth: OperatorServerHealthEntry[];
  playerIntelligenceSummary: OperatorPlayerIntelligenceEntry[];
}

function healthLabel(brief: OperatorBriefResponse | null): string {
  if (brief?.health === 'ok') {
    return 'OK';
  }

  if (brief?.health === 'unknown') {
    return 'Unavailable';
  }

  return 'Warning';
}

export function OperatorSummaryCard({ brief, loading, error, onOpen }: OperatorSummaryCardProps) {
  return (
    <article className={`card operator-summary-card ai-operator-${brief?.health ?? 'unknown'}`}>
      <div className="operator-summary-main">
        <div>
          <span className="summary-label">AI Operator</span>
          <h2>{brief ? healthLabel(brief) : 'Read-only server intelligence'}</h2>
          <p className="subtle">{brief?.summary ?? 'Operator summary is loading.'}</p>
        </div>
        <div className="ai-operator-badges">
          {brief ? <span className={`operator-health-badge operator-health-${brief.health}`}>{healthLabel(brief)}</span> : null}
          <span className="state-pill state-warning">read-only</span>
        </div>
      </div>

      {loading ? <p className="operator-loading">Refreshing operator summary...</p> : null}
      {error ? (
        <div className="operator-unavailable operator-summary-unavailable">
          <strong>Operator unavailable</strong>
          <span>Read-only server intelligence is not available from this browser session.</span>
        </div>
      ) : null}

      <div className="operator-summary-footer">
        <span>{brief?.risks.length ?? 0} risks</span>
        <span>{brief?.recommendations.length ?? 0} recommendations</span>
        <button type="button" className="fleet-toggle-button" onClick={onOpen}>
          Open Operator
        </button>
      </div>
    </article>
  );
}

export function OperatorWorkspace(props: OperatorWorkspaceProps) {
  const health = healthLabel(props.brief);

  return (
    <section className="operator-workspace" aria-label="AI Operator workspace">
      <article className={`card operator-workspace-header ai-operator-${props.brief?.health ?? 'unknown'}`}>
        <div>
          <span className="summary-label">Operator</span>
          <h2>AI Operator</h2>
          <p className="subtle">{props.brief?.summary ?? 'Read-only operator intelligence is loading.'}</p>
        </div>
        <div className="ai-operator-badges">
          {props.brief ? <span className={`operator-health-badge operator-health-${props.brief.health}`}>{health}</span> : null}
          <span className="state-pill state-warning">read-only</span>
        </div>
      </article>

      <div className="operator-workspace-grid">
        <OperatorServerHealthCard servers={props.serverHealth} />
        <OperatorPlayerIntelligenceCard apiBaseUrl={props.apiBaseUrl} servers={props.playerIntelligenceSummary} />
        <OperatorDebugPanel servers={props.debugServers} />
        <OperatorAskCard apiBaseUrl={props.apiBaseUrl} />
        <OperatorReasonCard apiBaseUrl={props.apiBaseUrl} />
        <OperatorMemoryIndexCard
          memoryIndex={props.memoryIndex}
          loading={props.memoryIndexLoading}
          error={props.memoryIndexError}
        />
        <OperatorDailyBriefCard
          brief={props.dailyBrief}
          loading={props.dailyBriefLoading}
          error={props.dailyBriefError}
        />
        <OperatorChangesCard
          changes={props.changes}
          loading={props.changesLoading}
          error={props.changesError}
        />
        <OperatorInsightsCard
          insights={props.insights}
          loading={props.insightsLoading}
          error={props.insightsError}
        />
        <OperatorTimelineCard
          events={props.timelineEvents}
          loading={props.timelineLoading}
          error={props.timelineError}
        />
        <OperatorCurrentStateCard
          brief={props.brief}
          loading={props.briefLoading}
          error={props.briefError}
        />
      </div>
    </section>
  );
}
