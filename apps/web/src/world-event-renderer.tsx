/* @jsxRuntime classic */
import type { WorldEvent } from '@gameops/shared';
import React from 'react';
import {
  getWorldEventRelevanceLabel,
  getWorldEventConfidenceLabel,
  getWorldHistoryState,
  getWorldEventSourceLabel,
  getWorldEventTypeLabel,
  groupWorldHistoryTimelineEntries,
  WORLD_EVENT_TYPE_LABELS,
  worldEventsToChronicleEntries
} from './world-events.ts';

interface WorldEventRendererProps {
  events: WorldEvent[];
  title?: string;
  description?: string;
  emptyMessage?: string;
  previewFallback?: boolean;
  now?: Date;
  totalEventCount?: number;
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

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getRelatedEventTitle(relatedEventId: string, relatedEvents: WorldEvent[]): string {
  return relatedEvents.find((candidate) => candidate.id === relatedEventId)?.title ?? relatedEventId;
}

function isFriendlyRelatedEventTitle(relatedEventId: string, relatedEvents: WorldEvent[]): boolean {
  return relatedEvents.some((candidate) => candidate.id === relatedEventId);
}

function renderReferenceList(values: string[], label: string, emptyText: string) {
  if (values.length === 0) {
    return emptyText;
  }

  return (
    <span className="world-event-reference-list">
      {values.map((value) => (
        <span key={value} className="world-event-reference-pill">{label}: {value}</span>
      ))}
    </span>
  );
}

interface WorldEventRelationshipSummaryProps {
  event: WorldEvent;
  relatedEvents?: WorldEvent[];
}

export function WorldEventRelationshipSummary({ event, relatedEvents = [] }: WorldEventRelationshipSummaryProps) {
  const relatedEventIds = event.relatedEvents.map((relationship) => relationship.eventId);
  const connectionCount = event.relatedMemories.length
    + event.relatedPlayers.length
    + event.relatedGuilds.length
    + event.relatedCharacters.length
    + relatedEventIds.length;

  return (
    <section className="player-drawer-sessions world-event-detail-section">
      <h3>Connected history</h3>
      <p className="subtle">
        {connectionCount > 0
          ? `Connected to ${pluralize(connectionCount, 'trusted reference')}.`
          : 'No connected world history is recorded yet.'}
      </p>
      <ul>
        <li>
          <span>Related memories</span>
          <span>{renderReferenceList(event.relatedMemories, 'Memory reference', 'No related memories recorded yet.')}</span>
        </li>
        <li>
          <span>Related people</span>
          <span>{renderReferenceList(event.relatedPlayers, 'Player reference', 'No related people recorded yet.')}</span>
        </li>
        <li>
          <span>Related guilds</span>
          <span>{renderReferenceList(event.relatedGuilds, 'Guild reference', 'No related guilds recorded yet.')}</span>
        </li>
        <li>
          <span>Related characters</span>
          <span>{renderReferenceList(event.relatedCharacters, 'Character reference', 'No related characters recorded yet.')}</span>
        </li>
        <li>
          <span>Related events</span>
          <span>
            {relatedEventIds.length > 0 ? (
              <span className="world-event-reference-list">
                {relatedEventIds.map((eventId) => (
                  <span key={eventId} className="world-event-reference-pill">
                    {isFriendlyRelatedEventTitle(eventId, relatedEvents) ? 'Related event' : 'Related event reference'}: {getRelatedEventTitle(eventId, relatedEvents)}
                  </span>
                ))}
              </span>
            ) : 'No related events recorded yet.'}
          </span>
        </li>
      </ul>
    </section>
  );
}

interface WorldEventDetailDrawerProps {
  event: WorldEvent;
  relatedEvents?: WorldEvent[];
  onClose: () => void;
}

export function WorldEventDetailDrawer({ event, relatedEvents = [], onClose }: WorldEventDetailDrawerProps) {
  const sourceLabel = event.source.label || getWorldEventSourceLabel(event.source.kind);

  return (
    <div className="player-drawer-shell world-event-detail-shell">
      <button type="button" className="player-drawer-backdrop" aria-label="Close world event details" onClick={onClose} />
      <aside className="player-drawer world-event-detail-drawer" aria-label="World event details">
        <div className="player-drawer-header">
          <div>
            <span className="summary-label">World History / Chronicle</span>
            <h2>{event.title}</h2>
            <p>{event.summary}</p>
          </div>
          <button type="button" className="player-drawer-close" onClick={onClose}>Back to World History</button>
        </div>

        <section className="player-drawer-actions world-event-detail-section world-event-origin-note">
          <h3>Why this is shown</h3>
          <p className="subtle">Opened from World History. This trusted event keeps its Chronicle and World Memory evidence attached.</p>
        </section>

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

        <WorldEventRelationshipSummary event={event} relatedEvents={relatedEvents} />

        <section className="player-drawer-actions world-event-detail-section">
          <h3>Source</h3>
          <p className="subtle">Recorded from {sourceLabel}. This detail is read-only and preserves the attached evidence.</p>
        </section>
      </aside>
    </div>
  );
}

export function WorldHistoryTimeline({
  events,
  title = 'World History',
  description = 'Trusted events from Chronicle and World Memory.',
  emptyMessage = 'This world does not have enough trusted history yet.',
  previewFallback = false,
  now,
  totalEventCount = events.length,
  onSelect
}: WorldEventRendererProps) {
  const chronicleEntries = worldEventsToChronicleEntries(events);
  const timelineGroups = groupWorldHistoryTimelineEntries(chronicleEntries, now);
  const historyState = getWorldHistoryState(events, previewFallback);

  if (chronicleEntries.length === 0) {
    return (
      <article className="card world-event-preview-card" aria-label="World history timeline">
        <div className="world-event-preview-heading">
          <div>
            <span className="summary-label">World History</span>
            <h2>{title}</h2>
            <p className="subtle">{description}</p>
          </div>
        </div>
        <div className={`world-history-state-note world-history-state-${historyState.kind}`}>
          <strong>{historyState.title}</strong>
          <p>{emptyMessage}</p>
          <p>{historyState.detail}</p>
        </div>
      </article>
    );
  }

  return (
    <article className="card world-event-preview-card world-history-timeline-card" aria-label="World history timeline">
      <div className="world-event-preview-heading">
        <div>
          <span className="summary-label">World History</span>
          <h2>{title}</h2>
          <p className="subtle">{description}</p>
        </div>
        <span className="source-badge">showing {chronicleEntries.length} of {totalEventCount} trusted events</span>
      </div>

      {historyState.kind !== 'active' ? (
        <div className={`world-history-state-note world-history-state-${historyState.kind}`}>
          <strong>{historyState.title}</strong>
          <p>{historyState.detail}</p>
        </div>
      ) : null}

      <div className="world-history-group-list">
        {timelineGroups.map((group) => (
          <section key={group.label} className="world-history-group" aria-label={group.label}>
            <h3>{group.label}</h3>
            <ol className="world-event-preview-list">
              {group.entries.map((entry) => {
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
                        <span>{getWorldEventRelevanceLabel(event)}</span>
                        <span>Inspect evidence</span>
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
          </section>
        ))}
      </div>
    </article>
  );
}

export function WorldEventRenderer(props: WorldEventRendererProps) {
  return <WorldHistoryTimeline {...props} />;
}
