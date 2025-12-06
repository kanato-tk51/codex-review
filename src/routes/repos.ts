import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { addRepo, listRepos } from '../services/repo-service';
import { listBranches } from '../git/git-utils';

/**
 * リポジトリ関連のAPIルートを登録する。
 * - 登録済みリポ一覧取得
 * - リポジトリ追加
 * - ブランチ一覧取得
 */
export async function repoRoutes(app: FastifyInstance) {
  app.get('/api/repos', async () => listRepos());

  app.post('/api/repos', async (req: FastifyRequest<{ Body: { path?: string } }>, reply: FastifyReply) => {
    const body = req.body;
    if (!body?.path) return reply.status(400).send({ error: 'path required' });
    try {
      const repo = await addRepo(body.path);
      return repo;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  app.get('/api/repos/:id/branches', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const repos = listRepos();
    const repo = repos.find((r) => r.id === id);
    if (!repo) return reply.status(404).send({ error: 'repo not found' });
    try {
      const branches = await listBranches(repo.path);
      return { branches };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
