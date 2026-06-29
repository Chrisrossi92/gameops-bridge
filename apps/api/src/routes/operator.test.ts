import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import type { OperatorContext } from '@gameops/shared';
import { OperatorTimelineStore } from '../services/operator-timeline.js';
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
    upstream: 'origin/main',
    isDirty: true,
    ahead: 0,
    behind: 0,
    modifiedCount: 1,
    stagedCount: 0,
    untrackedCount: 0,
    changedFilePaths: ['apps/api/src/index.ts'],
    changes: [' M apps/api/src/index.ts'],
    lastCommit: {
      hash: 'abcdef123456',
      date: '2026-06-29T12:00:00.000Z',
      message: 'Test commit'
    },
    recommendations: ['local-changes-review']
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

async function buildTestApp(context: OperatorContext = mockContext): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await registerOperatorRoutes(app, {
    collectContext: async () => context,
    allowedOrigins: ['https://servers.cdawgbot.xyz'],
    timelineStore: new OperatorTimelineStore({
      path: join(mkdtempSync(join(tmpdir(), 'gameops-operator-route-timeline-')), 'timeline.json')
    })
  });
  return app;
}

async function buildLoggedTestApp(logs: Record<string, unknown>[]): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  (app.log as { warn: (payload: Record<string, unknown>, message?: string) => void }).warn = (payload) => {
    logs.push(payload);
  };
  await registerOperatorRoutes(app, {
    collectContext: async () => mockContext,
    allowedOrigins: ['https://servers.cdawgbot.xyz'],
    timelineStore: new OperatorTimelineStore({
      path: join(mkdtempSync(join(tmpdir(), 'gameops-operator-route-timeline-')), 'timeline.json')
    })
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

test('raw operator 503 logs missing key diagnostics without exposing secrets', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  const logs: Record<string, unknown>[] = [];
  process.env.NODE_ENV = 'production';
  delete process.env.GAMEOPS_OPERATOR_KEY;
  const app = await buildLoggedTestApp(logs);

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/operator/brief',
      headers: {
        'x-gameops-operator-key': 'provided-secret'
      }
    });

    assert.equal(response.statusCode, 503);
    assert(logs.some((entry) => (
      entry.authStatus === 'misconfigured'
        && entry.configuredKeyState === 'missing'
        && entry.providedHeaderState === 'provided'
        && entry.nodeEnv === 'production'
    )));
    assert(!JSON.stringify(logs).includes('provided-secret'));
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

test('raw operator timeline requires key in production', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    const response = await app.inject({ method: 'GET', url: '/api/operator/timeline' });

    assert.equal(response.statusCode, 401);
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('operator timeline returns structured read-only events after brief collection', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    const briefResponse = await app.inject({
      method: 'GET',
      url: '/api/operator/brief',
      headers: {
        'x-gameops-operator-key': 'server-only-key'
      }
    });
    const timelineResponse = await app.inject({
      method: 'GET',
      url: '/api/operator/timeline',
      headers: {
        'x-gameops-operator-key': 'server-only-key'
      }
    });
    const body = JSON.parse(timelineResponse.body) as { readOnly: boolean; events: Array<{ type: string; summary: string }> };

    assert.equal(briefResponse.statusCode, 200);
    assert.equal(timelineResponse.statusCode, 200);
    assert.equal(body.readOnly, true);
    assert(body.events.some((event) => event.type === 'git'));
    assert(!timelineResponse.body.includes('super-secret-token-value'));
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('raw operator context pack requires key in production', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    const response = await app.inject({ method: 'GET', url: '/api/operator/context-pack' });

    assert.equal(response.statusCode, 401);
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('operator context pack returns sanitized admin context', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/operator/context-pack',
      headers: {
        'x-gameops-operator-key': 'server-only-key'
      }
    });
    const body = JSON.parse(response.body) as {
      readOnly: boolean;
      redactionApplied: boolean;
      sections: Array<{ title: string }>;
      evidence: unknown[];
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.readOnly, true);
    assert.equal(body.redactionApplied, true);
    assert(body.sections.some((section) => section.title === 'Current operator brief'));
    assert(body.evidence.length > 0);
    assert(!response.body.includes('super-secret-token-value'));
    assert(!response.body.includes('normal startup line'));
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('raw operator reason requires key in production', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/operator/reason',
      payload: {
        request: 'analyze-current-context'
      }
    });

    assert.equal(response.statusCode, 401);
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('operator reason builds context pack internally and returns placeholder analysis', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/operator/reason',
      headers: {
        'x-gameops-operator-key': 'server-only-key'
      },
      payload: {
        request: 'analyze-current-context'
      }
    });
    const body = JSON.parse(response.body) as {
      readOnly: boolean;
      engine: string;
      answerBullets: string[];
      evidence: Array<{ source: string; detail: string }>;
      limitations: string[];
      recommendedNextActions: string[];
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.readOnly, true);
    assert.equal(body.engine, 'placeholder');
    assert(body.answerBullets.some((bullet) => bullet.includes('Top attention')));
    assert(body.evidence.some((item) => item.source === 'repo-state' || item.detail.includes('GameOps Bridge')));
    assert(body.limitations.some((limitation) => limitation.includes('no Codex call')));
    assert(body.recommendedNextActions.length > 0);
    assert(!response.body.includes('server-only-key'));
    assert(!response.body.includes('super-secret-token-value'));
    assert(!response.body.includes('normal startup line'));
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('operator reason caps evidence and keeps sanitized output', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp({
    ...mockContext,
    repos: Array.from({ length: 20 }, (_, index) => ({
      ...mockContext.repos[0]!,
      label: `Repo ${index}`,
      modifiedCount: index + 1,
      lastCommit: {
        hash: `abcdef${index}`,
        date: mockContext.generatedAt,
        message: `Commit with DISCORD_TOKEN=super-secret-token-value ${index}`
      }
    })),
    collectionWarnings: Array.from({ length: 20 }, (_, index) => `Warning ${index} Bearer super-secret-token-value`)
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/operator/reason',
      headers: {
        'x-gameops-operator-key': 'server-only-key'
      },
      payload: {
        request: 'analyze-current-context',
        question: 'analyze current deployment safety'
      }
    });
    const body = JSON.parse(response.body) as {
      question: string;
      evidence: unknown[];
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.question, 'analyze current deployment safety');
    assert(body.evidence.length <= 12);
    assert(!response.body.includes('super-secret-token-value'));
    assert(!response.body.includes('DISCORD_TOKEN='));
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('operator reason handles empty context safely', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp({
    ...mockContext,
    pm2: {
      status: 'unavailable',
      processCount: 0,
      processes: [],
      message: 'pm2 unavailable'
    },
    disks: [],
    logs: [],
    repos: [],
    healthChecks: [],
    collectionWarnings: []
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/operator/reason',
      headers: {
        'x-gameops-operator-key': 'server-only-key'
      },
      payload: {
        request: 'analyze-current-context'
      }
    });
    const body = JSON.parse(response.body) as {
      readOnly: boolean;
      engine: string;
      answerBullets: string[];
      confidence: string;
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.readOnly, true);
    assert.equal(body.engine, 'placeholder');
    assert(body.answerBullets.length > 0);
    assert(['low', 'medium', 'high'].includes(body.confidence));
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('dashboard operator timeline does not require browser to send operator key', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    await app.inject({
      method: 'GET',
      url: '/api/dashboard/operator/brief',
      headers: {
        origin: 'https://servers.cdawgbot.xyz'
      }
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/operator/timeline',
      headers: {
        origin: 'https://servers.cdawgbot.xyz'
      }
    });

    assert.equal(response.statusCode, 200);
    assert(!response.body.includes('DISCORD_TOKEN'));
    assert(!response.body.includes('super-secret-token-value'));
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('dashboard operator daily brief summarizes timeline without browser operator key', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    await app.inject({
      method: 'GET',
      url: '/api/dashboard/operator/brief',
      headers: {
        origin: 'https://servers.cdawgbot.xyz'
      }
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/operator/daily-brief',
      headers: {
        origin: 'https://servers.cdawgbot.xyz'
      }
    });
    const body = JSON.parse(response.body) as {
      readOnly: boolean;
      headline: string;
      recommendations: string[];
      confidence: string;
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.readOnly, true);
    assert(body.headline.length > 0);
    assert(body.recommendations.length > 0);
    assert(['high', 'medium', 'low'].includes(body.confidence));
    assert(!response.body.includes('server-only-key'));
    assert(!response.body.includes('super-secret-token-value'));
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('dashboard operator changes summarizes timeline and current state without browser operator key', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/operator/changes',
      headers: {
        origin: 'https://servers.cdawgbot.xyz'
      }
    });
    const body = JSON.parse(response.body) as {
      readOnly: boolean;
      headline: string;
      meaningfulChanges: string[];
      recommendedNextAction: string;
      confidence: string;
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.readOnly, true);
    assert(body.headline.length > 0);
    assert(body.meaningfulChanges.length > 0);
    assert(body.recommendedNextAction.length > 0);
    assert(['high', 'medium', 'low'].includes(body.confidence));
    assert(!response.body.includes('server-only-key'));
    assert(!response.body.includes('super-secret-token-value'));
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('dashboard operator insights summarizes safe signals without browser operator key', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/operator/insights',
      headers: {
        origin: 'https://servers.cdawgbot.xyz'
      }
    });
    const body = JSON.parse(response.body) as {
      readOnly: boolean;
      insights: Array<{ title: string; summary: string; evidence: string[] }>;
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.readOnly, true);
    assert(body.insights.length > 0);
    assert(body.insights[0]?.title.length);
    assert(!response.body.includes('server-only-key'));
    assert(!response.body.includes('super-secret-token-value'));
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('dashboard operator ask answers supported questions without browser operator key', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/dashboard/operator/ask',
      headers: {
        origin: 'https://servers.cdawgbot.xyz'
      },
      payload: {
        question: 'what changed?'
      }
    });
    const body = JSON.parse(response.body) as {
      readOnly: boolean;
      intent: string;
      source: string;
      bullets: string[];
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.readOnly, true);
    assert.equal(body.intent, 'changes');
    assert.equal(body.source, 'changes');
    assert(body.bullets.length > 0);
    assert(!response.body.includes('server-only-key'));
    assert(!response.body.includes('super-secret-token-value'));
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});

test('dashboard operator ask rejects unsupported dashboard origins in production', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOperatorKey = process.env.GAMEOPS_OPERATOR_KEY;
  process.env.NODE_ENV = 'production';
  process.env.GAMEOPS_OPERATOR_KEY = 'server-only-key';
  const app = await buildTestApp();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/dashboard/operator/ask',
      payload: {
        question: 'health'
      }
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await app.close();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GAMEOPS_OPERATOR_KEY', previousOperatorKey);
  }
});
