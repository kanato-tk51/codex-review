import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/sqlite';
import { TemplateRecord } from '../types';

const db = getDb();

export function listTemplates(): TemplateRecord[] {
  const stmt = db.prepare('SELECT * FROM templates ORDER BY created_at DESC');
  return stmt.all() as TemplateRecord[];
}

export function createTemplate(input: Omit<TemplateRecord, 'id' | 'created_at'>): TemplateRecord {
  const id = uuidv4();
  const stmt = db.prepare(`INSERT INTO templates (id, name, category, system_prompt, user_prompt_template, default_model)
    VALUES (@id, @name, @category, @system_prompt, @user_prompt_template, @default_model)`);
  stmt.run({ id, ...input });
  return getTemplate(id)!;
}

export function getTemplate(id: string): TemplateRecord | undefined {
  const stmt = db.prepare('SELECT * FROM templates WHERE id = ?');
  return stmt.get(id) as TemplateRecord | undefined;
}

export function updateTemplate(id: string, input: Partial<Omit<TemplateRecord, 'id' | 'created_at'>>): TemplateRecord | undefined {
  const current = getTemplate(id);
  if (!current) return undefined;
  const next = { ...current, ...input } as TemplateRecord;
  const stmt = db.prepare(`UPDATE templates SET name=@name, category=@category, system_prompt=@system_prompt,
    user_prompt_template=@user_prompt_template, default_model=@default_model WHERE id=@id`);
  stmt.run({ ...next });
  return getTemplate(id)!;
}

export function deleteTemplate(id: string): boolean {
  const stmt = db.prepare('DELETE FROM templates WHERE id = ?');
  const res = stmt.run(id);
  return res.changes > 0;
}
