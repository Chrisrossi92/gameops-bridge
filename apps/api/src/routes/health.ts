import type { FastifyInstance } from 'fastify';

interface HealthResponse {
  ok: true;
  service: 'api';
  timestamp: string;
}

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get('/health', async (): Promise<HealthResponse> => {
    return {
      ok: true,
      service: 'api',
      timestamp: new Date().toISOString()
    };
  });
}
