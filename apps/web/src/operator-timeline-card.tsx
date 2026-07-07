/* @jsxRuntime classic */
import type { OperatorTimelineEvent } from '@gameops/shared';
import React from 'react';
import { formatEasternTimestamp } from './time-format.ts';

interface OperatorTimelineCardProps {
  events: OperatorTimelineEvent[];
  loading: boolean;
  error: string | null;
}

function formatTimestamp(value: string): string {
  return formatEasternTimestamp(value);
}

function getOperatorTimelineTone(severity: OperatorTimelineEvent['severity']): string {
  if (severity === 'critical') {
    return 'operator-timeline-critical';
  }

  if (severity === 'warning') {
    return 'operator-timeline-warning';
  }

  return 'operator-timeline-info';
}

export function OperatorTimelineCard({ events, loading, error }: OperatorTimelineCardProps) {
  return (
    <article className="card operator-timeline-card">
      <div className="operator-timeline-heading">
        <div>
          <span className="summary-label">Operational Memory</span>
          <h2>Recent Timeline</h2>
        </div>
        <span className="state-pill state-warning">read-only</span>
      </div>

      {loading ? <p className="operator-loading">Loading recent timeline...</p> : null}
      {error ? (
        <div className="operator-unavailable">
          <strong>Timeline unavailable</strong>
          <span>Operational memory is not available from this browser session.</span>
        </div>
      ) : null}

      {!loading && !error && events.length === 0 ? (
        <p className="operator-positive operator-timeline-empty">No operator timeline events recorded yet.</p>
      ) : null}

      {!error && events.length > 0 ? (
        <ol className="operator-timeline-list">
          {events.slice(0, 8).map((event) => (
            <li key={event.id} className={getOperatorTimelineTone(event.severity)}>
              <div className="operator-timeline-marker" aria-hidden="true" />
              <div className="operator-timeline-content">
                <div className="operator-timeline-title-row">
                  <strong>{event.title}</strong>
                  <span>{event.type}</span>
                </div>
                <p>{event.summary}</p>
                <time dateTime={event.occurredAt}>{formatTimestamp(event.occurredAt)}</time>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}
