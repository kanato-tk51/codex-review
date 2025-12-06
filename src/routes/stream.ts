import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { onEvent } from '../services/event-bus';

/**
 * レビュー実行の進捗を SSE で配信するルートを登録する。
 */
export async function streamRoutes(app: FastifyInstance) {
  app.get('/api/reviews/:id/stream', { logLevel: 'error' }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const send = (event: any) => {
      if (event.data?.runId && event.data.runId !== id) return;
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event.data)}\n\n`);
    };
    const off = onEvent(send);
    req.raw.on('close', () => {
      off();
    });
  });
}
