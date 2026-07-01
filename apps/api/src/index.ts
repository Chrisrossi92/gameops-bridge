import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerActivityLogRoutes } from './routes/activity-log.js';
import { registerConnectorStatusRoutes } from './routes/connector-status.js';
import { registerDataFreshnessRoutes } from './routes/data-freshness.js';
import { registerEventRoutes } from './routes/events.js';
import { registerHealthRoute } from './routes/health.js';
import { registerPalworldIdentityApprovalRoutes } from './routes/palworld-identity-approvals.js';
import { registerPalworldIdentityLinkRoutes } from './routes/palworld-identity-links.js';
import { registerPalworldTelemetryRoutes } from './routes/palworld-telemetry.js';
import { registerPlayerEngagementRoutes } from './routes/player-engagement.js';
import { registerOperatorRoutes } from './routes/operator.js';
import { registerServerAliveRhythmRoutes } from './routes/server-alive-rhythm.js';
import { registerServerHealthRoutes } from './routes/server-health.js';
import { registerPlayerRoutes } from './routes/players.js';
import { registerServerCatalogRoutes } from './routes/servers.js';
import { registerServerStatusRoute } from './routes/server-status.js';
import { registerSettingsCapabilityRoutes } from './routes/settings-capabilities.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { getAllowedCorsOrigins } from './services/cors-origin.js';
import { initializeSessionStateStore } from './services/event-store.js';

const requestTimeout = Number(process.env.API_REQUEST_TIMEOUT_MS ?? 15_000);
const app = Fastify({
  logger: true,
  requestTimeout: Number.isFinite(requestTimeout) && requestTimeout > 0 ? requestTimeout : 15_000
});
const port = Number(process.env.PORT ?? 3001);
const host = process.env.API_HOST ?? process.env.HOST ?? '0.0.0.0';
initializeSessionStateStore();

await app.register(cors, {
  origin: getAllowedCorsOrigins()
});

await registerHealthRoute(app);
await registerServerCatalogRoutes(app);
await registerConnectorStatusRoutes(app);
await registerDataFreshnessRoutes(app);
await registerServerStatusRoute(app);
await registerSettingsCapabilityRoutes(app);
await registerEventRoutes(app);
await registerActivityLogRoutes(app);
await registerSessionRoutes(app);
await registerPlayerEngagementRoutes(app);
await registerServerAliveRhythmRoutes(app);
await registerServerHealthRoutes(app);
await registerPlayerRoutes(app);
await registerPalworldTelemetryRoutes(app);
await registerPalworldIdentityLinkRoutes(app);
await registerPalworldIdentityApprovalRoutes(app);
await registerOperatorRoutes(app);

app.listen({ port, host })
  .then(() => {
    console.log(`API running at http://${host}:${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
