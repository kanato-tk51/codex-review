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
import { shellRoutes } from './routes/shell';
import { securityRoutes } from './routes/security';
import { migrate } from './db/sqlite';

export function createServer() {
  const app = Fastify({ logger: true });
  app.register(fastifySensible);
  app.register(fastifyCors, { origin: false });
  migrate();

  // Debug startup info to verify which build is running
  app.log.info({ cwd: process.cwd(), ts: new Date().toISOString() }, 'server bootstrap');

  app.register(healthRoutes);
  app.register(repoRoutes);
  app.register(templateRoutes);
  app.register(reviewRoutes);
  app.register(streamRoutes);
  app.register(shellRoutes);
  app.register(securityRoutes);

  app.after(() => {
    const routes = app.printRoutes();
    app.log.info({ routes }, 'registered routes');
  });

  const staticDir = path.join(__dirname, '..', 'web-dist');
  app.register(fastifyStatic, {
    root: staticDir,
    prefix: '/',
    index: ['index.html'],
  });

  // SPA fallback: serve index.html for non-API GETs
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.method === 'GET' && !req.url.startsWith('/api')) {
      return reply.sendFile('index.html');
    }
    return reply.notFound();
  });

  return app;
}

export async function startServer(port = 5273) {
  const app = createServer();
  await app.listen({ port, host: '127.0.0.1' });
  return app;
}
