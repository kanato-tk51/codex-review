import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';

export function gitClient(repoPath: string): SimpleGit {
  return simpleGit(repoPath);
}

export async function safeGitTopLevel(repoPath: string): Promise<string | undefined> {
  try {
    const g = gitClient(repoPath);
    return await g.revparse(['--show-toplevel']);
  } catch (err) {
    return undefined;
  }
}

export async function listBranches(repoPath: string): Promise<string[]> {
  const g = gitClient(repoPath);
  const branches = await g.branch();
  return Object.keys(branches.branches);
}

export async function diffFiles(repoPath: string, base: string, head: string, maxFiles = 200): Promise<string[]> {
  const g = gitClient(repoPath);
  const files = await g.diff([`${base}..${head}`, '--name-only']);
  return files.split('\n').filter(Boolean).slice(0, maxFiles);
}

export async function filePatch(repoPath: string, base: string, head: string, file: string): Promise<string> {
  const g = gitClient(repoPath);
  return g.diff([`${base}..${head}`, '--', file]);
}

export async function diffStat(repoPath: string, base: string, head: string): Promise<string> {
  const g = gitClient(repoPath);
  return g.diff(['--stat', `${base}..${head}`]);
}
