import Fastify from 'fastify';
import fastifySensible from '@fastify/sensible';
import fastifyCors from '@fastify/cors';
import path from 'path';
import fastifyStatic from '@fastify/static';
import { healthRoutes } from './routes/health';
import { repoRoutes } from './routes/repos';
import { templateRoutes } from './routes/templates';
import { reviewRoutes } from './routes/reviews';
import { streamRoutes } from './routes/stream';
import { migrate } from './db/sqlite';

export function createServer() {
  const app = Fastify({ logger: true });
  app.register(fastifySensible);
  app.register(fastifyCors, { origin: false });
  migrate();

  app.register(healthRoutes);
  app.register(repoRoutes);
  app.register(templateRoutes);
  app.register(reviewRoutes);
  app.register(streamRoutes);

  const staticDir = path.join(__dirname, '..', 'web-dist');
  app.register(fastifyStatic, {
    root: staticDir,
    prefix: '/',
    index: ['index.html'],
  });

  return app;
}

export async function startServer(port = 5273) {
  const app = createServer();
  await app.listen({ port, host: '127.0.0.1' });
  return app;
}
