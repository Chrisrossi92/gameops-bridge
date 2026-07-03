/* @jsxRuntime classic */
import type { WorldEvent } from '@gameops/shared';
import React from 'react';
import {
  getWorldEventConfidenceLabel,
  getWorldEventSourceLabel,
  getWorldEventTypeLabel
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

export function WorldEventRenderer({ events, title = 'World Event Preview' }: WorldEventRendererProps) {
  return (
    <article className="card world-event-preview-card" aria-label="World event preview">
      <div className="world-event-preview-heading">
        <div>
          <span className="summary-label">World Events</span>
          <h2>{title}</h2>
        </div>
        <span className="source-badge">foundation</span>
      </div>

      <ol className="world-event-preview-list">
        {events.map((event) => (
          <li key={event.id} className={`world-event-preview-row world-event-${event.significance}`}>
            <div className="world-event-preview-main">
              <div className="world-event-preview-title">
                <span className="source-badge">{getWorldEventTypeLabel(event.eventType)}</span>
                <strong>{event.title}</strong>
              </div>
              <p>{event.summary}</p>
              <div className="world-event-preview-meta">
                <span>{formatEventTime(event.occurredAt)}</span>
                <span>{event.source.label || getWorldEventSourceLabel(event.source.kind)}</span>
                <span>{event.evidence.length} evidence</span>
                <span className={`confidence-badge confidence-${event.confidence}`}>
                  {getWorldEventConfidenceLabel(event.confidence)}
                </span>
                <span className={`world-event-significance world-event-significance-${event.significance}`}>
                  {event.significance}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
