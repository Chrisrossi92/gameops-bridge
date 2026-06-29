import type { FastifyInstance } from 'fastify';
import { operatorBriefResponseSchema, operatorContextSchema } from '@gameops/shared';
import { buildOperatorBrief, collectOperatorContext } from '../services/operator-collector.js';
import { getOperatorAuthStatus } from '../services/operator-auth.js';

function assertOperatorAuthorized(headers: { [key: string]: string | string[] | undefined }): void {
  const status = getOperatorAuthStatus({
    configuredKey: process.env.GAMEOPS_OPERATOR_KEY,
    providedHeader: headers['x-gameops-operator-key'],
    nodeEnv: process.env.NODE_ENV
  });

  if (status === 'allowed') {
    return;
  }

  if (status === 'misconfigured') {
    const error = new Error('Operator access is unavailable.');
    Object.assign(error, { statusCode: 503 });
    throw error;
  }

  const error = new Error('Operator access is unauthorized.');
  Object.assign(error, { statusCode: 401 });
  throw error;
}

export async function registerOperatorRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/operator/context', async (request) => {
    assertOperatorAuthorized(request.headers);
    const context = await collectOperatorContext();
    return operatorContextSchema.parse(context);
  });

  app.get('/api/operator/brief', async (request) => {
    assertOperatorAuthorized(request.headers);
    const context = await collectOperatorContext();
    return operatorBriefResponseSchema.parse(buildOperatorBrief(context));
  });
}
