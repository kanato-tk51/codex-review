import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/sqlite';
import { ReviewRequestBody, ReviewRunRecord, ReviewTaskRecord, RunStatus, TaskStatus, RepoRecord } from '../types';
import { getRepo } from './repo-service';
import { getTemplate } from '../templates/template-store';
import { getCachedAutoRepos } from './repo-scan-service';

const db = getDb();

/**
 * レビュー実行を作成し、テンプレートごとのタスクを生成する。
 * @throws リポジトリまたはテンプレートが存在しない場合
 */
export async function createReviewRun(body: ReviewRequestBody): Promise<{ run: ReviewRunRecord; tasks: ReviewTaskRecord[] }> {
  let repo: RepoRecord | undefined = getRepo(body.repoId);
  if (!repo) {
    const autos = await getCachedAutoRepos();
    const found = autos.find((r) => r.id === body.repoId);
    if (found) {
      db.prepare('INSERT OR IGNORE INTO repos (id, name, path) VALUES (@id,@name,@path)').run({
        id: found.id,
        name: found.name,
        path: found.path,
      });
      repo = getRepo(found.id);
    }
  }
  if (!repo) throw new Error('Repo not found');

  const runId = uuidv4();
  const run: ReviewRunRecord = {
    id: runId,
    repo_id: repo.id,
    base_branch: body.baseBranch,
    target_branch: body.targetBranch,
    status: 'queued',
    created_at: new Date().toISOString(),
  };
  db.prepare(`INSERT INTO review_runs (id, repo_id, base_branch, target_branch, status) VALUES (@id,@repo_id,@base_branch,@target_branch,@status)`).run(run);

  const tasks: ReviewTaskRecord[] = body.templateIds.map((tid) => {
    if (!getTemplate(tid)) throw new Error('Template not found: ' + tid);
    const task: ReviewTaskRecord = {
      id: uuidv4(),
      run_id: runId,
      template_id: tid,
      status: 'queued',
    };
    db.prepare(`INSERT INTO review_tasks (id, run_id, template_id, status, started_at) VALUES (@id,@run_id,@template_id,@status,NULL)`).run(task);
    return task;
  });
  return { run, tasks };
}

/** レビュー実行を新しい順で取得する。 */
export function listRuns(): ReviewRunRecord[] {
  return db.prepare('SELECT * FROM review_runs ORDER BY created_at DESC').all() as ReviewRunRecord[];
}

/** レビュー実行をIDで取得する。 */
export function getRun(id: string): ReviewRunRecord | undefined {
  return db.prepare('SELECT * FROM review_runs WHERE id = ?').get(id) as ReviewRunRecord | undefined;
}

/** 実行に紐づくタスク一覧を取得する。 */
export function listTasksForRun(runId: string): ReviewTaskRecord[] {
  return db.prepare('SELECT * FROM review_tasks WHERE run_id = ? ORDER BY rowid').all(runId) as ReviewTaskRecord[];
}

/** タスクのステータスを更新し、開始時刻が必要なら同時に記録する。 */
export function updateTaskStatus(id: string, status: TaskStatus, started?: boolean) {
  const now = new Date().toISOString();
  if (started) {
    db.prepare('UPDATE review_tasks SET status=?, started_at=? WHERE id=?').run(status, now, id);
  } else {
    db.prepare('UPDATE review_tasks SET status=? WHERE id=?').run(status, id);
  }
}

/** タスク完了・失敗時に結果や要約・エラーを保存する。 */
export function finishTask(id: string, status: TaskStatus, detail?: string, summary?: string, error?: string) {
  const now = new Date().toISOString();
  db.prepare('UPDATE review_tasks SET status=?, result_detail=?, result_summary=?, error=?, finished_at=? WHERE id=?')
    .run(status, detail, summary, error, now, id);
}

/** 実行ステータスを更新し、完了時は終了時刻を付与する。 */
export function markRunStatus(id: string, status: RunStatus) {
  const now = status === 'done' || status === 'error' ? new Date().toISOString() : null;
  db.prepare('UPDATE review_runs SET status=?, finished_at=? WHERE id=?').run(status, now, id);
}

/** 残タスクが無ければ実行をdoneに遷移させる。 */
export function refreshRunCompletion(runId: string) {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM review_tasks WHERE run_id=? AND status IN ('queued','running')").get(runId) as any;
  if (row?.cnt === 0) {
    markRunStatus(runId, 'done');
  }
}
