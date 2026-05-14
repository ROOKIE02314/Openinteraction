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

export default router;
