import { listBranches } from '../git/git-utils';

export type BranchStatus = {
  status: 'ok' | 'error';
  branches: string[];
  error?: string;
  fetchedAt: number;
};

const cache = new Map<string, BranchStatus>();

export async function refreshBranches(repoPath: string): Promise<BranchStatus> {
  try {
    const branches = await listBranches(repoPath);
    const entry: BranchStatus = { status: 'ok', branches, fetchedAt: Date.now() };
    cache.set(repoPath, entry);
    return entry;
  } catch (err: any) {
    const entry: BranchStatus = {
      status: 'error',
      branches: [],
      fetchedAt: Date.now(),
      error: err?.message || 'failed to list branches',
    };
    cache.set(repoPath, entry);
    return entry;
  }
}

export function getBranchStatus(repoPath: string) {
  return cache.get(repoPath);
}
