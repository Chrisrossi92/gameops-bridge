import type { FastifyInstance } from 'fastify';
import { operatorBriefResponseSchema, operatorContextSchema, operatorTimelineResponseSchema } from '@gameops/shared';
import { getAllowedCorsOrigins } from '../services/cors-origin.js';
import { buildDashboardOperatorBrief, buildOperatorBrief, collectOperatorContext } from '../services/operator-collector.js';
import { getDashboardOperatorAccessStatus, getOperatorAuthDiagnostics, getOperatorAuthStatus } from '../services/operator-auth.js';
import { redactSecrets } from '../services/operator-redaction.js';
import { appendOperatorTimelineEvents, OperatorTimelineStore } from '../services/operator-timeline.js';
import type { OperatorBrief, OperatorContext } from '@gameops/shared';

interface RegisterOperatorRoutesOptions {
  collectContext?: () => Promise<OperatorContext>;
  allowedOrigins?: true | string[];
  timelineStore?: OperatorTimelineStore;
}

interface OperatorAuthLogger {
  warn: (payload: Record<string, unknown>, message?: string) => void;
}

function assertOperatorAuthorized(
  headers: { [key: string]: string | string[] | undefined },
  logger?: OperatorAuthLogger
): void {
  const authParams = {
    configuredKey: process.env.GAMEOPS_OPERATOR_KEY,
    providedHeader: headers['x-gameops-operator-key'],
    nodeEnv: process.env.NODE_ENV
  };
  const status = getOperatorAuthStatus(authParams);

  if (status === 'allowed') {
    return;
  }

  const diagnostics = getOperatorAuthDiagnostics(authParams);

  if (status === 'misconfigured') {
    logger?.warn({
      route: '/api/operator',
      authStatus: status,
      ...diagnostics
    }, 'AI Operator admin auth misconfigured');
    const error = new Error('Operator access is unavailable.');
    Object.assign(error, { statusCode: 503 });
    throw error;
  }

  logger?.warn({
    route: '/api/operator',
    authStatus: status,
    ...diagnostics
  }, 'AI Operator admin auth rejected request');
  const error = new Error('Operator access is unauthorized.');
  Object.assign(error, { statusCode: 401 });
  throw error;
}

function assertDashboardOperatorAllowed(
  headers: { [key: string]: string | string[] | undefined },
  allowedOrigins: true | string[] = getAllowedCorsOrigins()
): void {
  const status = getDashboardOperatorAccessStatus({
    headers,
    nodeEnv: process.env.NODE_ENV,
    allowedOrigins
  });

  if (status === 'allowed') {
    return;
  }

  const error = new Error('Operator brief is unavailable.');
  Object.assign(error, { statusCode: 403 });
  throw error;
}

export async function registerOperatorRoutes(app: FastifyInstance, options: RegisterOperatorRoutesOptions = {}): Promise<void> {
  const collectContext = options.collectContext ?? (() => collectOperatorContext({ logger: app.log }));
  const timelineStore = options.timelineStore ?? new OperatorTimelineStore();

  function recordTimeline(context: OperatorContext, brief: OperatorBrief): void {
    try {
      appendOperatorTimelineEvents(context, brief, timelineStore);
    } catch (error) {
      app.log.warn({
        route: '/api/operator',
        reason: redactSecrets(error instanceof Error ? error.message : 'unknown_error')
      }, 'AI Operator timeline write failed');
    }
  }

  app.get('/api/operator/context', async (request) => {
    assertOperatorAuthorized(request.headers, app.log);
    const context = await collectContext();
    recordTimeline(context, buildOperatorBrief(context));
    return operatorContextSchema.parse(context);
  });

  app.get('/api/operator/brief', async (request) => {
    assertOperatorAuthorized(request.headers, app.log);
    const context = await collectContext();
    const brief = buildOperatorBrief(context);
    recordTimeline(context, brief);
    return operatorBriefResponseSchema.parse(brief);
  });

  app.get('/api/operator/timeline', async (request) => {
    assertOperatorAuthorized(request.headers, app.log);
    const query = request.query as { limit?: string };
    const limit = Number(query.limit ?? 50);
    return operatorTimelineResponseSchema.parse({
      generatedAt: new Date().toISOString(),
      readOnly: true,
      events: timelineStore.recentEvents(Number.isFinite(limit) ? limit : 50)
    });
  });

  app.get('/api/dashboard/operator/brief', async (request) => {
    assertDashboardOperatorAllowed(request.headers, options.allowedOrigins);
    const context = await collectContext();
    const brief = buildDashboardOperatorBrief(context);
    recordTimeline(context, brief);
    return operatorBriefResponseSchema.parse(brief);
  });

  app.get('/api/dashboard/operator/timeline', async (request) => {
    assertDashboardOperatorAllowed(request.headers, options.allowedOrigins);
    const query = request.query as { limit?: string };
    const limit = Number(query.limit ?? 20);
    return operatorTimelineResponseSchema.parse({
      generatedAt: new Date().toISOString(),
      readOnly: true,
      events: timelineStore.recentEvents(Number.isFinite(limit) ? limit : 20)
    });
  });
}
