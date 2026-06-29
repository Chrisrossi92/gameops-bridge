import type { OperatorChangesSummaryResponse } from '@gameops/shared';

interface OperatorChangesCardProps {
  changes: OperatorChangesSummaryResponse | null;
  loading: boolean;
  error: string | null;
}

function confidenceLabel(confidence: OperatorChangesSummaryResponse['confidence']): string {
  return confidence[0].toUpperCase() + confidence.slice(1);
}

export function OperatorChangesCard({ changes, loading, error }: OperatorChangesCardProps) {
  return (
    <article className="card operator-changes-card">
      <div className="operator-daily-brief-heading">
        <div>
          <span className="summary-label">What Changed</span>
          <h2>{changes?.headline ?? 'Comparing operator signals'}</h2>
        </div>
        {changes ? (
          <span className={`operator-confidence-badge operator-confidence-${changes.confidence}`}>
            {confidenceLabel(changes.confidence)} confidence
          </span>
        ) : (
          <span className="state-pill state-warning">read-only</span>
        )}
      </div>

      {loading ? <p className="operator-loading">Comparing recent signals...</p> : null}
      {error ? (
        <div className="operator-unavailable">
          <strong>Change summary unavailable</strong>
          <span>Timeline comparison is not available from this browser session.</span>
        </div>
      ) : null}

      {changes && !error ? (
        <div className="operator-changes-body">
          <div className="operator-daily-brief-grid">
            <section>
              <h3>Meaningful Changes</h3>
              <ul className="list compact">
                {changes.meaningfulChanges.slice(0, 3).map((change) => <li key={change}><span>{change}</span></li>)}
              </ul>
            </section>

            <section>
              <h3>New Warnings</h3>
              <ul className="list compact">
                {changes.newWarnings.length === 0 ? <li className="operator-positive"><span>No new active warnings.</span></li> : null}
                {changes.newWarnings.slice(0, 3).map((warning) => <li key={warning}><span>{warning}</span></li>)}
              </ul>
            </section>

            <section>
              <h3>Resolved</h3>
              <ul className="list compact">
                {changes.resolvedWarnings.length === 0 ? <li className="operator-positive"><span>No recently resolved warnings.</span></li> : null}
                {changes.resolvedWarnings.slice(0, 3).map((warning) => <li key={warning}><span>{warning}</span></li>)}
              </ul>
            </section>

            <section>
              <h3>Stable</h3>
              <ul className="list compact">
                {changes.unchangedSignals.slice(0, 3).map((signal) => <li key={signal}><span>{signal}</span></li>)}
              </ul>
            </section>
          </div>

          <div className="operator-next-action">
            <span>Next recommended action</span>
            <strong>{changes.recommendedNextAction}</strong>
          </div>
        </div>
      ) : null}
    </article>
  );
}

