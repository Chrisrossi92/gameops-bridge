import type { PlayerIntelligenceSummaryResponse } from '@gameops/shared';
import { getRecentClosedSessionsForServer } from './event-store.js';
import { getPlayerIntelligenceForServer } from './player-intelligence.js';
import { buildPlayerIntelligenceSummary } from './player-intelligence-summary-builder.js';
import { getCachedResult } from './request-performance.js';

const PLAYER_INTELLIGENCE_SUMMARY_CACHE_TTL_MS = 15_000;

export function getPlayerIntelligenceSummaryForServer(serverId: string, now = new Date()): PlayerIntelligenceSummaryResponse {
  return getCachedResult(`player-intelligence-summary:${serverId}`, PLAYER_INTELLIGENCE_SUMMARY_CACHE_TTL_MS, () => {
    const intelligence = getPlayerIntelligenceForServer(serverId);

    return buildPlayerIntelligenceSummary({
      serverId,
      now,
      players: intelligence.players,
      recentClosedSessions: getRecentClosedSessionsForServer(serverId, 250)
    });
  });
}
