import 'reflect-metadata';
import Fastify from 'fastify';
import { Container } from 'typedi';
import { DatabaseService } from './database';
import { healthRoute } from './routes/health.route';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_LOG_LEVEL ?? 'info',
    },
  });

  const database = Container.get(DatabaseService);

  app.addHook('onReady', async () => {
    await database.connect();
    app.log.info('Database connected');
  });

  app.addHook('onClose', async () => {
    await database.disconnect();
    app.log.info('Database disconnected');
  });

  await app.register(healthRoute);

  return app;
}
