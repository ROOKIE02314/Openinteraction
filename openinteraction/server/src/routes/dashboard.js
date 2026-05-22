import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database.js';
import { getProjectsOverview, getProjectMetrics, getDashboardOverview } from '../services/metricsService.js';
import { LLMProvider } from '../llm/provider.js';
import { ask } from '../services/researchAssistant.js';

const router = Router();

router.post('/projects', (req, res) => {
  const { name, product_context, core_topics } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!Array.isArray(core_topics) || core_topics.length === 0) {
    return res.status(400).json({ error: 'core_topics must be a non-empty array' });
  }

  const id = uuid();
  const db = getDb();
  db.prepare(
    'INSERT INTO projects (id, name, product_context, core_topics, style_guide) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name.trim(), product_context || '', JSON.stringify(core_topics), '{}');

  const created = db.prepare('SELECT id, name, created_at FROM projects WHERE id = ?').get(id);
  res.status(201).json(created);
});

router.get('/projects', (req, res) => {
  res.json(getProjectsOverview(getDb()));
});

router.get('/overview', (req, res) => {
  res.json(getDashboardOverview(getDb()));
});

router.get('/projects/:id/metrics', (req, res) => {
  const m = getProjectMetrics(getDb(), req.params.id);
  if (!m) return res.status(404).json({ error: 'project not found' });
  res.json(m);
});

function projectExists(db, id) {
  return db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id) !== undefined;
}

router.get('/projects/:id/chats', (req, res) => {
  const db = getDb();
  if (!projectExists(db, req.params.id)) {
    return res.status(404).json({ error: 'project not found' });
  }
  const rows = db.prepare(
    'SELECT id, role, content, created_at FROM dashboard_chats WHERE project_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);
  res.json(rows);
});

router.delete('/projects/:id/chats', (req, res) => {
  const db = getDb();
  if (!projectExists(db, req.params.id)) {
    return res.status(404).json({ error: 'project not found' });
  }
  db.prepare('DELETE FROM dashboard_chats WHERE project_id = ?').run(req.params.id);
  res.status(204).end();
});

router.post('/projects/:id/ask', async (req, res) => {
  const db = getDb();
  if (!projectExists(db, req.params.id)) {
    return res.status(404).json({ error: 'project not found' });
  }
  const { question } = req.body || {};
  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }
  if (question.length > 10000) {
    return res.status(400).json({ error: 'question too long' });
  }

  try {
    const llm = new LLMProvider();
    const result = await ask({ db, projectId: req.params.id, question: question.trim(), llm });
    res.json(result);
  } catch (err) {
    if (err.code === 'NO_INTERVIEWS') {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'project not found' });
    }
    console.error('Dashboard ask error:', err);
    res.status(502).json({ error: 'LLM 暂不可用，请稍后重试' });
  }
});

export default router;
