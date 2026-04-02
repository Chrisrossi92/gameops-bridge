import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerEventRoutes } from './routes/events.js';
import { registerHealthRoute } from './routes/health.js';
import { registerServerStatusRoute } from './routes/server-status.js';
import { registerSessionRoutes } from './routes/sessions.js';
const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 3001);
await app.register(cors, {
    origin: true
});
await registerHealthRoute(app);
await registerServerStatusRoute(app);
await registerEventRoutes(app);
await registerSessionRoutes(app);
app.listen({ port, host: '0.0.0.0' })
    .then(() => {
    console.log(`API running at http://localhost:${port}`);
})
    .catch((err) => {
    app.log.error(err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map