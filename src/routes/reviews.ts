import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createReviewRun, getRun, listRuns, listTasksForRun, markRunStatus, refreshRunCompletion } from '../services/review-service';
import { ReviewRequestBody } from '../types';
import { configureFromOptions, enqueue } from '../jobs/manager';
import { runTask } from '../jobs/worker';
import { loadConfig } from '../config';
import { getRepo } from '../services/repo-service';
import { getTemplate } from '../templates/template-store';
import { emitEvent } from '../services/event-bus';

/**
 * レビュー実行・取得に関するAPIルートを登録する。
 * - 実行開始
 * - 実行/タスクの取得
 * - SSE進捗ストリーム
 */
export async function reviewRoutes(app: FastifyInstance) {
  app.get('/api/reviews', async () => {
    return listRuns().map((run) => ({ ...run, tasks: listTasksForRun(run.id) }));
  });

  app.get('/api/reviews/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const run = getRun(id);
    if (!run) return reply.status(404).send({ error: 'not found' });
    return { run, tasks: listTasksForRun(id) };
  });

  app.post('/api/reviews', async (req: FastifyRequest<{ Body: ReviewRequestBody }>, reply: FastifyReply) => {
    const body = req.body;
    if (!body?.repoId || !body?.templateIds?.length) {
      return reply.status(400).send({ error: 'repoId and templateIds required' });
    }

    const config = loadConfig();
    configureFromOptions(body.options);
    const { run, tasks } = await createReviewRun(body);
    markRunStatus(run.id, 'running');

    // enqueue each task
    tasks.forEach((task) => {
      enqueue(async () => {
        await runTask({ run, task, options: body.options || {}, appConfig: config });
        refreshRunCompletion(run.id);
      }).catch((err) => {
        emitEvent({ type: 'task_failed', data: { taskId: task.id, runId: run.id, error: err?.message } });
      });
    });

    emitEvent({ type: 'run_started', data: { runId: run.id } });
    return { runId: run.id, taskIds: tasks.map((t) => t.id) };
  });
}
