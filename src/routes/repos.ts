import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { addRepo, deleteRepo, getRepo, listRepoSummaries, toRepoSummary } from '../services/repo-service';
import { getCachedAutoRepos, refreshAutoRepoCache, suppressAutoRepo } from '../services/repo-scan-service';
import { getBranchStatus, refreshBranches } from '../services/branch-cache';

/**
 * リポジトリ関連のAPIルートを登録する。
 * - 登録済みリポ一覧取得
 * - リポジトリ追加
 * - ブランチ一覧取得
 */
export async function repoRoutes(app: FastifyInstance) {
  app.log.info('register /api/repos routes');
  app.get('/api/repos/auto', async () => getCachedAutoRepos());

  app.post('/api/repos/auto/refresh', async () => refreshAutoRepoCache());

  app.get('/api/repos/manual', async () => listRepoSummaries());

  app.get('/api/repos', async () => listRepoSummaries());

  app.delete('/api/repos/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const manual = getRepo(id);
    if (manual) {
      deleteRepo(id);
      return { ok: true };
    }
    suppressAutoRepo(id);
    return { ok: true };
  });

  app.post('/api/repos/manual', async (req: FastifyRequest<{ Body: { path?: string } }>, reply: FastifyReply) => {
    const body = req.body;
    if (!body?.path) return reply.status(400).send({ error: 'path required' });
    try {
      const repo = await addRepo(body.path);
      return await toRepoSummary(repo);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  app.post('/api/repos', async (req: FastifyRequest<{ Body: { path?: string } }>, reply: FastifyReply) => {
    const body = req.body;
    if (!body?.path) return reply.status(400).send({ error: 'path required' });
    try {
      const repo = await addRepo(body.path);
      return await toRepoSummary(repo);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  app.get('/api/repos/:id/branches', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const repo = getRepo(id);
    if (!repo) return reply.status(404).send({ error: 'repo not found' });
    const cached = getBranchStatus(repo.path);
    if (cached) return { status: cached.status, branches: cached.branches, error: cached.error };
    const fresh = await refreshBranches(repo.path);
    return { status: fresh.status, branches: fresh.branches, error: fresh.error };
  });
}
