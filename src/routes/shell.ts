import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { listAllowedCommands, onShellEvent, startShellRun, startCustomShellRun } from '../services/shell-service';
import { checkRateLimit, isShellApiEnabled, verifyCsrf } from '../services/security';

export async function shellRoutes(app: FastifyInstance) {
  app.get('/api/shell/commands', async (_, reply) => {
    if (!isShellApiEnabled()) return reply.status(403).send({ error: 'shell api disabled' });
    return { commands: listAllowedCommands() };
  });

  app.post('/api/shell/run', async (req: FastifyRequest<{ Body: { commandId?: string } }>, reply: FastifyReply) => {
    if (!isShellApiEnabled()) return reply.status(403).send({ error: 'shell api disabled' });
    if (!verifyCsrf(req)) return reply.status(403).send({ error: 'csrf check failed' });
    const rateKey = `${req.ip}|${req.headers.origin || 'same-origin'}`;
    const rate = checkRateLimit(rateKey);
    if (!rate.allowed) return reply.status(429).send({ error: 'rate limited', resetAt: rate.resetAt });

    const commandId = req.body?.commandId;
    if (!commandId) return reply.status(400).send({ error: 'commandId required' });
    try {
      const { runId, command } = startShellRun(commandId);
      return { runId, command };
    } catch (err: any) {
      return reply.status(400).send({ error: err?.message || 'failed to start command' });
    }
  });

  app.post('/api/shell/run-custom', async (req: FastifyRequest<{ Body: { command?: string; cwd?: string } }>, reply: FastifyReply) => {
    if (!isShellApiEnabled()) return reply.status(403).send({ error: 'shell api disabled' });
    if (!verifyCsrf(req)) return reply.status(403).send({ error: 'csrf check failed' });
    const rateKey = `${req.ip}|${req.headers.origin || 'same-origin'}`;
    const rate = checkRateLimit(rateKey);
    if (!rate.allowed) return reply.status(429).send({ error: 'rate limited', resetAt: rate.resetAt });

    const cmd = req.body?.command;
    if (!cmd) return reply.status(400).send({ error: 'command required' });
    try {
      const { runId, command } = startCustomShellRun(cmd, req.body?.cwd);
      return { runId, command };
    } catch (err: any) {
      return reply.status(400).send({ error: err?.message || 'failed to start command' });
    }
  });

  app.get('/api/shell/runs/:id/stream', { logLevel: 'error' }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isShellApiEnabled()) return reply.status(403).send({ error: 'shell api disabled' });
    const { id } = req.params;
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const send = (event: { type: string; data?: any; code?: number | null }) => {
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify({ data: event.data, code: event.code })}\n\n`);
    };
    const off = onShellEvent(id, (event) => send(event));
    req.raw.on('close', () => {
      off();
    });
  });
}
