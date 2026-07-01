import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlayerIntelligenceSummaryResponse } from '@gameops/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OperatorPlayerIntelligenceCard } from '../src/operator-player-intelligence-card.tsx';

const generatedAt = '2026-06-30T12:00:00.000Z';

function row(overrides: Partial<PlayerIntelligenceSummaryResponse['topPlayersByPlaytime'][number]>) {
  return {
    playerId: 'srv:player',
    displayName: 'Player',
    lastSeenAt: generatedAt,
    firstSeenAt: '2026-06-01T12:00:00.000Z',
    sessionCount: 2,
    totalPlaytimeMinutes: 90,
    averageSessionMinutes: 45,
    status: 'returning' as const,
    trend: 'unknown' as const,
    ...overrides
  };
}

function summary(overrides: Partial<PlayerIntelligenceSummaryResponse> = {}): PlayerIntelligenceSummaryResponse {
  const top = [
    row({ playerId: 'srv:mira', displayName: 'Mira', totalPlaytimeMinutes: 180 }),
    row({ playerId: 'srv:sol', displayName: 'Sol', totalPlaytimeMinutes: 75, status: 'new' })
  ];

  return {
    serverId: 'srv',
    generatedAt,
    totalKnownPlayers: 4,
    activePlayersThisWeek: 2,
    inactivePlayers: 1,
    newPlayersThisWeek: 1,
    returningPlayersThisWeek: 1,
    mostRecentPlayer: top[1] ?? null,
    longestSessionPlayer: top[0] ?? null,
    topPlayersByPlaytime: top,
    playersAtRisk: [row({ playerId: 'srv:risk', displayName: 'Risk', status: 'at_risk' })],
    ...overrides
  };
}

test('operator player intelligence card renders compact summary and top players', () => {
  const html = renderToStaticMarkup(
    <OperatorPlayerIntelligenceCard
      apiBaseUrl="http://localhost:3000"
      servers={[{
        displayName: 'Valheim Local',
        game: 'valheim',
        summary: summary()
      }]}
    />
  );

  assert.match(html, /Player Intelligence/);
  assert.match(html, /Valheim Local/);
  assert.match(html, /Known: 4/);
  assert.match(html, /New: 1/);
  assert.match(html, /At risk: 1/);
  assert.match(html, /Most recent: Sol/);
  assert.match(html, /Mira/);
  assert.match(html, /button/);
  assert.match(html, /3h/);
});

test('operator player intelligence card renders empty state', () => {
  const html = renderToStaticMarkup(
    <OperatorPlayerIntelligenceCard
      apiBaseUrl="http://localhost:3000"
      servers={[{
        displayName: 'Quiet Server',
        game: 'palworld',
        summary: summary({
          totalKnownPlayers: 0,
          activePlayersThisWeek: 0,
          inactivePlayers: 0,
          newPlayersThisWeek: 0,
          returningPlayersThisWeek: 0,
          mostRecentPlayer: null,
          longestSessionPlayer: null,
          topPlayersByPlaytime: [],
          playersAtRisk: []
        })
      }]}
    />
  );

  assert.match(html, /No player activity captured yet/);
  assert.match(html, /Quiet Server/);
  assert.match(html, /Known: 0/);
});
