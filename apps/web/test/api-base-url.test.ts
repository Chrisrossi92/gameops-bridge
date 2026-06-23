import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_LOCAL_API_BASE_URL, resolveApiBaseUrl } from '../src/api-base-url.ts';

test('dashboard API base URL falls back to localhost for local development', () => {
  assert.equal(resolveApiBaseUrl(undefined), DEFAULT_LOCAL_API_BASE_URL);
  assert.equal(resolveApiBaseUrl('   '), DEFAULT_LOCAL_API_BASE_URL);
});

test('dashboard API base URL uses production API host when configured', () => {
  assert.equal(
    resolveApiBaseUrl('https://api.servers.cdawgbot.xyz'),
    'https://api.servers.cdawgbot.xyz'
  );
});
