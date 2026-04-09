import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerEventRoutes } from './routes/events.js';
import { registerHealthRoute } from './routes/health.js';
import { registerPalworldIdentityApprovalRoutes } from './routes/palworld-identity-approvals.js';
import { registerPalworldIdentityLinkRoutes } from './routes/palworld-identity-links.js';
import { registerPalworldTelemetryRoutes } from './routes/palworld-telemetry.js';
import { registerPlayerRoutes } from './routes/players.js';
import { registerServerCatalogRoutes } from './routes/servers.js';
import { registerServerStatusRoute } from './routes/server-status.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { initializeSessionStateStore } from './services/event-store.js';

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 3001);
initializeSessionStateStore();

await app.register(cors, {
  origin: true
});

await registerHealthRoute(app);
await registerServerCatalogRoutes(app);
await registerServerStatusRoute(app);
await registerEventRoutes(app);
await registerSessionRoutes(app);
await registerPlayerRoutes(app);
await registerPalworldTelemetryRoutes(app);
await registerPalworldIdentityLinkRoutes(app);
await registerPalworldIdentityApprovalRoutes(app);

app.listen({ port, host: '0.0.0.0' })
  .then(() => {
    console.log(`API running at http://localhost:${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
