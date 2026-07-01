/* @jsxRuntime classic */
import type { DataFreshnessResponse, ServerOperationalStatus } from '@gameops/shared';
import React from 'react';

export interface OperatorDebugServer {
  serverId: string;
  displayName: string;
  game: string;
  operationalStatus: ServerOperationalStatus;
  dataFreshness: DataFreshnessResponse;
}

interface OperatorDebugPanelProps {
  servers: OperatorDebugServer[];
}

function formatDebugTime(value: string | null | undefined): string {
  if (!value) {
    return 'never';
  }

  return value.replace(/\.\d{3}Z$/, 'Z').replace('T', ' ');
}

function formatDebugError(value: string | null | undefined): string {
  return value?.trim() ? value : 'none';
}

function collectorLastSuccess(collector: ServerOperationalStatus['collectors'][number]): string | null {
  return collector.lastSuccessfulCollectionAt
    ?? collector.shadow?.lastRunAt
    ?? collector.snapshot?.lastSuccessfulPollAt
    ?? null;
}

function collectorError(collector: ServerOperationalStatus['collectors'][number]): string | null {
  return collector.lastError ?? collector.shadow?.lastError ?? collector.snapshot?.lastError ?? null;
}

function logTruthTone(freshness: DataFreshnessResponse): string {
  const health = freshness.logTruth;

  if (!health) {
    return 'unknown';
  }

  return health.status === 'healthy' && health.readable && health.writable && !health.lastError
    ? 'running'
    : 'error';
}

export function OperatorDebugPanel({ servers }: OperatorDebugPanelProps) {
  return (
    <article className="card operator-debug-card" aria-label="Operator debug panel">
      <div className="operator-debug-heading">
        <div>
          <span className="summary-label">Debug</span>
          <h2>Telemetry Pipeline</h2>
        </div>
        <span className="state-pill state-unknown">{servers.length} servers</span>
      </div>

      <div className="operator-debug-grid">
        {servers.map((server) => {
          const logTruth = server.dataFreshness.logTruth;
          const collectors = server.operationalStatus.collectors;

          return (
            <section className="operator-debug-server" key={server.serverId}>
              <div className="operator-debug-server-heading">
                <div>
                  <strong>{server.displayName}</strong>
                  <span>{server.game}</span>
                </div>
                <span className={`state-pill state-${server.operationalStatus.connectorStatus}`}>
                  {server.operationalStatus.connectorStatus}
                </span>
              </div>

              <dl className="operator-debug-kv">
                <div>
                  <dt>Mode</dt>
                  <dd>{server.operationalStatus.connectorMode ?? 'unknown'}</dd>
                </div>
                <div>
                  <dt>Heartbeat</dt>
                  <dd>{formatDebugTime(server.operationalStatus.lastHeartbeatAt)}</dd>
                </div>
                <div>
                  <dt>Poll</dt>
                  <dd>{formatDebugTime(server.operationalStatus.lastSuccessfulPollAt)}</dd>
                </div>
              </dl>

              <div className="operator-debug-subsection">
                <span className="operator-debug-subtitle">Collectors</span>
                {collectors.length === 0 ? <p className="subtle operator-debug-empty">No collectors reported.</p> : null}
                {collectors.map((collector) => {
                  const error = collectorError(collector);

                  return (
                    <div className="operator-debug-collector" key={collector.collectorId}>
                      <div className="operator-debug-line">
                        <strong>{collector.name}</strong>
                        <span className={`state-pill state-${error ? 'error' : collector.enabled ? 'running' : 'unknown'}`}>
                          {collector.enabled ? 'enabled' : 'disabled'}
                        </span>
                      </div>
                      <div className="operator-debug-meta">
                        <span>Last success: {formatDebugTime(collectorLastSuccess(collector))}</span>
                        <span>Total: {collector.totalEventsEmitted}</span>
                        {collector.shadow ? <span>Events: {collector.shadow.eventCount}</span> : null}
                        {collector.snapshot ? <span>Snapshot: {collector.snapshot.snapshotSize}</span> : null}
                        {collector.snapshot ? <span>Joined: {collector.snapshot.joinedCount}</span> : null}
                        {collector.snapshot ? <span>Left: {collector.snapshot.leftCount}</span> : null}
                        {collector.shadow ? <span>Parity: {collector.shadow.parityStatus}</span> : null}
                        <span>Error: {formatDebugError(error)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="operator-debug-subsection">
                <div className="operator-debug-line">
                  <span className="operator-debug-subtitle">Log Truth</span>
                  <span className={`state-pill state-${logTruthTone(server.dataFreshness)}`}>
                    {logTruth?.status ?? 'unknown'}
                  </span>
                </div>
                <div className="operator-debug-meta">
                  <span>Readable: {logTruth?.readable ? 'yes' : 'no'}</span>
                  <span>Writable: {logTruth?.writable ? 'yes' : 'no'}</span>
                  <span>Durable events: {logTruth?.totalEventCount ?? 0}</span>
                  <span>Last append: {formatDebugTime(logTruth?.lastSuccessfulAppendAt)}</span>
                  <span>Error: {formatDebugError(logTruth?.lastError)}</span>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}
