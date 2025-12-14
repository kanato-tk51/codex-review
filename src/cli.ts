import { Command } from 'commander';
import { startServer } from './server';
import { ensureConfigDir, loadConfig } from './config';
import { addRepo } from './services/repo-service';

let openModule: typeof import('open') | undefined;

async function openInBrowser(url: string) {
  if (!openModule) {
    openModule = await import('open');
  }
  await openModule.default(url);
}

export async function startCli() {
  const program = new Command();
  program
    .option('-p, --port <port>', 'port to run server', '5273')
    .option('--no-open', 'do not open browser')
    .option('--repo <path>', 'register repo path on start');

  program.parse(process.argv);
  const opts = program.opts();
  const port = opts.port === '0' ? 0 : Number(opts.port) || 5273;

  ensureConfigDir();
  loadConfig();

  let app;
  try {
    app = await startServer(port);
  } catch (err: any) {
    console.error('Failed to start codex-review server:', err?.message || err);
    console.error('If running in a sandbox, retry with elevated permissions or a different port via --port.');
    process.exit(1);
  }
  if (opts.repo) {
    try {
      addRepo(opts.repo);
    } catch (err) {
      console.error('Failed to register repo', err);
    }
  }

  const url = `http://127.0.0.1:${port}`;
  console.log(`codex-review server running at ${url}`);
  if (opts.open !== false) {
    openInBrowser(url).catch(() => {});
  }

  const close = async () => {
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

export default startCli;

// Allow direct execution via `node dist/cli.js`
if (require.main === module) {
  startCli();
}
