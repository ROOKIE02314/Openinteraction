import { Router } from 'express';
import { getDb } from '../db/database.js';
import { getProjectsOverview, getProjectMetrics } from '../services/metricsService.js';

const router = Router();

router.get('/projects', (req, res) => {
  res.json(getProjectsOverview(getDb()));
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

export default router;
