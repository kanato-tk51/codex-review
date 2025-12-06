import Mustache from 'mustache';

export interface PromptContext {
  repoName: string;
  baseBranch?: string;
  targetBranch?: string;
  diffStat?: string;
  files?: { path: string; patch: string }[];
  extra?: Record<string, unknown>;
}

export function renderPrompt(template: string, context: PromptContext): string {
  return Mustache.render(template, context);
}
