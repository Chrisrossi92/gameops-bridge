import assert from 'node:assert/strict';
import test from 'node:test';
import type { CommunityActivityResponse } from '@gameops/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OperatorCommunityActivityCard } from '../src/operator-community-activity-card.tsx';

const generatedAt = '2026-07-01T12:00:00.000Z';

function activity(overrides: Partial<CommunityActivityResponse> = {}): CommunityActivityResponse {
  return {
    serverId: 'srv',
    generatedAt,
    returningPlayers: [{
      playerId: 'srv:mira',
      displayName: 'Mira',
      lastSeenAt: '2026-07-01T10:00:00.000Z',
      sessionCount: 2,
      label: 'Returned after 8 days.',
      gapDays: 8
    }],
    recentlyActive: [{
      playerId: 'srv:sol',
      displayName: 'Sol',
      lastSeenAt: generatedAt,
      sessionCount: 1,
      label: 'Today',
      gapDays: null
    }],
    quietPlayers: [{
      playerId: 'srv:quiet',
      displayName: 'Quiet',
      lastSeenAt: '2026-06-01T12:00:00.000Z',
      sessionCount: 1,
      label: 'Last seen 30 days ago.',
      gapDays: null
    }],
    peakPlayHours: [{
      hourUtc: 20,
      sessionCount: 3,
      totalPlaytimeSeconds: 7200
    }],
    sevenDaySnapshot: {
      sessionCount: 5,
      uniquePlayers: 3,
      totalPlaytimeSeconds: 12_600,
      averageSessionSeconds: 2520
    },
    sevenDayComparison: {
      sessions: { current: 5, previous: 3, delta: 2 },
      uniquePlayers: { current: 3, previous: 2, delta: 1 },
      totalPlaytimeSeconds: { current: 12_600, previous: 7_200, delta: 5_400 }
    },
    explanation: 'Community activity is derived from observed sessions and player intelligence.',
    dataWarnings: [],
    ...overrides
  };
}

test('operator community activity card renders compact community facts', () => {
  const html = renderToStaticMarkup(
    <OperatorCommunityActivityCard
      servers={[{
        displayName: 'Valheim Local',
        game: 'valheim',
        activity: activity()
      }]}
    />
  );

  assert.match(html, /Community Activity/);
  assert.match(html, /Valheim Local/);
  assert.match(html, /Sessions/);
  assert.match(html, /5/);
  assert.match(html, /Returning Players/);
  assert.match(html, /Returned after 8 days/);
  assert.match(html, /Recently Active/);
  assert.match(html, /Today/);
  assert.match(html, /Quiet Players/);
  assert.match(html, /Last seen 30 days ago/);
  assert.match(html, /20:00 UTC/);
  assert.match(html, /\+2 sessions/);
});

test('operator community activity card renders empty states', () => {
  const html = renderToStaticMarkup(
    <OperatorCommunityActivityCard
      servers={[{
        displayName: 'Quiet Server',
        game: 'palworld',
        activity: activity({
          serverId: 'quiet',
          returningPlayers: [],
          recentlyActive: [],
          quietPlayers: [],
          peakPlayHours: [],
          sevenDaySnapshot: {
            sessionCount: 0,
            uniquePlayers: 0,
            totalPlaytimeSeconds: 0,
            averageSessionSeconds: 0
          },
          sevenDayComparison: {
            sessions: { current: 0, previous: 0, delta: 0 },
            uniquePlayers: { current: 0, previous: 0, delta: 0 },
            totalPlaytimeSeconds: { current: 0, previous: 0, delta: 0 }
          }
        })
      }]}
    />
  );

  assert.match(html, /No community activity captured yet/);
  assert.match(html, /Not enough spaced session history yet/);
  assert.match(html, /No recent players observed/);
  assert.match(html, /No quiet players with enough history/);
  assert.match(html, /No peak hour pattern yet/);
});
