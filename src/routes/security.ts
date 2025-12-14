import { FastifyInstance } from 'fastify';
import { issueCsrfToken } from '../services/security';

export async function securityRoutes(app: FastifyInstance) {
  app.log.info('register /api/csrf');
  app.get('/api/csrf', async (_, reply) => {
    return issueCsrfToken(reply);
  });
}
