/* @jsxRuntime classic */
import type { OperatorBriefResponse } from '@gameops/shared';
import { deriveOperatorSignals, groupOperatorEvents, isImportantOperatorRecommendation } from './ai-operator-brief.ts';

interface OperatorCurrentStateCardProps {
  brief: OperatorBriefResponse | null;
  loading: boolean;
  error: string | null;
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

export function OperatorCurrentStateCard({ brief, loading, error }: OperatorCurrentStateCardProps) {
  const groupedEvents = brief ? groupOperatorEvents(brief.recentEvents) : [];
  const signals = brief ? deriveOperatorSignals(brief) : [];

  return (
    <article className={`card ai-operator-card ai-operator-${brief?.health ?? 'unknown'}`}>
      <div className="ai-operator-heading">
        <div>
          <span className="summary-label">Signals / Current State</span>
          <h2>Read-only server intelligence</h2>
          <p className="subtle">{brief?.summary ?? 'Collecting safe server context for operator review.'}</p>
        </div>
        <div className="ai-operator-badges">
          {brief ? <span className={`operator-health-badge operator-health-${brief.health}`}>{healthLabel(brief)}</span> : null}
          <span className="state-pill state-warning">read-only</span>
        </div>
      </div>

      {loading ? <p className="operator-loading">Refreshing operator brief...</p> : null}
      {error ? (
        <div className="operator-unavailable">
          <strong>Operator unavailable</strong>
          <span>Read-only server intelligence is not available from this browser session.</span>
        </div>
      ) : null}

      {brief && !error ? (
        <>
          <div className="operator-signal-row" aria-label="AI Operator signal status">
            {signals.map((signal) => (
              <span key={signal.key} className={`operator-signal operator-signal-${signal.status.toLowerCase()}`}>
                <strong>{signal.label}</strong>
                <span>{signal.status}</span>
              </span>
            ))}
          </div>

          <div className="ai-operator-grid">
            <section className="operator-panel-section">
              <h3>Risks</h3>
              <ul className="list compact">
                {brief.risks.length === 0 ? <li className="operator-positive"><span>No immediate risks detected.</span></li> : null}
                {brief.risks.map((risk) => <li key={risk}><span>{risk}</span></li>)}
              </ul>
            </section>

            <section className="operator-panel-section operator-events-section">
              <h3>Recent Events</h3>
              {groupedEvents.length === 0 ? <p className="subtle">No configured log or repo events yet.</p> : null}
              <div className="operator-event-groups">
                {groupedEvents.map((group) => (
                  <div key={group.key} className={`operator-event-group operator-event-group-${group.key}`}>
                    <h4>{group.label}</h4>
                    <ul className="list compact">
                      {group.events.slice(0, 4).map((event) => <li key={event}><span>{event}</span></li>)}
                      {group.events.length > 4 ? <li className="subtle"><span>{group.events.length - 4} more {group.label} events</span></li> : null}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section className="operator-panel-section">
              <h3>Recommendations</h3>
              <ul className="list compact operator-recommendations">
                {brief.recommendations.length === 0 ? <li className="operator-positive"><span>No immediate action recommended.</span></li> : null}
                {brief.recommendations.map((recommendation) => (
                  <li
                    key={recommendation}
                    className={isImportantOperatorRecommendation(recommendation) ? 'operator-recommendation-important' : ''}
                  >
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      ) : null}
    </article>
  );
}
