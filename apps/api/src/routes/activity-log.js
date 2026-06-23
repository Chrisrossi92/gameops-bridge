import { activityLogResponseSchema } from '@gameops/shared';
import { getActivityLogForServer } from '../services/activity-log.js';
export async function registerActivityLogRoutes(app) {
    app.get('/servers/:serverId/activity-log', async (request, reply) => {
        const serverId = request.params.serverId.trim();
        if (!serverId) {
            reply.code(400);
            return { error: 'Invalid serverId' };
        }
        const parsedLimit = Number(request.query.limit);
        const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;
        return activityLogResponseSchema.parse({
            serverId,
            items: getActivityLogForServer(serverId, limit)
        });
    });
}
//# sourceMappingURL=activity-log.js.map