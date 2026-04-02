import { getMockServerStatus } from '../services/mock-server-status.js';
export async function registerServerStatusRoute(app) {
    app.get('/servers/:serverId/status', async (request, reply) => {
        const serverId = request.params.serverId.trim();
        if (!serverId) {
            reply.code(400);
            return {
                error: 'Invalid serverId'
            };
        }
        return getMockServerStatus(serverId);
    });
}
//# sourceMappingURL=server-status.js.map