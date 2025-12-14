import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/sqlite';
import { RepoRecord } from '../types';
import { safeGitTopLevel } from '../git/git-utils';
import { refreshBranches } from './branch-cache';
import { RepoSummary } from './repo-scan-service';

const db = getDb();

/** 登録済みリポジトリを新しい順で取得する。 */
export function listRepos(): RepoRecord[] {
  const stmt = db.prepare('SELECT * FROM repos ORDER BY created_at DESC');
  return stmt.all() as RepoRecord[];
}

/**
 * リポジトリパスを登録し、既に存在する場合は既存レコードを返す。
 * @throws パスが存在しない・gitでない場合にエラー
 */
export async function addRepo(repoPath: string): Promise<RepoRecord> {
  const normalized = path.resolve(repoPath);
  if (!fs.existsSync(normalized)) throw new Error('Path does not exist');
  const toplevel = await safeGitTopLevel(normalized);
  if (!toplevel) throw new Error('Not a git repository');

  const id = uuidv4();
  const name = path.basename(toplevel);
  const stmt = db.prepare('INSERT OR IGNORE INTO repos (id, name, path) VALUES (@id, @name, @path)');
  stmt.run({ id, name, path: toplevel });
  const row = db.prepare('SELECT * FROM repos WHERE path = ?').get(toplevel) as RepoRecord;
  return row;
}

/** ID でリポジトリを取得する。 */
export function getRepo(id: string): RepoRecord | undefined {
  return db.prepare('SELECT * FROM repos WHERE id = ?').get(id) as RepoRecord | undefined;
}

export function deleteRepo(id: string) {
  db.prepare('DELETE FROM repos WHERE id = ?').run(id);
}

export async function toRepoSummary(repo: RepoRecord): Promise<RepoSummary> {
  const branch = await refreshBranches(repo.path);
  const stats = fs.statSync(repo.path);
  return {
    id: repo.id,
    name: repo.name,
    path: repo.path,
    source: 'manual',
    branches: branch.branches,
    branchStatus: branch.status,
    branchError: branch.error,
    fetchedAt: branch.fetchedAt,
    createdAt: stats.birthtimeMs,
  };
}

export async function listRepoSummaries(): Promise<RepoSummary[]> {
  const repos = listRepos();
  return Promise.all(repos.map((repo) => toRepoSummary(repo)));
}
