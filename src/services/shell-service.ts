import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import EventEmitter from 'events';

export type ShellRunEvent = {
  runId: string;
  type: 'start' | 'stdout' | 'stderr' | 'exit' | 'error';
  data?: string;
  code?: number | null;
};

export type AllowedCommand = {
  id: string;
  title: string;
  command: string[];
  cwd?: string;
};

const allowedCommands: AllowedCommand[] = [
  { id: 'git-status', title: 'git status', command: ['git', 'status'] },
  { id: 'pnpm-build', title: 'pnpm run build', command: ['pnpm', 'run', 'build'] },
  { id: 'pnpm-build-all', title: 'pnpm run build:all', command: ['pnpm', 'run', 'build:all'] },
  { id: 'codex-review-help', title: 'codex-review --help', command: ['codex-review', '--help'] },
];

const emitter = new EventEmitter();
const runStates = new Map<string, { status: 'running' | 'finished' | 'error'; exitCode?: number | null }>();

function wireStream(runId: string, proc: ChildProcess) {
  proc.stdout?.on('data', (chunk: Buffer) => {
    emitter.emit('event', { runId, type: 'stdout', data: chunk.toString() } as ShellRunEvent);
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    emitter.emit('event', { runId, type: 'stderr', data: chunk.toString() } as ShellRunEvent);
  });
  proc.on('error', (err) => {
    runStates.set(runId, { status: 'error' });
    emitter.emit('event', { runId, type: 'error', data: err.message } as ShellRunEvent);
  });
  proc.on('close', (code) => {
    runStates.set(runId, { status: code === 0 ? 'finished' : 'error', exitCode: code });
    emitter.emit('event', { runId, type: 'exit', code } as ShellRunEvent);
  });
}

export function listAllowedCommands() {
  return allowedCommands.map((item) => ({
    id: item.id,
    title: item.title,
    command: item.command.join(' '),
  }));
}

export function startShellRun(commandId: string) {
  const spec = allowedCommands.find((c) => c.id === commandId);
  if (!spec) throw new Error('Command not allowed');
  return spawnShell(spec.command, spec.cwd);
}

export function startCustomShellRun(command: string, cwd?: string) {
  const parts = command.trim();
  if (!parts) throw new Error('command required');
  return spawnShell(parts, cwd, true);
}

function spawnShell(command: string | string[], cwd?: string, useShell = false) {
  const runId = randomUUID();
  const cmd = Array.isArray(command) ? command[0] : command;
  const args = Array.isArray(command) ? command.slice(1) : [];
  const proc = spawn(cmd, args, {
    cwd: cwd || process.cwd(),
    env: { ...process.env, TERM: 'dumb' },
    shell: useShell,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  runStates.set(runId, { status: 'running' });
  const started = Array.isArray(command) ? command.join(' ') : command;
  emitter.emit('event', { runId, type: 'start', data: started } as ShellRunEvent);
  wireStream(runId, proc);
  return { runId, command: started };
}

export function onShellEvent(runId: string, listener: (event: ShellRunEvent) => void) {
  const handler = (event: ShellRunEvent) => {
    if (event.runId !== runId) return;
    listener(event);
  };
  emitter.on('event', handler);
  return () => emitter.off('event', handler);
}

export function getShellRunState(runId: string) {
  return runStates.get(runId);
}
