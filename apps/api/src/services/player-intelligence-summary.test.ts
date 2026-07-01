import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlayerIntelligenceRecord, SessionRecord } from '@gameops/shared';
import { buildPlayerIntelligenceSummary } from './player-intelligence-summary-builder.js';

const now = new Date('2026-06-30T12:00:00.000Z');

function player(overrides: Partial<PlayerIntelligenceRecord>): PlayerIntelligenceRecord {
  return {
    playerId: 'srv:player',
    serverId: 'srv',
    displayName: 'Player',
    aliases: [],
    game: 'valheim',
    identityConfidence: 'medium',
    identityExplanation: 'Test player.',
    firstSeenAt: '2026-06-01T12:00:00.000Z',
    lastSeenAt: '2026-06-29T12:00:00.000Z',
    isOnline: false,
    activeSessionId: null,
    totalTrackedSeconds: 3600,
    sessionCount: 2,
    averageSessionSeconds: 1800,
    sourceSummary: ['test'],
    ...overrides
  };
}

function session(overrides: Partial<SessionRecord>): SessionRecord {
  return {
    serverId: 'srv',
    playerName: 'Player',
    startedAt: '2026-06-29T12:00:00.000Z',
    endedAt: '2026-06-29T13:00:00.000Z',
    durationSeconds: 3600,
    closeReason: 'player_leave',
    startConfidence: 'high',
    endConfidence: 'high',
    sourceEventIds: ['join', 'leave'],
    ...overrides
  };
}

function summary(players: PlayerIntelligenceRecord[], recentClosedSessions: SessionRecord[] = []) {
  return buildPlayerIntelligenceSummary({
    serverId: 'srv',
    now,
    players,
    recentClosedSessions
  });
}

test('player intelligence summary returns safe empty state without players', () => {
  const result = summary([]);

  assert.equal(result.totalKnownPlayers, 0);
  assert.equal(result.activePlayersThisWeek, 0);
  assert.equal(result.inactivePlayers, 0);
  assert.equal(result.mostRecentPlayer, null);
  assert.equal(result.longestSessionPlayer, null);
  assert.deepEqual(result.topPlayersByPlaytime, []);
  assert.deepEqual(result.playersAtRisk, []);
});

test('player intelligence summary classifies a new player', () => {
  const result = summary([
    player({
      playerId: 'srv:new',
      displayName: 'New Player',
      firstSeenAt: '2026-06-29T12:00:00.000Z',
      lastSeenAt: '2026-06-29T12:00:00.000Z'
    })
  ]);

  assert.equal(result.newPlayersThisWeek, 1);
  assert.equal(result.activePlayersThisWeek, 1);
  assert.equal(result.topPlayersByPlaytime[0]?.status, 'new');
});

test('player intelligence summary classifies an active returning player', () => {
  const result = summary([
    player({
      playerId: 'srv:returning',
      displayName: 'Returning Player',
      firstSeenAt: '2026-05-01T12:00:00.000Z',
      lastSeenAt: '2026-06-29T12:00:00.000Z',
      isOnline: true
    })
  ]);

  assert.equal(result.returningPlayersThisWeek, 1);
  assert.equal(result.activePlayersThisWeek, 1);
  assert.equal(result.topPlayersByPlaytime[0]?.status, 'returning');
});

test('player intelligence summary classifies an inactive player', () => {
  const result = summary([
    player({
      playerId: 'srv:inactive',
      displayName: 'Inactive Player',
      firstSeenAt: '2026-06-10T12:00:00.000Z',
      lastSeenAt: '2026-06-20T12:00:00.000Z',
      totalTrackedSeconds: 0,
      sessionCount: 0,
      averageSessionSeconds: 0
    })
  ]);

  assert.equal(result.inactivePlayers, 1);
  assert.equal(result.activePlayersThisWeek, 0);
  assert.equal(result.topPlayersByPlaytime[0]?.status, 'inactive');
});

test('player intelligence summary classifies at-risk players', () => {
  const result = summary([
    player({
      playerId: 'srv:risk',
      displayName: 'Risk Player',
      firstSeenAt: '2026-05-01T12:00:00.000Z',
      lastSeenAt: '2026-06-01T12:00:00.000Z',
      totalTrackedSeconds: 7200,
      sessionCount: 4
    })
  ]);

  assert.equal(result.inactivePlayers, 1);
  assert.equal(result.playersAtRisk.length, 1);
  assert.equal(result.playersAtRisk[0]?.status, 'at_risk');
  assert.equal(result.playersAtRisk[0]?.displayName, 'Risk Player');
});

test('player intelligence summary orders top playtime and finds longest session player', () => {
  const result = summary([
    player({
      playerId: 'srv:alpha',
      displayName: 'Alpha',
      totalTrackedSeconds: 1800,
      averageSessionSeconds: 900
    }),
    player({
      playerId: 'srv:bravo',
      displayName: 'Bravo',
      totalTrackedSeconds: 10800,
      averageSessionSeconds: 3600
    }),
    player({
      playerId: 'srv:charlie',
      displayName: 'Charlie',
      totalTrackedSeconds: 5400,
      averageSessionSeconds: 1800
    })
  ], [
    session({ playerName: 'Alpha', durationSeconds: 1800 }),
    session({ playerName: 'Charlie', durationSeconds: 5400 })
  ]);

  assert.deepEqual(result.topPlayersByPlaytime.map((row) => row.displayName), ['Bravo', 'Charlie', 'Alpha']);
  assert.equal(result.topPlayersByPlaytime[0]?.totalPlaytimeMinutes, 180);
  assert.equal(result.longestSessionPlayer?.displayName, 'Charlie');
});
