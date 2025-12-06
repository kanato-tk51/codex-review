#!/usr/bin/env node
import('../dist/cli.js').then(m => m.startCli?.() ?? m.default?.()).catch(err => {
  console.error('Failed to start codex-review CLI', err);
  process.exit(1);
});
