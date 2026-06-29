import type { OperatorInsight, OperatorInsightsResponse } from '@gameops/shared';
import React from 'react';

interface OperatorInsightsCardProps {
  insights: OperatorInsightsResponse | null;
  loading: boolean;
  error: string | null;
}

function insightTone(insight: OperatorInsight): string {
  if (insight.severity === 'critical') {
    return 'operator-insight-critical';
  }

  if (insight.severity === 'warning') {
    return 'operator-insight-warning';
  }

  return 'operator-insight-info';
}

export function OperatorInsightsCard({ insights, loading, error }: OperatorInsightsCardProps) {
  const visibleInsights = insights?.insights.slice(0, 3) ?? [];

  return (
    <article className="card operator-insights-card">
      <div className="operator-daily-brief-heading">
        <div>
          <span className="summary-label">Operator Insights</span>
          <h2>I noticed...</h2>
        </div>
        <span className="state-pill state-warning">read-only</span>
      </div>

      {loading ? <p className="operator-loading">Looking for operator patterns...</p> : null}
      {error ? (
        <div className="operator-unavailable">
          <strong>Insights unavailable</strong>
          <span>Operator insights are not available from this browser session.</span>
        </div>
      ) : null}

      {!error && visibleInsights.length > 0 ? (
        <div className="operator-insight-list">
          {visibleInsights.map((insight) => (
            <section key={`${insight.title}:${insight.summary}`} className={`operator-insight ${insightTone(insight)}`}>
              <div className="operator-insight-title-row">
                <strong>{insight.title}</strong>
                <span>{insight.confidence}</span>
              </div>
              <p>{insight.summary}</p>
              {insight.evidence.length > 0 ? (
                <ul className="list compact operator-insight-evidence">
                  {insight.evidence.slice(0, 2).map((item) => <li key={item}><span>{item}</span></li>)}
                </ul>
              ) : null}
              {insight.recommendedAction ? (
                <div className="operator-insight-action">{insight.recommendedAction}</div>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}
    </article>
  );
}

