import {
  connectorHeartbeatRequestSchema,
  connectorHeartbeatResponseSchema,
  serverOperationalStatusSchema,
  type ConnectorHeartbeatRequest,
  type ConnectorHeartbeatResponse,
  type ServerOperationalStatus
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { isServerConfigured } from '../services/server-config.js';
import { getServerOperationalStatus, recordConnectorHeartbeat } from '../services/connector-heartbeat.js';

export async function registerConnectorStatusRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ConnectorHeartbeatRequest }>('/connectors/heartbeat', async (request, reply): Promise<ConnectorHeartbeatResponse | { error: string }> => {
    const parsed = connectorHeartbeatRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      reply.code(400);
      return { error: 'Invalid connector heartbeat payload' };
    }

    recordConnectorHeartbeat(parsed.data);

    return connectorHeartbeatResponseSchema.parse({
      ok: true,
      accepted: true
    });
  });

  app.get<{ Params: { serverId: string } }>('/servers/:serverId/operational-status', async (request, reply): Promise<ServerOperationalStatus | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    return serverOperationalStatusSchema.parse(
      getServerOperationalStatus(serverId, isServerConfigured(serverId))
    );
  });
}
