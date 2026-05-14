import { v4 as uuid } from 'uuid';

const DEFAULT_BUDGET_TOKENS = 50000;
const HISTORY_LIMIT = 10;

const SYSTEM_PROMPT_BASE =
  '你是一个用研助手。下面是项目「{name}」的全部访谈数据。' +
  '基于这些数据回答用户问题，引用受访者原话时使用 `>` 引用块并标注来自第几次访谈（如 `访谈 #3`）。' +
  '不要编造原文里没有的内容；如果数据中没有相关信息，明确说「现有访谈数据中未提及」。';

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function getRecentHistory(db, projectId) {
  const rows = db.prepare(`
    SELECT role, content FROM dashboard_chats
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(projectId, HISTORY_LIMIT);
  return rows.reverse();
}

export async function ask({ db, projectId, question, llm, budgetTokens = DEFAULT_BUDGET_TOKENS }) {
  const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(projectId);
  if (!project) throw makeError('NOT_FOUND', 'project not found');

  const interviewCount = db.prepare(
    'SELECT COUNT(*) AS c FROM interviews WHERE project_id = ?'
  ).get(projectId).c;
  if (interviewCount === 0) throw makeError('NO_INTERVIEWS', '该项目还没有访谈数据');

  const ctx = buildContextWithBudget(db, projectId, budgetTokens);

  let system = SYSTEM_PROMPT_BASE.replace('{name}', project.name) + '\n\n' + ctx.context;
  if (ctx.droppedCount > 0) {
    system += `\n\n注意：因数据量过大，已省略最早的 ${ctx.droppedCount} 次访谈。`;
  }

  const history = getRecentHistory(db, projectId);
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: question },
  ];

  const result = await llm.chat({ system, messages });
  const answer = result.content;

  const writeTx = db.transaction(() => {
    db.prepare(
      'INSERT INTO dashboard_chats (id, project_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(uuid(), projectId, 'user', question);
    db.prepare(
      'INSERT INTO dashboard_chats (id, project_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(uuid(), projectId, 'assistant', answer);
  });
  writeTx();

  return {
    answer,
    truncated: ctx.droppedCount > 0,
    dropped_count: ctx.droppedCount,
  };
}

// LLM context categories — includes 'insight' for richer context (differs from metricsService)
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
  return formatTranscriptsFromIndex(db, interviews, 0);
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

export function estimateTokens(text) {
  return Math.ceil(text.length / 2);
}

function formatTranscriptsFromIndex(db, interviews, startIndex) {
  const blocks = [];
  for (let n = startIndex; n < interviews.length; n++) {
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

export function buildContextWithBudget(db, projectId, budgetTokens) {
  const base = buildContext(db, projectId);
  if (!base) return null;

  let droppedCount = 0;
  const interviews = base.interviews;
  const project = db.prepare(
    'SELECT id, name, product_context, core_topics FROM projects WHERE id = ?'
  ).get(projectId);
  const intro = formatProjectIntro(project);
  const annotationsBlock = formatAnnotations(db, projectId);

  while (droppedCount < interviews.length) {
    const transcriptsBlock = formatTranscriptsFromIndex(db, interviews, droppedCount);
    const parts = [intro, annotationsBlock, transcriptsBlock].filter(Boolean);
    const context = parts.join('\n\n---\n\n');

    if (estimateTokens(context) <= budgetTokens) {
      return { context, totalInterviews: interviews.length, droppedCount, interviews };
    }
    droppedCount++;
  }

  // All interviews dropped — return intro + annotations only
  const context = [intro, annotationsBlock].filter(Boolean).join('\n\n---\n\n');
  return { context, totalInterviews: interviews.length, droppedCount: interviews.length, interviews };
}
