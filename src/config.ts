import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG_DIR =
  process.env.CODEX_REVIEW_CONFIG_DIR ||
  path.join(process.cwd(), '.codex-review', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface AppConfig {
  openaiApiKey?: string;
  defaultModel?: string;
  parallelism?: number;
  maxFiles?: number;
  maxTokens?: number;
  allowExternalSend?: boolean;
}

const defaults: Required<Pick<AppConfig, 'defaultModel' | 'parallelism' | 'maxFiles' | 'maxTokens'>> = {
  defaultModel: 'gpt-4.1-mini',
  parallelism: 3,
  maxFiles: 50,
  maxTokens: 5000,
};

export function loadConfig(): AppConfig {
  let fileConfig: AppConfig = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as AppConfig;
    } catch (err) {
      console.warn('Failed to parse config file', CONFIG_FILE, err);
    }
  }
  return {
    ...defaults,
    ...fileConfig,
    openaiApiKey: process.env.OPENAI_API_KEY || fileConfig.openaiApiKey,
    allowExternalSend: fileConfig.allowExternalSend ?? false,
  };
}

export function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export const CONFIG_PATHS = { CONFIG_DIR, CONFIG_FILE };
