/* @jsxRuntime classic */
import type { OperatorDailyBriefResponse } from '@gameops/shared';
import React from 'react';

interface OperatorDailyBriefCardProps {
  brief: OperatorDailyBriefResponse | null;
  loading: boolean;
  error: string | null;
}

function confidenceLabel(confidence: OperatorDailyBriefResponse['confidence']): string {
  return confidence[0].toUpperCase() + confidence.slice(1);
}

export function OperatorDailyBriefCard({ brief, loading, error }: OperatorDailyBriefCardProps) {
  const nextAction = brief?.recommendations[0] ?? null;

  return (
    <article className="card operator-daily-brief-card">
      <div className="operator-daily-brief-heading">
        <div>
          <span className="summary-label">Today&apos;s Brief</span>
          <h2>{brief?.headline ?? 'Building daily operator brief'}</h2>
        </div>
        {brief ? (
          <span className={`operator-confidence-badge operator-confidence-${brief.confidence}`}>
            {confidenceLabel(brief.confidence)} confidence
          </span>
        ) : (
          <span className="state-pill state-warning">read-only</span>
        )}
      </div>

      {loading ? <p className="operator-loading">Summarizing timeline...</p> : null}
      {error ? (
        <div className="operator-unavailable">
          <strong>Daily brief unavailable</strong>
          <span>Timeline intelligence is not available from this browser session.</span>
        </div>
      ) : null}

      {brief && !error ? (
        <div className="operator-daily-brief-body">
          <p className="subtle">{brief.healthSummary}</p>

          <div className="operator-daily-brief-grid">
            <section>
              <h3>Key Changes</h3>
              <ul className="list compact">
                {brief.keyChanges.slice(0, 3).map((change) => <li key={change}><span>{change}</span></li>)}
              </ul>
            </section>

            <section>
              <h3>Warnings</h3>
              <ul className="list compact">
                {brief.warnings.length === 0 ? <li className="operator-positive"><span>No warnings in the last 24 hours.</span></li> : null}
                {brief.warnings.slice(0, 3).map((warning) => <li key={warning}><span>{warning}</span></li>)}
              </ul>
            </section>
          </div>

          {nextAction ? (
            <div className="operator-next-action">
              <span>Next recommended action</span>
              <strong>{nextAction}</strong>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
