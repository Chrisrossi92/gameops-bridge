import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { persistPalworldTelemetry } from './telemetry-store.js';

test('persists player, metrics, and settings telemetry with latest state updates', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'palworld-telemetry-'));
  const storePath = join(tempDir, 'telemetry.json');
  const previousStorePath = process.env.PALWORLD_TELEMETRY_STORE_PATH;
  process.env.PALWORLD_TELEMETRY_STORE_PATH = storePath;

  try {
    persistPalworldTelemetry({
      serverId: 'palworld-test-1',
      observedAt: '2026-04-08T12:00:00.000Z',
      players: [
        {
          player_name: 'RossiKid11',
          account_name: 'rossi',
          player_id: 'PLAYER-1',
          user_id: 'steam_123',
          level: 12,
          building_count: 4,
          location_x: 250,
          location_y: -50
        }
      ],
      previousPlayerLookupKeys: new Set(),
      currentPlayerLookupKeys: new Set(['player:PLAYER-1']),
      metrics: { currentplayernum: 1 },
      settings: { Difficulty: 'Normal' }
    });

    persistPalworldTelemetry({
      serverId: 'palworld-test-1',
      observedAt: '2026-04-08T12:10:00.000Z',
      players: [
        {
          player_name: 'RossiKid11',
          account_name: 'rossi',
          player_id: 'PLAYER-1',
          user_id: 'steam_123',
          level: 14,
          building_count: 8,
          location_x: -10,
          location_y: 90
        }
      ],
      previousPlayerLookupKeys: new Set(['player:PLAYER-1']),
      currentPlayerLookupKeys: new Set(['player:PLAYER-1']),
      metrics: { currentplayernum: 1, fps: 60 },
      settings: { Difficulty: 'Normal' }
    });

    const raw = JSON.parse(readFileSync(storePath, 'utf8')) as {
      playerSnapshotHistory: unknown[];
      latestPlayerStates: Array<Record<string, unknown>>;
      metricsSnapshotHistory: unknown[];
      settingsChangeHistory: unknown[];
    };

    assert.equal(raw.playerSnapshotHistory.length, 2);
    assert.equal(raw.metricsSnapshotHistory.length, 2);
    assert.equal(raw.settingsChangeHistory.length, 1);
    assert.equal(raw.latestPlayerStates.length, 1);
    assert.equal(raw.latestPlayerStates[0]?.total_sessions, 1);
    assert.equal(raw.latestPlayerStates[0]?.max_level_seen, 14);
    assert.equal(raw.latestPlayerStates[0]?.max_building_count_seen, 8);
    assert.equal(raw.latestPlayerStates[0]?.last_region, 'northwest-frontier');
  } finally {
    if (previousStorePath === undefined) {
      delete process.env.PALWORLD_TELEMETRY_STORE_PATH;
    } else {
      process.env.PALWORLD_TELEMETRY_STORE_PATH = previousStorePath;
    }

    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
});
