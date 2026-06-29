import type { FastifyInstance } from 'fastify';
import { operatorBriefResponseSchema, operatorContextSchema } from '@gameops/shared';
import { getAllowedCorsOrigins } from '../services/cors-origin.js';
import { buildDashboardOperatorBrief, buildOperatorBrief, collectOperatorContext } from '../services/operator-collector.js';
import { getDashboardOperatorAccessStatus, getOperatorAuthDiagnostics, getOperatorAuthStatus } from '../services/operator-auth.js';
import type { OperatorContext } from '@gameops/shared';

interface RegisterOperatorRoutesOptions {
  collectContext?: () => Promise<OperatorContext>;
  allowedOrigins?: true | string[];
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

  app.get('/api/operator/context', async (request) => {
    assertOperatorAuthorized(request.headers, app.log);
    const context = await collectContext();
    return operatorContextSchema.parse(context);
  });

  app.get('/api/operator/brief', async (request) => {
    assertOperatorAuthorized(request.headers, app.log);
    const context = await collectContext();
    return operatorBriefResponseSchema.parse(buildOperatorBrief(context));
  });

  app.get('/api/dashboard/operator/brief', async (request) => {
    assertDashboardOperatorAllowed(request.headers, options.allowedOrigins);
    const context = await collectContext();
    return operatorBriefResponseSchema.parse(buildDashboardOperatorBrief(context));
  });
}
