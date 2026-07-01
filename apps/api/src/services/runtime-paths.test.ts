import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { getRuntimeDataDir, PRODUCTION_DATA_DIR, resolveRuntimeDataPath } from './runtime-paths.js';

test('runtime data defaults to local ignored data directory outside production', () => {
  const env = {};

  assert.equal(getRuntimeDataDir(env), './data');
  assert.equal(resolveRuntimeDataPath('SESSION_STATE_STORE_PATH', 'session-state.json', env), resolve(process.cwd(), 'data/session-state.json'));
});

test('runtime data defaults to shared VPS data directory in production', () => {
  const env = { NODE_ENV: 'production' };

  assert.equal(getRuntimeDataDir(env), PRODUCTION_DATA_DIR);
  assert.equal(resolveRuntimeDataPath('SESSION_STATE_STORE_PATH', 'session-state.json', env), '/srv/gameops-bridge/data/session-state.json');
});

test('runtime data path honors explicit environment override', () => {
  const env = {
    NODE_ENV: 'production',
    GAMEOPS_DATA_DIR: '/var/lib/gameops-bridge',
    SESSION_STATE_STORE_PATH: '/tmp/gameops-session-state.json'
  };

  assert.equal(getRuntimeDataDir(env), '/var/lib/gameops-bridge');
  assert.equal(resolveRuntimeDataPath('SESSION_STATE_STORE_PATH', 'session-state.json', env), '/tmp/gameops-session-state.json');
});
