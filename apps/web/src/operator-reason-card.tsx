/* @jsxRuntime classic */
import { operatorReasonResponseSchema, type OperatorReasonResponse } from '@gameops/shared';
import * as React from 'react';

type ReasonFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface OperatorReasonCardProps {
  apiBaseUrl: string;
  reasonFetch?: ReasonFetch;
  initialResult?: OperatorReasonResponse | null;
  initialLoading?: boolean;
  initialError?: string | null;
}

// eslint-disable-next-line react-refresh/only-export-components
export async function runOperatorAnalysis(input: {
  apiBaseUrl: string;
  reasonFetch?: ReasonFetch;
}): Promise<OperatorReasonResponse> {
  const request = input.reasonFetch ?? fetch;
  const response = await request(`${input.apiBaseUrl}/api/dashboard/operator/reason`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ request: 'analyze-current-context' })
  });

  if (!response.ok) {
    throw new Error('Operator analysis request failed.');
  }

  const payload = await response.json();
  const parsed = operatorReasonResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error('Operator analysis payload validation failed.');
  }

  return parsed.data;
}

export function OperatorReasonCard({
  apiBaseUrl,
  reasonFetch,
  initialResult = null,
  initialLoading = false,
  initialError = null
}: OperatorReasonCardProps) {
  const [result, setResult] = React.useState<OperatorReasonResponse | null>(initialResult);
  const [loading, setLoading] = React.useState(initialLoading);
  const [error, setError] = React.useState<string | null>(initialError);

  async function runAnalysis(): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      setResult(await runOperatorAnalysis({ apiBaseUrl, reasonFetch }));
    } catch {
      setError('Operator analysis unavailable');
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="card operator-reason-card">
      <div className="operator-daily-brief-heading">
        <div>
          <span className="summary-label">Run Operator Analysis</span>
          <h2>Read-only reasoning</h2>
          <p className="subtle">Analyzes the current safe operator context without exposing keys or raw logs.</p>
        </div>
        <div className="ai-operator-badges">
          {result?.engine === 'codex' ? <span className="state-pill state-ok">Codex reasoning</span> : null}
          <span className="state-pill state-warning">read-only</span>
        </div>
      </div>

      <button type="button" className="fleet-toggle-button" onClick={() => { void runAnalysis(); }} disabled={loading}>
        {loading ? 'Running...' : 'Run Analysis'}
      </button>

      {loading ? <p className="operator-loading">Running read-only operator analysis...</p> : null}

      {error ? (
        <div className="operator-unavailable">
          <strong>Operator analysis unavailable</strong>
          <span>Read-only reasoning is not available from this browser session.</span>
        </div>
      ) : null}

      {result ? (
        <section className="operator-reason-result">
          <div className="operator-insight-title-row">
            <strong>{result.answerHeadline}</strong>
            <span>{result.confidence}</span>
          </div>
          <div className="operator-reason-meta">
            <span>{result.engine}</span>
            {result.engine === 'placeholder' ? <span>Safe fallback analysis</span> : null}
          </div>

          {result.engine === 'placeholder' ? (
            <p className="subtle operator-fallback-note">
              Codex reasoning was unavailable, so the Operator returned safe local analysis.
            </p>
          ) : null}

          <section className="operator-panel-section">
            <h3>Analysis</h3>
            <ul className="list compact">
              {result.answerBullets.map((bullet) => <li key={bullet}><span>{bullet}</span></li>)}
            </ul>
          </section>

          <section className="operator-panel-section">
            <h3>Evidence</h3>
            <ul className="list compact">
              {result.evidence.length === 0 ? <li className="operator-positive"><span>No evidence items returned.</span></li> : null}
              {result.evidence.map((item) => (
                <li key={`${item.source}:${item.detail}`}>
                  <span><strong>{item.source}:</strong> {item.detail}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="operator-panel-section">
            <h3>Recommended Next Actions</h3>
            <ul className="list compact">
              {result.recommendedNextActions.length === 0 ? <li className="operator-positive"><span>No immediate next action recommended.</span></li> : null}
              {result.recommendedNextActions.map((action) => <li key={action}><span>{action}</span></li>)}
            </ul>
          </section>

          <section className="operator-panel-section">
            <h3>Limitations</h3>
            <ul className="list compact">
              {result.limitations.map((limitation) => <li key={limitation}><span>{limitation}</span></li>)}
            </ul>
          </section>
        </section>
      ) : null}
    </article>
  );
}
