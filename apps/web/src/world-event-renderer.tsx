/* @jsxRuntime classic */
import type { WorldEvent } from '@gameops/shared';
import React from 'react';
import {
  getWorldEventConfidenceLabel,
  getWorldEventSourceLabel,
  getWorldEventTypeLabel,
  WORLD_EVENT_TYPE_LABELS,
  worldEventsToChronicleEntries
} from './world-events.ts';

interface WorldEventRendererProps {
  events: WorldEvent[];
  title?: string;
  onSelect?: (event: WorldEvent) => void;
}

function formatEventTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatEventDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatRelatedList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'None attached yet';
}

interface WorldEventDetailDrawerProps {
  event: WorldEvent;
  onClose: () => void;
}

export function WorldEventDetailDrawer({ event, onClose }: WorldEventDetailDrawerProps) {
  const sourceLabel = event.source.label || getWorldEventSourceLabel(event.source.kind);

  return (
    <div className="player-drawer-shell world-event-detail-shell">
      <button type="button" className="player-drawer-backdrop" aria-label="Close world event details" onClick={onClose} />
      <aside className="player-drawer world-event-detail-drawer" aria-label="World event details">
        <div className="player-drawer-header">
          <div>
            <span className="summary-label">Why this is shown</span>
            <h2>{event.title}</h2>
            <p>{event.summary}</p>
          </div>
          <button type="button" className="player-drawer-close" onClick={onClose}>Close</button>
        </div>

        <dl className="player-drawer-grid world-event-detail-grid">
          <div className="world-memory-fact">
            <dt>Event type</dt>
            <dd>{WORLD_EVENT_TYPE_LABELS[event.eventType]}</dd>
          </div>
          <div className="world-memory-fact">
            <dt>Significance</dt>
            <dd>{event.significance}</dd>
          </div>
          <div className="world-memory-fact">
            <dt>Confidence</dt>
            <dd>{getWorldEventConfidenceLabel(event.confidence)}</dd>
          </div>
          <div className="world-memory-fact">
            <dt>Source</dt>
            <dd>{sourceLabel}</dd>
          </div>
          <div className="world-memory-fact">
            <dt>Occurred</dt>
            <dd>{formatEventDateTime(event.occurredAt)}</dd>
          </div>
          <div className="world-memory-fact">
            <dt>Discovered</dt>
            <dd>{formatEventDateTime(event.discoveredAt)}</dd>
          </div>
        </dl>

        <section className="player-drawer-sessions world-event-detail-section">
          <h3>Evidence</h3>
          {event.evidence.length === 0 ? <p>No evidence references are attached yet.</p> : null}
          {event.evidence.length > 0 ? (
            <ul>
              {event.evidence.map((evidence) => (
                <li key={evidence.id}>
                  <span>{evidence.label}</span>
                  <span>{evidence.sourceLabel}{evidence.observedAt ? ` · observed ${formatEventDateTime(evidence.observedAt)}` : ''}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="player-drawer-sessions world-event-detail-section">
          <h3>Related history</h3>
          <ul>
            <li>
              <span>Memories</span>
              <span>{formatRelatedList(event.relatedMemories)}</span>
            </li>
            <li>
              <span>Players</span>
              <span>{formatRelatedList(event.relatedPlayers)}</span>
            </li>
            <li>
              <span>Guilds</span>
              <span>{formatRelatedList(event.relatedGuilds)}</span>
            </li>
            <li>
              <span>Characters</span>
              <span>{formatRelatedList(event.relatedCharacters)}</span>
            </li>
          </ul>
        </section>

        <section className="player-drawer-actions world-event-detail-section">
          <h3>Source</h3>
          <p className="subtle">Recorded from {sourceLabel}. This detail is read-only and preserves the attached evidence.</p>
        </section>
      </aside>
    </div>
  );
}

export function WorldEventRenderer({ events, title = 'World Events in the Chronicle', onSelect }: WorldEventRendererProps) {
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
              <button
                type="button"
                className="world-event-preview-button"
                disabled={!onSelect}
                onClick={() => onSelect?.(event)}
              >
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
              </button>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
