import type { FastifyInstance } from 'fastify';
import { operatorBriefResponseSchema, operatorContextSchema } from '@gameops/shared';
import { buildOperatorBrief, collectOperatorContext } from '../services/operator-collector.js';

export async function registerOperatorRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/operator/context', async () => {
    const context = await collectOperatorContext();
    return operatorContextSchema.parse(context);
  });

  app.get('/api/operator/brief', async () => {
    const context = await collectOperatorContext();
    return operatorBriefResponseSchema.parse(buildOperatorBrief(context));
  });
}
