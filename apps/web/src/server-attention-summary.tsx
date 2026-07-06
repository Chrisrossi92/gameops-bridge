/* @jsxRuntime classic */
import React from 'react';

export type ServerAttentionStatus = 'online' | 'offline' | 'starting' | 'stopping' | 'restarting' | 'degraded' | 'unknown';

interface ServerAttentionMetric {
  label: string;
  value: string | number;
  detail?: string;
}

interface ServerAttentionSummaryProps {
  gameLabel: string;
  gameSymbol: string;
  serverName: string;
  status: ServerAttentionStatus;
  statusMessage: string;
  warningCount: number;
  warnings: string[];
  recommendedAction?: string | null;
  currentActivity: string;
  recentChange?: string | null;
  metrics: ServerAttentionMetric[];
}

function getAttentionHeadline(status: ServerAttentionStatus, warningCount: number): string {
  if (status === 'offline') {
    return 'This server is offline.';
  }

  if (status === 'degraded') {
    return 'This server needs attention.';
  }

  if (warningCount > 0) {
    return warningCount === 1 ? 'One item needs review.' : `${warningCount} items need review.`;
  }

  if (status === 'unknown') {
    return 'GameOps needs more data.';
  }

  return 'No immediate action needed.';
}

function getAttentionTone(status: ServerAttentionStatus, warningCount: number): string {
  if (status === 'offline' || status === 'degraded') {
    return 'attention';
  }

  if (warningCount > 0 || status === 'unknown') {
    return 'watch';
  }

  return 'calm';
}

export function ServerAttentionSummary({
  gameLabel,
  gameSymbol,
  serverName,
  status,
  statusMessage,
  warningCount,
  warnings,
  recommendedAction,
  currentActivity,
  recentChange,
  metrics
}: ServerAttentionSummaryProps) {
  const headline = getAttentionHeadline(status, warningCount);
  const tone = getAttentionTone(status, warningCount);
  const visibleWarnings = warnings.slice(0, 2);

  return (
    <section className={`server-attention-card server-attention-${tone}`} aria-label="Server attention summary">
      <div className="server-attention-main">
        <div className="server-attention-identity">
          <span className="world-workspace-symbol" aria-hidden="true">{gameSymbol}</span>
          <div>
            <span className="summary-label">{gameLabel} Server</span>
            <h2>{serverName}</h2>
            <p>Does this server need my attention?</p>
          </div>
        </div>

        <div className="server-attention-answer">
          <span className={`state-pill state-${status}`}>{status}</span>
          <strong>{headline}</strong>
          <span>{statusMessage}</span>
        </div>
      </div>

      <div className="server-attention-body">
        <div className="server-attention-panel">
          <span className="summary-label">What needs attention</span>
          {visibleWarnings.length > 0 ? (
            <ul>
              {visibleWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p>Nothing is asking for review right now.</p>
          )}
        </div>

        <div className="server-attention-panel">
          <span className="summary-label">Recommended next action</span>
          <p>{recommendedAction?.trim() || 'Keep watching current activity.'}</p>
        </div>

        <div className="server-attention-panel">
          <span className="summary-label">Current activity</span>
          <p>{currentActivity}</p>
        </div>

        <div className="server-attention-panel">
          <span className="summary-label">Recent important change</span>
          <p>{recentChange?.trim() || 'No important change is visible yet.'}</p>
        </div>
      </div>

      <div className="server-attention-metrics" aria-label="Server activity summary">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <span className="summary-label">{metric.label}</span>
            <strong>{metric.value}</strong>
            {metric.detail ? <small>{metric.detail}</small> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
