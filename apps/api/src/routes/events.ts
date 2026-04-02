import {
  ingestEventsRequestSchema,
  recentEventsResponseSchema,
  type IngestEventsRequest,
  type RecentEventsResponse
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { addEvents, getRecentEventsForServer } from '../services/event-store.js';

interface IngestEventsResponse {
  ok: true;
  accepted: number;
}

export async function registerEventRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: IngestEventsRequest }>('/events/ingest', async (request, reply): Promise<IngestEventsResponse | { error: string }> => {
    const parsed = ingestEventsRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      reply.code(400);
      return { error: 'Invalid ingest payload' };
    }

    addEvents(parsed.data.events);

    return {
      ok: true,
      accepted: parsed.data.events.length
    };
  });

  app.get<{ Params: { serverId: string }; Querystring: { limit?: string } }>('/servers/:serverId/events', async (request, reply): Promise<RecentEventsResponse | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    const parsedLimit = Number(request.query.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 10;

    return recentEventsResponseSchema.parse({
      serverId,
      events: getRecentEventsForServer(serverId, limit)
    });
  });
}
