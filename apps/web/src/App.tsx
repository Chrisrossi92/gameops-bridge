import { serverStatusSchema, type ServerStatus } from '@gameops/shared';
import { useEffect, useMemo, useState } from 'react';
import './App.css';

interface HealthResponse {
  ok: boolean;
  service: string;
  timestamp: string;
}

const defaultServerId = 'demo-server-1';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [healthResponse, statusResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/health`),
          fetch(`${apiBaseUrl}/servers/${defaultServerId}/status`)
        ]);

        if (!healthResponse.ok) {
          throw new Error(`/health failed with status ${healthResponse.status}`);
        }

        if (!statusResponse.ok) {
          throw new Error(`/servers/:serverId/status failed with status ${statusResponse.status}`);
        }

        const healthPayload = (await healthResponse.json()) as HealthResponse;
        const statusPayload = await statusResponse.json();
        const parsedStatus = serverStatusSchema.safeParse(statusPayload);

        if (!parsedStatus.success) {
          throw new Error('Server status payload failed validation.');
        }

        setHealth(healthPayload);
        setStatus(parsedStatus.data);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  const checkedAtLabel = useMemo(() => {
    if (!status) {
      return 'N/A';
    }

    return new Date(status.lastCheckedAt).toLocaleString();
  }, [status]);

  return (
    <main className="dashboard">
      <header>
        <h1>GameOps Bridge Dashboard</h1>
        <p>Vertical slice: bot, API, and web status loop</p>
      </header>

      {loading ? <p>Loading dashboard...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="card-grid">
        <article className="card">
          <h2>API Health</h2>
          <p><strong>OK:</strong> {health ? String(health.ok) : 'N/A'}</p>
          <p><strong>Service:</strong> {health?.service ?? 'N/A'}</p>
          <p><strong>Timestamp:</strong> {health?.timestamp ?? 'N/A'}</p>
        </article>

        <article className="card">
          <h2>Server Status</h2>
          <p><strong>Server:</strong> {status?.serverId ?? defaultServerId}</p>
          <p><strong>Game:</strong> {status?.game ?? 'N/A'}</p>
          <p><strong>State:</strong> {status?.state ?? 'N/A'}</p>
          <p><strong>Players:</strong> {status ? `${status.playerCount}/${status.maxPlayers}` : 'N/A'}</p>
          <p><strong>Last Checked:</strong> {checkedAtLabel}</p>
          <p><strong>Message:</strong> {status?.message ?? 'N/A'}</p>
        </article>
      </section>
    </main>
  );
}

export default App;
