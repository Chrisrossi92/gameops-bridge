import assert from 'node:assert/strict';
import test from 'node:test';
import { getAllowedCorsOrigins } from './cors-origin.js';

test('CORS is open for local development when no origin is configured', () => {
  const result = getAllowedCorsOrigins({ NODE_ENV: 'development' }, undefined);

  assert.equal(result, true);
});

test('CORS allows only public dashboard origin by default in production', () => {
  const result = getAllowedCorsOrigins({ NODE_ENV: 'production' }, undefined);

  assert.deepEqual(result, ['https://servers.cdawgbot.xyz']);
});

test('CORS uses explicit production origins from environment', () => {
  const result = getAllowedCorsOrigins(
    {
      NODE_ENV: 'production',
      API_CORS_ORIGIN: 'https://servers.cdawgbot.xyz, https://preview.servers.cdawgbot.xyz'
    },
    undefined
  );

  assert.deepEqual(result, [
    'https://servers.cdawgbot.xyz',
    'https://preview.servers.cdawgbot.xyz'
  ]);
});
