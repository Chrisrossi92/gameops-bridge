import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import type { OperatorContext } from '@gameops/shared';
import { registerOperatorRoutes } from './operator.js';

const mockContext: OperatorContext = {
  generatedAt: '2026-06-29T12:00:00.000Z',
  readOnly: true,
  pm2: {
    status: 'available',
    processCount: 1,
    processes: [{
      name: 'gameops-api',
      pid: 1234,
      status: 'online',
      restarts: 0,
      uptimeMs: 60_000,
      memoryBytes: 128_000_000,
      cpuPercent: 2
    }]
  },
  system: {
    uptimeSeconds: 3600,
    loadAverage: [0.2, 0.3, 0.4],
    cpuCount: 2,
    memory: {
      totalBytes: 1_000_000_000,
      freeBytes: 500_000_000,
      usedBytes: 500_000_000,
      usedPercent: 50
    }
  },
  disks: [{
    label: 'Application volume',
    status: 'available',
    sizeBytes: 10_000_000,
    usedBytes: 2_000_000,
    availableBytes: 8_000_000,
    usedPercent: 20
  }],
  logs: [{
    label: 'API errors',
    status: 'available',
    lines: [
      'normal startup line',
      'DISCORD_TOKEN=super-secret-token-value'
    ]
  }],
  repos: [{
    label: 'GameOps Bridge',
    status: 'available',
    branch: 'main',
    isDirty: true,
    ahead: 0,
    behind: 0,
    changes: [' M apps/api/src/index.ts']
  }],
  healthChecks: [{
    label: 'Local API',
    status: 'ok',
    urlConfigured: true,
    httpStatus: 200,
    responseMs: 12
  }],
  collectionWarnings: []
};

async function buildTestApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({ logger: false });
  await registerOperatorRoutes(app, {
    collectContext: async () => mockContext,
    allowedOrigins: ['https://servers.cdawgbot.xyz']
  });
  return app;
}

function restoreEnv(key: 'NODE_ENV' | 'GAMEOPS_OPERATOR_KEY', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

test('raw operator endpoints require key in production', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    const contextResponse = await app.inject({ method: 'GET', url: '/api/operator/context' });
    const briefResponse = await app.inject({ method: 'GET', url: '/api/operator/brief' });

    assert.equal(contextResponse.statusCode, 401);
    assert.equal(briefResponse.statusCode, 401);
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('dashboard operator brief does not require browser to send operator key', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/operator/brief',
      headers: {
        origin: 'https://servers.cdawgbot.xyz'
      }
    });

    assert.equal(response.statusCode, 200);
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('dashboard operator brief does not expose raw logs or secrets', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/operator/brief',
      headers: {
        origin: 'https://servers.cdawgbot.xyz'
      }
    });
    const body = response.body;

    assert.equal(response.statusCode, 200);
    assert(!body.includes('logs'));
    assert(!body.includes('normal startup line'));
    assert(!body.includes('DISCORD_TOKEN'));
    assert(!body.includes('super-secret-token-value'));
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('dashboard operator brief requires allowed dashboard origin in production', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/operator/brief'
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});
