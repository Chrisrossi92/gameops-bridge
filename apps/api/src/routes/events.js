import { ingestEventsRequestSchema, recentEventsResponseSchema } from '@gameops/shared';
import { addEvents, getRecentEventsForServer } from '../services/event-store.js';
export async function registerEventRoutes(app) {
    app.post('/events/ingest', async (request, reply) => {
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
    app.get('/servers/:serverId/events', async (request, reply) => {
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
//# sourceMappingURL=events.js.map