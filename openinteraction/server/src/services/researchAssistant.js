const KEYWORD_CATEGORIES = ['pain_point', 'feature_request', 'positive_feedback', 'insight'];

function formatProjectIntro(project) {
  const topics = project.core_topics ? JSON.parse(project.core_topics) : [];
  const topicLines = topics.map(t => `- ${t.id || ''}: ${t.description || ''}`).join('\n');
  return [
    `# 项目「${project.name}」`,
    project.product_context ? `\n产品背景：${project.product_context}` : '',
    topicLines ? `\n核心话题：\n${topicLines}` : '',
  ].filter(Boolean).join('\n');
}

function formatAnnotations(db, projectId) {
  const groups = {};
  for (const cat of KEYWORD_CATEGORIES) {
    const rows = db.prepare(`
      SELECT a.label, a.severity, a.quote, a.context
      FROM annotations a
      JOIN interviews i ON i.id = a.interview_id
      WHERE i.project_id = ? AND a.category = ?
      ORDER BY a.created_at ASC
    `).all(projectId, cat);
    if (rows.length > 0) groups[cat] = rows;
  }

  if (Object.keys(groups).length === 0) return '';

  const lines = ['# 标注汇总'];
  for (const [cat, rows] of Object.entries(groups)) {
    lines.push(`\n## ${cat}`);
    for (const r of rows) {
      const sev = r.severity ? ` [${r.severity}]` : '';
      const quote = r.quote ? ` — 「${r.quote}」` : '';
      lines.push(`- ${r.label}${sev}${quote}`);
    }
  }
  return lines.join('\n');
}

function formatTranscripts(db, projectId, interviews) {
  const blocks = [];
  for (let n = 0; n < interviews.length; n++) {
    const iv = interviews[n];
    const messages = db.prepare(`
      SELECT role, content
      FROM messages
      WHERE interview_id = ? AND role IN ('user', 'assistant')
      ORDER BY created_at ASC
    `).all(iv.id);

    if (messages.length === 0) continue;

    const lines = [`## 访谈 #${n + 1} (${iv.started_at})`];
    for (const m of messages) {
      const speaker = m.role === 'user' ? '用户' : '助手';
      lines.push(`${speaker}: ${m.content}`);
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.length > 0 ? '# 访谈记录\n\n' + blocks.join('\n\n') : '';
}

export function buildContext(db, projectId) {
  const project = db.prepare(
    'SELECT id, name, product_context, core_topics FROM projects WHERE id = ?'
  ).get(projectId);
  if (!project) return null;

  const interviews = db.prepare(`
    SELECT id, started_at FROM interviews
    WHERE project_id = ? AND status IN ('completed', 'in_progress', 'abandoned')
    ORDER BY started_at ASC
  `).all(projectId);

  const totalInterviews = interviews.length;
  const intro = formatProjectIntro(project);
  const annotationsBlock = formatAnnotations(db, projectId);
  const transcriptsBlock = formatTranscripts(db, projectId, interviews);

  const parts = [intro, annotationsBlock, transcriptsBlock].filter(Boolean);
  return {
    context: parts.join('\n\n---\n\n'),
    totalInterviews,
    droppedCount: 0,
    interviews,
  };
}
