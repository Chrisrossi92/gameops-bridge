import assert from 'node:assert/strict';
import test from 'node:test';
import { redactSecrets } from './operator-redaction.js';

test('redacts dotenv values', () => {
  const input = 'API_PORT=3001\nPUBLIC_LABEL=dashboard\n';
  const output = redactSecrets(input);

  assert.equal(output, 'API_PORT=[REDACTED]\nPUBLIC_LABEL=[REDACTED]\n');
});

test('redacts bearer, API key, Discord, Supabase, and password values', () => {
  const input = [
    'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
    'OPENAI_API_KEY=sk-test_abcdefghijklmnopqrstuvwxyz',
    'DISCORD_TOKEN=mfa.ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
    'SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefghijklmnopqrstuvwxyz.abcdefghijklmnopqrstuvwxyz',
    'database_url=postgres://user:super-secret-password@example.local/db',
    'password: hunter2'
  ].join('\n');
  const output = redactSecrets(input);

  assert(!output.includes('abcdefghijklmnopqrstuvwxyz123456'));
  assert(!output.includes('sk-test_abcdefghijklmnopqrstuvwxyz'));
  assert(!output.includes('mfa.ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'));
  assert(!output.includes('hunter2'));
  assert(!output.includes('super-secret-password'));
  assert(output.includes('[REDACTED]'));
});

test('redacts SSH and private key blocks', () => {
  const input = [
    'before',
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    'abc123',
    '-----END OPENSSH PRIVATE KEY-----',
    'middle',
    '-----BEGIN RSA PRIVATE KEY-----',
    'def456',
    '-----END RSA PRIVATE KEY-----',
    'after'
  ].join('\n');
  const output = redactSecrets(input);

  assert(!output.includes('abc123'));
  assert(!output.includes('def456'));
  assert.equal((output.match(/\[REDACTED\]/g) ?? []).length, 2);
});
