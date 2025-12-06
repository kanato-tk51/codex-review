import { FastifyInstance } from 'fastify';

/**
 * ヘルスチェック用ルートを登録する。
 * Fastify が起動しリクエストを処理できるかを簡易に確認するために利用する。
 */
export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => ({ ok: true }));
}
