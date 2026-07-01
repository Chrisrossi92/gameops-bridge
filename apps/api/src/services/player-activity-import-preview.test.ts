import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { previewPlayerActivityImport } from './player-activity-import-preview.js';

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function tempEnv(tempDir: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    LOG_TRUTH_STORE_PATH: join(tempDir, 'log-truth.json'),
    SESSION_STATE_STORE_PATH: join(tempDir, 'session-state.json'),
    PLAYER_INTELLIGENCE_STORE_PATH: join(tempDir, 'player-intelligence-state.json'),
    KNOWN_PLAYER_STORE_PATH: join(tempDir, 'known-players.json'),
    PALWORLD_TELEMETRY_STORE_PATH: join(tempDir, 'palworld-telemetry.json')
  };
}

function withTempStore(testFn: (tempDir: string, env: NodeJS.ProcessEnv) => void): void {
  const tempDir = mkdtempSync(join(tmpdir(), 'gameops-player-activity-import-preview-'));

  try {
    testFn(tempDir, tempEnv(tempDir));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('preview returns empty candidates when configured stores are absent', () => {
  withTempStore((_tempDir, env) => {
    const result = previewPlayerActivityImport({ env, now: new Date('2026-07-01T12:00:00.000Z') });

    assert.equal(result.candidatePlayers.length, 0);
    assert.equal(result.wouldCreatePlayers, 0);
    assert.equal(result.wouldUpdatePlayers, 0);
    assert.equal(result.scannedStores.every((store) => store.exists === false), true);
  });
});

test('preview finds create candidates from log truth and session state without mutating stores', () => {
  withTempStore((tempDir, env) => {
    const logTruthPath = join(tempDir, 'log-truth.json');
    const sessionStatePath = join(tempDir, 'session-state.json');
    const logTruth = {
      entries: [{
        id: 'log:1',
        serverId: 'pal-1',
        game: 'palworld',
        eventType: 'PLAYER_JOIN',
        occurredAt: '2026-06-29T12:00:00.000Z',
        receivedAt: '2026-06-29T12:00:01.000Z',
        confidence: 'high',
        event: {
          id: 'event-1',
          game: 'palworld',
          serverId: 'pal-1',
          eventType: 'PLAYER_JOIN',
          playerName: 'Mira',
          occurredAt: '2026-06-29T12:00:00.000Z'
        }
      }]
    };
    const sessionState = {
      activeSessionsByServer: {},
      recentClosedSessionsByServer: {
        'pal-1': [{
          serverId: 'pal-1',
          playerName: 'Mira',
          startedAt: '2026-06-29T12:00:00.000Z',
          endedAt: '2026-06-29T13:00:00.000Z',
          durationSeconds: 3600,
          endConfidence: 'high',
          sourceEventIds: ['event-1']
        }]
      }
    };
    writeJson(logTruthPath, logTruth);
    writeJson(sessionStatePath, sessionState);

    const before = readFile(logTruthPath);
    const result = previewPlayerActivityImport({ env, now: new Date('2026-07-01T12:00:00.000Z') });

    assert.equal(readFile(logTruthPath), before);
    assert.equal(result.candidatePlayers.length, 1);
    assert.equal(result.wouldCreatePlayers, 1);
    assert.equal(result.wouldUpdatePlayers, 0);
    assert.equal(result.candidatePlayers[0]?.displayName, 'Mira');
    assert.equal(result.candidatePlayers[0]?.sessionLikeEvidenceCount, 2);
    assert.equal(result.candidatePlayers[0]?.confidence, 'high');
    assert.equal(result.candidatePlayers[0]?.wouldCreatePlayer, true);
  });
});

test('preview reports update candidates from existing player intelligence and known players', () => {
  withTempStore((tempDir, env) => {
    writeJson(join(tempDir, 'player-intelligence-state.json'), {
      players: [{
        playerId: 'pal-1:mira',
        serverId: 'pal-1',
        displayName: 'Mira',
        aliases: ['Mira'],
        game: 'palworld',
        identityConfidence: 'medium',
        identityExplanation: 'test',
        firstSeenAt: '2026-06-01T12:00:00.000Z',
        lastSeenAt: '2026-06-30T12:00:00.000Z',
        isOnline: false,
        activeSessionId: null,
        totalTrackedSeconds: 7200,
        sessionCount: 2,
        averageSessionSeconds: 3600,
        sourceSummary: ['test'],
        lastUpdatedAt: '2026-06-30T12:00:00.000Z'
      }]
    });
    writeJson(join(tempDir, 'known-players.json'), {
      players: [{
        serverId: 'pal-1',
        displayName: 'Mira',
        normalizedPlayerKey: 'mira',
        knownPlatformIds: [],
        knownPlayFabIds: [],
        knownCharacterIds: [],
        identitySources: ['test'],
        observationCount: 3,
        confidence: 'high',
        firstSeenAt: '2026-06-01T12:00:00.000Z',
        lastSeenAt: '2026-06-30T12:00:00.000Z'
      }]
    });

    const result = previewPlayerActivityImport({ env, now: new Date('2026-07-01T12:00:00.000Z') });

    assert.equal(result.candidatePlayers.length, 1);
    assert.equal(result.wouldCreatePlayers, 0);
    assert.equal(result.wouldUpdatePlayers, 1);
    assert.equal(result.candidatePlayers[0]?.wouldUpdatePlayer, true);
    assert.equal(result.candidatePlayers[0]?.confidence, 'high');
    assert.equal(result.candidatePlayers[0]?.sourceStores.length, 2);
  });
});

test('preview includes Palworld telemetry candidates and supports server filtering', () => {
  withTempStore((tempDir, env) => {
    writeJson(join(tempDir, 'palworld-telemetry.json'), {
      latestPlayerStates: [{
        server_id: 'pal-1',
        lookup_key: 'steam_123',
        player_name: 'Mira',
        player_id: 'steam_123',
        first_seen_at: '2026-06-28T12:00:00.000Z',
        last_seen_at: '2026-06-30T12:00:00.000Z',
        total_sessions: 2
      }, {
        server_id: 'pal-2',
        lookup_key: 'steam_456',
        player_name: 'Other',
        first_seen_at: '2026-06-28T12:00:00.000Z',
        last_seen_at: '2026-06-30T12:00:00.000Z',
        total_sessions: 1
      }],
      playerSnapshotHistory: [{
        server_id: 'pal-1',
        observed_at: '2026-06-30T12:05:00.000Z',
        lookup_key: 'steam_123',
        player_name: 'Mira',
        player_id: 'steam_123'
      }]
    });

    const result = previewPlayerActivityImport({
      env,
      serverId: 'pal-1',
      now: new Date('2026-07-01T12:00:00.000Z')
    });

    assert.deepEqual(result.candidatePlayers.map((candidate) => candidate.displayName), ['Mira']);
    assert.equal(result.candidatePlayers[0]?.sessionLikeEvidenceCount, 3);
    assert.equal(result.candidatePlayers[0]?.sourceStores[0]?.store, 'palworld-telemetry');
  });
});

test('preview records malformed store errors without throwing', () => {
  withTempStore((tempDir, env) => {
    writeFileSync(join(tempDir, 'log-truth.json'), '{bad json', 'utf8');

    const result = previewPlayerActivityImport({ env, now: new Date('2026-07-01T12:00:00.000Z') });
    const logTruth = result.scannedStores.find((store) => store.store === 'log-truth');

    assert.equal(logTruth?.exists, true);
    assert.equal(logTruth?.readable, false);
    assert.match(logTruth?.error ?? '', /JSON/);
    assert.equal(result.candidatePlayers.length, 0);
  });
});

function readFile(path: string): string {
  return readFileSync(path, 'utf8');
}
