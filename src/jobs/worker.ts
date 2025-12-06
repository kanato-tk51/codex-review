import { ReviewRequestOptions, ReviewRunRecord, ReviewTaskRecord } from '../types';
import { getRepo } from '../services/repo-service';
import { getTemplate } from '../templates/template-store';
import { diffFiles, filePatch, diffStat } from '../git/git-utils';
import { renderPrompt } from '../llm/prompt-builder';
import { callLlm } from '../llm/llm-client';
import { AppConfig } from '../config';
import { finishTask, markRunStatus, updateTaskStatus } from '../services/review-service';
import { emitEvent } from '../services/event-bus';

export interface TaskInput {
  run: ReviewRunRecord;
  task: ReviewTaskRecord;
  options: ReviewRequestOptions;
  appConfig: AppConfig;
}

export async function runTask(input: TaskInput) {
  const { run, task, options, appConfig } = input;
  const repo = getRepo(run.repo_id);
  if (!repo) throw new Error('Repo missing');
  const template = getTemplate(task.template_id);
  if (!template) throw new Error('Template missing');

  try {
    updateTaskStatus(task.id, 'running', true);
    emitEvent({ type: 'task_started', data: { taskId: task.id, runId: run.id } });
    const base = run.base_branch || 'origin/main';
    const head = run.target_branch || 'HEAD';
    const maxFiles = options.maxFiles ?? appConfig.maxFiles ?? 50;
    const files = await diffFiles(repo.path, base, head, maxFiles);
    const patches: { path: string; patch: string }[] = [];
    for (const f of files) {
      const patch = await filePatch(repo.path, base, head, f);
      patches.push({ path: f, patch });
    }
    const stat = await diffStat(repo.path, base, head);
    const prompt = renderPrompt(template.user_prompt_template, {
      repoName: repo.name,
      baseBranch: base,
      targetBranch: head,
      diffStat: stat,
      files: patches,
    });

    const model = options.modelOverride || template.default_model || appConfig.defaultModel || 'gpt-4.1-mini';
    let fullText = '';
    const res = await callLlm(prompt, model, appConfig, (chunk) => {
      fullText += chunk;
      emitEvent({ type: 'task_progress', data: { taskId: task.id, runId: run.id, chunk } });
    });
    if (!fullText && res.text) fullText = res.text;

    const summary = fullText.slice(0, 600);
    finishTask(task.id, 'done', fullText, summary, undefined);
    emitEvent({ type: 'task_completed', data: { taskId: task.id, runId: run.id } });
  } catch (err: any) {
    finishTask(task.id, 'error', undefined, undefined, err?.message || String(err));
    markRunStatus(run.id, 'error');
    emitEvent({ type: 'task_failed', data: { taskId: task.id, runId: run.id, error: err?.message } });
    throw err;
  }
}
