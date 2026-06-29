import assert from 'node:assert/strict';
import test from 'node:test';
import { getOperatorAuthStatus } from './operator-auth.js';

test('allows local operator access when no key is configured', () => {
  assert.equal(getOperatorAuthStatus({
    configuredKey: undefined,
    providedHeader: undefined,
    nodeEnv: 'development'
  }), 'allowed');
});

test('fails closed in production when no operator key is configured', () => {
  assert.equal(getOperatorAuthStatus({
    configuredKey: undefined,
    providedHeader: undefined,
    nodeEnv: 'production'
  }), 'misconfigured');
});

test('requires matching operator key when configured', () => {
  assert.equal(getOperatorAuthStatus({
    configuredKey: 'expected-key',
    providedHeader: 'expected-key',
    nodeEnv: 'production'
  }), 'allowed');

  assert.equal(getOperatorAuthStatus({
    configuredKey: 'expected-key',
    providedHeader: 'wrong-key',
    nodeEnv: 'production'
  }), 'unauthorized');
});

test('accepts the first repeated operator key header value', () => {
  assert.equal(getOperatorAuthStatus({
    configuredKey: 'expected-key',
    providedHeader: ['expected-key', 'ignored-key'],
    nodeEnv: 'production'
  }), 'allowed');
});
