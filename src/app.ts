import Fastify from 'fastify';
import { healthRoute } from './routes/health.route';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_LOG_LEVEL ?? 'info',
    },
  });

  await app.register(healthRoute);

  return app;
}
