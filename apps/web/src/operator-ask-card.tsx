/* @jsxRuntime classic */
import { operatorAskResponseSchema, type OperatorAskResponse } from '@gameops/shared';
import * as React from 'react';

type AskFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface OperatorAskCardProps {
  apiBaseUrl: string;
  askFetch?: AskFetch;
}

const EXAMPLE_PROMPTS = [
  'What changed?',
  'What happened today?',
  'Any insights?',
  'Show recent events',
  'Current health'
];

// eslint-disable-next-line react-refresh/only-export-components
export async function askOperatorQuestion(input: {
  apiBaseUrl: string;
  question: string;
  askFetch?: AskFetch;
}): Promise<OperatorAskResponse> {
  const request = input.askFetch ?? fetch;
  const response = await request(`${input.apiBaseUrl}/api/dashboard/operator/ask`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ question: input.question })
  });

  if (!response.ok) {
    throw new Error('Operator ask request failed.');
  }

  const payload = await response.json();
  const parsed = operatorAskResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error('Operator ask payload validation failed.');
  }

  return parsed.data;
}

export function OperatorAskCard({ apiBaseUrl, askFetch }: OperatorAskCardProps) {
  const [question, setQuestion] = React.useState('');
  const [answer, setAnswer] = React.useState<OperatorAskResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submitQuestion(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = question.trim();

    if (!trimmed) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setAnswer(await askOperatorQuestion({ apiBaseUrl, question: trimmed, askFetch }));
    } catch {
      setError('Ask Operator unavailable');
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="card operator-ask-card">
      <div className="operator-daily-brief-heading">
        <div>
          <span className="summary-label">Ask Operator</span>
          <h2>Ask a read-only question</h2>
          <p className="subtle">Routes simple questions to existing operator intelligence.</p>
        </div>
        <span className="state-pill state-warning">read-only</span>
      </div>

      <form className="operator-ask-form" onSubmit={(event) => { void submitQuestion(event); }}>
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask what changed, current health, insights, or timeline..."
          aria-label="Ask Operator question"
        />
        <button type="submit" className="fleet-toggle-button" disabled={loading || question.trim().length === 0}>
          {loading ? 'Asking...' : 'Ask'}
        </button>
      </form>

      <div className="operator-ask-examples" aria-label="Example operator questions">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="operator-example-button"
            onClick={() => setQuestion(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      {error ? (
        <div className="operator-unavailable">
          <strong>Ask Operator unavailable</strong>
          <span>Read-only operator answers are not available from this browser session.</span>
        </div>
      ) : null}

      {answer ? (
        <section className="operator-ask-answer">
          <div className="operator-insight-title-row">
            <strong>{answer.headline}</strong>
            <span>{answer.confidence}</span>
          </div>
          <ul className="list compact">
            {answer.bullets.map((bullet) => <li key={bullet}><span>{bullet}</span></li>)}
          </ul>
          <div className="operator-ask-source">
            <span>{answer.source}</span>
            <span>{answer.intent}</span>
          </div>
        </section>
      ) : null}
    </article>
  );
}
