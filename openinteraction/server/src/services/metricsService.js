export function getDashboardOverview(db) {
  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM projects) AS total_projects,
      (SELECT COUNT(*) FROM interviews) AS total_interviews,
      (SELECT COUNT(*) FROM interviews WHERE status = 'in_progress') AS in_progress_interviews
  `).get();

  const growth = db.prepare(`
    SELECT
      SUM(CASE WHEN strftime('%Y-%m', started_at) = strftime('%Y-%m', 'now') THEN 1 ELSE 0 END) AS this_month,
      SUM(CASE WHEN strftime('%Y-%m', started_at) = strftime('%Y-%m', 'now', '-1 month') THEN 1 ELSE 0 END) AS last_month
    FROM interviews
  `).get();

  const lastM = growth.last_month || 0;
  const thisM = growth.this_month || 0;
  const interview_growth_pct = lastM === 0 ? null : Math.round(((thisM - lastM) / lastM) * 100);

  return {
    total_projects: totals.total_projects,
    total_interviews: totals.total_interviews,
    in_progress_interviews: totals.in_progress_interviews,
    interview_growth_pct,
    monthly_interviews: [],
    trending_tags: [],
    total_keyword_count: 0,
    recent_interviews: [],
  };
}

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

// UI chip categories — excludes 'insight' (which has no user-facing label/count)
const KEYWORD_CATEGORIES = ['pain_point', 'feature_request', 'positive_feedback'];

export function getProjectMetrics(db, projectId) {
  const project = db.prepare(
    'SELECT id, name, created_at FROM projects WHERE id = ?'
  ).get(projectId);
  if (!project) return null;

  const overview = db.prepare(`
    SELECT
      COUNT(i.id) AS total,
      SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) AS completed,
      AVG(CASE
        WHEN i.status = 'completed' AND i.ended_at IS NOT NULL
        THEN (julianday(i.ended_at) - julianday(i.started_at)) * 24 * 60
        ELSE NULL
      END) AS avg_duration_min,
      (
        SELECT CAST(COUNT(m.id) AS REAL) / NULLIF(COUNT(DISTINCT m.interview_id), 0)
        FROM messages m
        JOIN interviews i2 ON i2.id = m.interview_id
        WHERE i2.project_id = ?
      ) AS avg_messages_per_interview
    FROM interviews i
    WHERE i.project_id = ?
  `).get(projectId, projectId);

  const total = overview.total || 0;
  const completed = overview.completed || 0;
  const completion_rate = total === 0 ? null : completed / total;

  const keywords = {};
  const keywordStmt = db.prepare(`
    SELECT a.label AS label, COUNT(*) AS count
    FROM annotations a
    JOIN interviews i ON i.id = a.interview_id
    WHERE i.project_id = ? AND a.category = ?
    GROUP BY a.label
    ORDER BY count DESC, a.label ASC
    LIMIT 10
  `);
  for (const cat of KEYWORD_CATEGORIES) {
    keywords[cat] = keywordStmt.all(projectId, cat);
  }

  const interviews = db.prepare(`
    SELECT
      i.id,
      i.started_at,
      i.status,
      CASE
        WHEN i.ended_at IS NOT NULL
        THEN (julianday(i.ended_at) - julianday(i.started_at)) * 24 * 60
        ELSE NULL
      END AS duration_min,
      (SELECT COUNT(*) FROM annotations a
        WHERE a.interview_id = i.id AND a.category = 'insight') AS insight_count
    FROM interviews i
    WHERE i.project_id = ?
    ORDER BY i.started_at DESC
  `).all(projectId);

  return {
    project,
    overview: {
      total,
      completed,
      completion_rate,
      avg_duration_min: overview.avg_duration_min,
      avg_messages_per_interview: overview.avg_messages_per_interview,
    },
    keywords,
    interviews,
  };
}
