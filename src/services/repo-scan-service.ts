import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';
import { refreshBranches } from './branch-cache';

export type RepoSource = 'auto' | 'manual';

export type RepoSummary = {
  id: string;
  name: string;
  path: string;
  source: RepoSource;
  branches: string[];
  branchStatus: 'ok' | 'error';
  branchError?: string;
  fetchedAt?: number;
  createdAt?: number;
};

const EXCLUDE = new Set(['node_modules', '.cache', 'dist', 'web-dist']);

export function makeRepoId(repoPath: string) {
  return createHash('sha1').update(repoPath).digest('hex');
}

function isGitRepo(dirPath: string) {
  return fs.existsSync(path.join(dirPath, '.git'));
}

export function getScanRoot() {
  if (process.env.REPO_SCAN_ROOT) return path.resolve(process.env.REPO_SCAN_ROOT);
  // デフォルトはPCのルート直下ではなく、ホームディレクトリ直下をスキャンする
  // （起動場所に依存せず、ユーザーのリポがある可能性が高いため）。
  return os.homedir();
}

let autoCache: RepoSummary[] | null = null;
const suppressedIds = new Set<string>();

export function suppressAutoRepo(id: string) {
  suppressedIds.add(id);
  if (autoCache) autoCache = autoCache.filter((r) => r.id !== id);
}

export async function scanRootRepos(): Promise<RepoSummary[]> {
  const root = getScanRoot();
  const dirents = fs.readdirSync(root, { withFileTypes: true });
  const candidates = dirents.filter((d) => d.isDirectory() && !EXCLUDE.has(d.name) && !d.name.startsWith('.'));
  const repos = candidates
    .map((dirent) => {
      const fullPath = path.join(root, dirent.name);
      if (!isGitRepo(fullPath)) return null;
      const stats = fs.statSync(fullPath);
      return { id: makeRepoId(fullPath), name: dirent.name, path: fullPath, createdAt: stats.birthtimeMs } as const;
    })
    .filter(Boolean) as { id: string; name: string; path: string; createdAt: number }[];

  // include root itself if it is a git repo
  if (isGitRepo(root)) {
    const stats = fs.statSync(root);
    repos.unshift({ id: makeRepoId(root), name: path.basename(root), path: root, createdAt: stats.birthtimeMs });
  }

  const results = await Promise.all(
    repos.map(async (repo) => {
      const branch = await refreshBranches(repo.path);
      return {
        ...repo,
        source: 'auto' as const,
        branches: branch.branches,
        branchStatus: branch.status,
        branchError: branch.error,
        fetchedAt: branch.fetchedAt,
        createdAt: repo.createdAt,
      };
    })
  );

  return results;
}

async function ensureAutoCache() {
  if (!autoCache) {
    autoCache = await scanRootRepos();
  }
}

export async function getCachedAutoRepos() {
  await ensureAutoCache();
  return (autoCache || []).filter((r) => !suppressedIds.has(r.id));
}

export async function refreshAutoRepoCache() {
  autoCache = await scanRootRepos();
  suppressedIds.clear();
  return autoCache;
}
