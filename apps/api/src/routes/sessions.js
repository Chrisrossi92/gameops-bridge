import { activeSessionsResponseSchema, recentSessionsResponseSchema } from '@gameops/shared';
import { getActiveSessionsForServer, getRecentClosedSessionsForServer } from '../services/event-store.js';
export async function registerSessionRoutes(app) {
    app.get('/servers/:serverId/sessions/active', async (request, reply) => {
        const serverId = request.params.serverId.trim();
        if (!serverId) {
            reply.code(400);
            return { error: 'Invalid serverId' };
        }
        return activeSessionsResponseSchema.parse({
            serverId,
            sessions: getActiveSessionsForServer(serverId)
        });
    });
    app.get('/servers/:serverId/sessions/recent', async (request, reply) => {
        const serverId = request.params.serverId.trim();
        if (!serverId) {
            reply.code(400);
            return { error: 'Invalid serverId' };
        }
        const parsedLimit = Number(request.query.limit);
        const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 10;
        return recentSessionsResponseSchema.parse({
            serverId,
            sessions: getRecentClosedSessionsForServer(serverId, limit)
        });
    });
}
//# sourceMappingURL=sessions.js.map