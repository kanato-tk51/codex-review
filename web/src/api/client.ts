export type RepoSummary = {
  id: string;
  name: string;
  path: string;
  source: 'auto' | 'manual';
  branches: string[];
  branchStatus: 'ok' | 'error';
  branchError?: string;
  fetchedAt?: number;
  createdAt?: number;
};

export type TemplateRecord = {
  id: string;
  name: string;
  category?: string;
  system_prompt?: string;
  user_prompt_template: string;
  default_model?: string;
};

export type RunStatus = 'queued' | 'running' | 'done' | 'error';

export type ReviewRun = {
  id: string;
  repo_id: string;
  base_branch?: string;
  target_branch?: string;
  status: RunStatus;
  created_at: string;
  finished_at?: string;
};

export type ReviewTask = {
  id: string;
  run_id: string;
  template_id: string;
  status: RunStatus;
  result_summary?: string;
  result_detail?: string;
  error?: string;
  started_at?: string;
  finished_at?: string;
};

export type ReviewRequestBody = {
  repoId: string;
  baseBranch?: string;
  targetBranch?: string;
  templateIds: string[];
  options?: Record<string, any>;
};

export type ShellCommand = { id: string; title: string; command: string };

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchCsrf() {
  return fetchJson<{ token: string }>('/api/csrf', { method: 'GET' });
}

export async function fetchShellCommands() {
  return fetchJson<{ commands: ShellCommand[] }>('/api/shell/commands');
}

export async function runShellCommand(commandId: string, csrfToken: string) {
  return fetchJson<{ runId: string; command: string }>('/api/shell/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({ commandId }),
  });
}

export async function runCustomShellCommand(command: string, csrfToken: string, cwd?: string) {
  return fetchJson<{ runId: string; command: string }>('/api/shell/run-custom', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({ command, cwd }),
  });
}

export function openShellStream(runId: string, onEvent: (type: string, payload: any) => void) {
  const es = new EventSource(`/api/shell/runs/${runId}/stream`);
  es.onmessage = () => {};
  es.addEventListener('start', (ev) => onEvent('start', JSON.parse((ev as MessageEvent).data)));
  es.addEventListener('stdout', (ev) => onEvent('stdout', JSON.parse((ev as MessageEvent).data)));
  es.addEventListener('stderr', (ev) => onEvent('stderr', JSON.parse((ev as MessageEvent).data)));
  es.addEventListener('exit', (ev) => onEvent('exit', JSON.parse((ev as MessageEvent).data)));
  es.addEventListener('error', (ev) => {
    try {
      onEvent('error', JSON.parse((ev as MessageEvent).data));
    } catch (err) {
      onEvent('error', { data: (ev as MessageEvent).data });
    }
  });
  es.onerror = () => {
    onEvent('error', { data: 'stream connection closed' });
    es.close();
  };
  return es;
}

export async function fetchAutoRepos() {
  return fetchJson<RepoSummary[]>('/api/repos/auto');
}

export async function refreshAutoRepos() {
  return fetchJson<RepoSummary[]>('/api/repos/auto/refresh', { method: 'POST' });
}

export async function fetchManualRepos() {
  return fetchJson<RepoSummary[]>('/api/repos/manual');
}

export async function addManualRepo(path: string) {
  return fetchJson<RepoSummary>('/api/repos/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
}

export async function deleteRepo(id: string) {
  return fetchJson<{ ok: boolean }>(`/api/repos/${id}`, { method: 'DELETE' });
}

export type TemplatesResponse = { repo: TemplateRecord[]; global: TemplateRecord[] };

export async function fetchTemplates(repoId?: string) {
  const qs = repoId ? `?repoId=${encodeURIComponent(repoId)}` : '';
  return fetchJson<TemplatesResponse>(`/api/templates${qs}`);
}

export async function createTemplate(payload: Partial<TemplateRecord>) {
  return fetchJson<TemplateRecord>('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateTemplate(id: string, payload: Partial<TemplateRecord>) {
  return fetchJson<TemplateRecord>(`/api/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function removeTemplate(id: string) {
  return fetchJson<{ ok: boolean }>(`/api/templates/${id}`, { method: 'DELETE' });
}

export async function runReview(body: ReviewRequestBody) {
  return fetchJson<{ runId: string; taskIds: string[] }>('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchReview(runId: string) {
  return fetchJson<{ run: ReviewRun; tasks: ReviewTask[] }>(`/api/reviews/${runId}`);
}

export function openReviewStream(runId: string, onEvent: (type: string, payload: any) => void) {
  const es = new EventSource(`/api/reviews/${runId}/stream`);
  es.addEventListener('run_started', (ev) => onEvent('run_started', JSON.parse((ev as MessageEvent).data)));
  es.addEventListener('task_started', (ev) => onEvent('task_started', JSON.parse((ev as MessageEvent).data)));
  es.addEventListener('task_progress', (ev) => onEvent('task_progress', JSON.parse((ev as MessageEvent).data)));
  es.addEventListener('task_completed', (ev) => onEvent('task_completed', JSON.parse((ev as MessageEvent).data)));
  es.addEventListener('task_failed', (ev) => onEvent('task_failed', JSON.parse((ev as MessageEvent).data)));
  es.onerror = () => {
    onEvent('error', { message: 'stream disconnected' });
    es.close();
  };
  return es;
}
