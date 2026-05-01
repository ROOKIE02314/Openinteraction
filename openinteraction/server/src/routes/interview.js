import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database.js';

const router = Router();

router.post('/create', (req, res) => {
  const { project_id } = req.body;

  if (!project_id) {
    return res.status(400).json({ error: 'project_id is required' });
  }

  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(project_id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const id = uuid();
  const shareToken = uuid().replace(/-/g, '').slice(0, 12);

  db.prepare(
    'INSERT INTO interviews (id, project_id, share_token) VALUES (?, ?, ?)'
  ).run(id, project_id, shareToken);

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  res.status(201).json({
    interview_id: id,
    share_token: shareToken,
    share_link: `${baseUrl}/interview/${shareToken}`,
  });
});

router.get('/:token', (req, res) => {
  const db = getDb();
  const interview = db.prepare(`
    SELECT i.*, p.name as project_name
    FROM interviews i
    JOIN projects p ON i.project_id = p.id
    WHERE i.share_token = ?
  `).get(req.params.token);

  if (!interview) {
    return res.status(404).json({ error: 'Interview not found' });
  }

  res.json({
    interview_id: interview.id,
    status: interview.status,
    project_name: interview.project_name,
    started_at: interview.started_at,
  });
});

export default router;
