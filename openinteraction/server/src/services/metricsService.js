export function getProjectsOverview(db) {
  return db.prepare(`
    SELECT
      p.id,
      p.name,
      p.created_at,
      COUNT(i.id) AS total,
      SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) AS completed,
      AVG(CASE
        WHEN i.status = 'completed' AND i.ended_at IS NOT NULL
        THEN (julianday(i.ended_at) - julianday(i.started_at)) * 24 * 60
        ELSE NULL
      END) AS avg_duration_min
    FROM projects p
    LEFT JOIN interviews i ON i.project_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();
}
