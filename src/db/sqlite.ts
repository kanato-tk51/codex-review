import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

// In sandboxed/dev environments, HOME may not be writable. Prefer env override,
// otherwise place DB under current workspace to ensure write access.
const DATA_DIR =
  process.env.CODEX_REVIEW_DATA_DIR ||
  path.join(process.cwd(), '.codex-review');
const DB_FILE = path.join(DATA_DIR, 'codex-review.db');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function getDb() {
  ensureDir();
  const db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  return db;
}

export function migrate(db = getDb()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS repos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      system_prompt TEXT,
      user_prompt_template TEXT NOT NULL,
      default_model TEXT,
      repo_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS review_runs (
      id TEXT PRIMARY KEY,
      repo_id TEXT NOT NULL,
      base_branch TEXT,
      target_branch TEXT,
      status TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT,
      FOREIGN KEY(repo_id) REFERENCES repos(id)
    );
    CREATE TABLE IF NOT EXISTS review_tasks (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      status TEXT,
      result_summary TEXT,
      result_detail TEXT,
      error TEXT,
      started_at TEXT,
      finished_at TEXT,
      FOREIGN KEY(run_id) REFERENCES review_runs(id),
      FOREIGN KEY(template_id) REFERENCES templates(id)
    );
    CREATE TABLE IF NOT EXISTS llm_requests_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT,
      model TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      cost_usd REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // add repo_id column to templates if missing (for existing DBs)
  const cols = db.prepare('PRAGMA table_info(templates)').all() as { name: string }[];
  const hasRepoId = cols.some((c) => c.name === 'repo_id');
  if (!hasRepoId) {
    db.exec('ALTER TABLE templates ADD COLUMN repo_id TEXT;');
  }

  return db;
}

export const DB_PATHS = { DATA_DIR, DB_FILE };
