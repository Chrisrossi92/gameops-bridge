/* @jsxRuntime classic */
import type { OperatorMemoryIndexResponse } from '@gameops/shared';
import React from 'react';

interface OperatorMemoryIndexCardProps {
  memoryIndex: OperatorMemoryIndexResponse | null;
  loading: boolean;
  error: string | null;
}

function sectionState(label: string, count: number, activeState: string): string {
  return `${label}: ${count} (${activeState})`;
}

function storageTrend(memoryIndex: OperatorMemoryIndexResponse): string {
  const trend = memoryIndex.storage.trend;
  return trend === 'quiet' ? 'quiet' : trend;
}

export function OperatorMemoryIndexCard({ memoryIndex, loading, error }: OperatorMemoryIndexCardProps) {
  return (
    <article className="card operator-memory-index-card">
      <div className="operator-daily-brief-heading">
        <div>
          <span className="summary-label">Operational Memory</span>
          <h2>Memory Index</h2>
        </div>
        {memoryIndex ? <span className="confidence-badge confidence-medium">{memoryIndex.timelineStatistics.totalEvents} events</span> : null}
      </div>

      {loading ? <p className="operator-loading">Loading operational memory...</p> : null}
      {error ? (
        <div className="operator-unavailable">
          <strong>Operational memory unavailable</strong>
          <span>Timeline index is not available from this browser session.</span>
        </div>
      ) : null}

      {!loading && !error && !memoryIndex ? <p className="subtle">Operational memory is collecting timeline history.</p> : null}

      {memoryIndex ? (
        <div className="operator-memory-grid">
          <span>{sectionState('deployments', memoryIndex.deployments.count, memoryIndex.deployments.activeState)}</span>
          <span>{sectionState('restarts', memoryIndex.services.count, memoryIndex.services.activeState)}</span>
          <span>{sectionState('active recommendations', memoryIndex.recommendations.count, memoryIndex.recommendations.activeState)}</span>
          <span>{sectionState('repo status', memoryIndex.git.count, memoryIndex.git.activeState)}</span>
          <span>{sectionState('storage trend', memoryIndex.storage.count, storageTrend(memoryIndex))}</span>
        </div>
      ) : null}
    </article>
  );
}
