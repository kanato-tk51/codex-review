export type RunStatus = 'queued' | 'running' | 'done' | 'error';
export type TaskStatus = RunStatus;

export interface RepoRecord {
  id: string;
  name: string;
  path: string;
  created_at: string;
}

export interface TemplateRecord {
  id: string;
  name: string;
  category?: string;
  system_prompt?: string;
  user_prompt_template: string;
  default_model?: string;
  created_at: string;
}

export interface ReviewRunRecord {
  id: string;
  repo_id: string;
  base_branch?: string;
  target_branch?: string;
  status: RunStatus;
  created_at: string;
  finished_at?: string;
}

export interface ReviewTaskRecord {
  id: string;
  run_id: string;
  template_id: string;
  status: TaskStatus;
  result_summary?: string;
  result_detail?: string;
  error?: string;
  started_at?: string;
  finished_at?: string;
}

export interface ReviewRequestOptions {
  maxFiles?: number;
  maxTokens?: number;
  parallelism?: number;
  allowExternalSend?: boolean;
  modelOverride?: string;
}

export interface ReviewRequestBody {
  repoId: string;
  baseBranch?: string;
  targetBranch?: string;
  templateIds: string[];
  options?: ReviewRequestOptions;
}

export interface LlmCallMeta {
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost_usd?: number;
}
