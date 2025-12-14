import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createTemplate, deleteTemplate, getTemplate, listTemplates, updateTemplate } from '../templates/template-store';

/**
 * テンプレートCRUDに関するAPIルートを登録する。
 */
export async function templateRoutes(app: FastifyInstance) {
  app.get('/api/templates', async (req: FastifyRequest<{ Querystring: { repoId?: string } }>) => {
    const repoId = req.query.repoId;
    return listTemplates(repoId);
  });

  app.post('/api/templates', async (req: FastifyRequest<{ Body: Record<string, any> }>, reply: FastifyReply) => {
    const body = req.body || {};
    if (!body?.name || !body?.user_prompt_template) return reply.status(400).send({ error: 'name and user_prompt_template required' });
    const rec = createTemplate({
      name: body.name,
      category: body.category,
      system_prompt: body.system_prompt,
      user_prompt_template: body.user_prompt_template,
      default_model: body.default_model,
      repo_id: body.repo_id || null,
    });
    return rec;
  });

  app.put('/api/templates/:id', async (req: FastifyRequest<{ Params: { id: string }; Body: Partial<Record<string, any>> }>, reply: FastifyReply) => {
    const { id } = req.params;
    const rec = updateTemplate(id, (req.body || {}) as any);
    if (!rec) return reply.status(404).send({ error: 'not found' });
    return rec;
  });

  app.delete('/api/templates/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const ok = deleteTemplate(id);
    if (!ok) return reply.status(404).send({ error: 'not found' });
    return { ok: true };
  });

  app.get('/api/templates/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const rec = getTemplate(id);
    if (!rec) return reply.status(404).send({ error: 'not found' });
    return rec;
  });
}
