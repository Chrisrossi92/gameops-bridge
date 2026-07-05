/* @jsxRuntime classic */
import type { WorldEvent } from '@gameops/shared';
import React from 'react';
import {
  getWorldEventConfidenceLabel,
  getWorldEventSourceLabel,
  getWorldEventTypeLabel,
  worldEventsToChronicleEntries
} from './world-events.ts';

interface WorldEventRendererProps {
  events: WorldEvent[];
  title?: string;
}

function formatEventTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

export function WorldEventRenderer({ events, title = 'World Events in the Chronicle' }: WorldEventRendererProps) {
  const chronicleEntries = worldEventsToChronicleEntries(events);

  if (chronicleEntries.length === 0) {
    return null;
  }

  return (
    <article className="card world-event-preview-card" aria-label="World events in the chronicle">
      <div className="world-event-preview-heading">
        <div>
          <span className="summary-label">Chronicle</span>
          <h2>{title}</h2>
          <p className="subtle">Trusted world events are shown here as readable history, with their source and evidence kept visible.</p>
        </div>
        <span className="source-badge">trusted events</span>
      </div>

      <ol className="world-event-preview-list">
        {chronicleEntries.map((entry) => {
          const event = events.find((candidate) => candidate.id === entry.worldEventId);

          if (!event) {
            return null;
          }

          return (
            <li key={entry.id} className={`world-event-preview-row world-event-${entry.significance}`}>
              <div className="world-event-preview-main">
                <div className="world-event-preview-title">
                  <span className="source-badge">{getWorldEventTypeLabel(event.eventType)}</span>
                  <strong>{entry.title}</strong>
                </div>
                {entry.detail ? <p>{entry.detail}</p> : null}
                <div className="world-event-preview-meta">
                  <span>Occurred {formatEventTime(entry.occurredAt)}</span>
                  <span>Discovered {formatEventTime(entry.discoveredAt)}</span>
                  <span>{entry.sourceLabel || getWorldEventSourceLabel(entry.sourceKind)}</span>
                  <span>{entry.evidenceCount} evidence</span>
                  <span className={`confidence-badge confidence-${entry.confidence}`}>
                    {getWorldEventConfidenceLabel(event.confidence)}
                  </span>
                  <span className={`world-event-significance world-event-significance-${entry.significance}`}>
                    {entry.significance}
                  </span>
                </div>
                {entry.evidenceLabels.length > 0 ? (
                  <div className="world-event-preview-meta">
                    <span>Evidence: {entry.evidenceLabels.slice(0, 3).join(', ')}</span>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
