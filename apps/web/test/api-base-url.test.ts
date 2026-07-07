import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

test('production dashboard build script pins the public API host', () => {
  const webPackage = JSON.parse(readFileSync(join(process.cwd(), 'apps/web/package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    webPackage.scripts?.['build:production'],
    'VITE_API_BASE_URL=https://api.servers.cdawgbot.xyz npm run build'
  );
});
