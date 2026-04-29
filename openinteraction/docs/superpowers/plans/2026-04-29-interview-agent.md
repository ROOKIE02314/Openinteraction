# Interview Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an agent-driven interactive user interview system where users chat naturally with an AI agent instead of filling out survey forms.

**Architecture:** Single Agent + Tool Calling pattern. React frontend sends messages to Node.js Express backend, which orchestrates an InterviewAgent that uses tool calling (record_insight, mark_topic_covered, extract_annotation, end_interview) to manage interview state and extract structured data in real-time. Data stored in SQLite.

**Tech Stack:** React (Vite), Node.js + Express, better-sqlite3, DeepSeek/Qwen API (OpenAI-compatible), Vitest, Jest

---

## File Structure

```
openinteraction/
├── server/
│   ├── package.json
│   ├── vitest.config.js
│   ├── src/
│   │   ├── index.js                    # Express app entry
│   │   ├── db/
│   │   │   ├── schema.sql              # SQLite DDL
│   │   │   └── database.js             # DB init + helpers
│   │   ├── llm/
│   │   │   └── provider.js             # LLM abstraction (OpenAI-compatible)
│   │   ├── agent/
│   │   │   ├── tools.js                # Tool definitions + executor
│   │   │   ├── promptBuilder.js        # System prompt assembly
│   │   │   └── interviewAgent.js       # Core agent loop
│   │   ├── services/
│   │   │   └── conversationManager.js  # Message history + context window
│   │   └── routes/
│   │       ├── interview.js            # Interview CRUD + share links
│   │       └── chat.js                 # Chat message endpoint
│   └── tests/
│       ├── db/
│       │   └── database.test.js
│       ├── llm/
│       │   └── provider.test.js
│       ├── agent/
│       │   ├── tools.test.js
│       │   ├── promptBuilder.test.js
│       │   └── interviewAgent.test.js
│       ├── services/
│       │   └── conversationManager.test.js
│       └── routes/
│           ├── interview.test.js
│           └── chat.test.js
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── api/
│   │   │   └── client.js               # API calls
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   └── CompletePage.jsx
│   │   └── components/
│   │       ├── MessageList.jsx
│   │       ├── MessageInput.jsx
│   │       └── TypingIndicator.jsx
│   └── tests/
│       └── components/
│           └── MessageList.test.js
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-04-29-interview-agent-design.md
        └── plans/
            └── 2026-04-29-interview-agent.md
```

---

## Task 1: Server Project Setup

**Files:**
- Create: `server/package.json`
- Create: `server/vitest.config.js`
- Create: `server/src/index.js`

- [ ] **Step 1: Initialize server project**

```bash
cd D:/school-business/openinteraction
mkdir -p server && cd server
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
cd D:/school-business/openinteraction/server
npm install express cors better-sqlite3 dotenv uuid openai
npm install -D vitest supertest
```

- [ ] **Step 3: Create package.json scripts**

Edit `server/package.json` to add scripts:

```json
{
  "name": "interview-agent-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Create vitest config**

Write `server/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create Express entry point**

Write `server/src/index.js`:

```js
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
```

- [ ] **Step 6: Verify server starts**

```bash
cd D:/school-business/openinteraction/server
node src/index.js &
sleep 1
curl http://localhost:3001/api/health
kill %1
```

Expected: `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
cd D:/school-business/openinteraction
git add server/
git commit -m "feat: initialize server project with Express and Vitest"
```

---

## Task 2: Database Layer

**Files:**
- Create: `server/src/db/schema.sql`
- Create: `server/src/db/database.js`
- Create: `server/tests/db/database.test.js`

- [ ] **Step 1: Write database tests**

Write `server/tests/db/database.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb, getDb } from '../../src/db/database.js';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = './test.db';

describe('database', () => {
  beforeEach(() => {
    initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    getDb().close();
    fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates projects table', () => {
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const names = tables.map(t => t.name);
    expect(names).toContain('projects');
  });

  it('creates interviews table', () => {
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const names = tables.map(t => t.name);
    expect(names).toContain('interviews');
  });

  it('creates messages table', () => {
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const names = tables.map(t => t.name);
    expect(names).toContain('messages');
  });

  it('creates annotations table', () => {
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const names = tables.map(t => t.name);
    expect(names).toContain('annotations');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd D:/school-business/openinteraction/server
npx vitest run tests/db/database.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Write schema SQL**

Write `server/src/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  product_context TEXT,
  core_topics TEXT, -- JSON array
  style_guide TEXT, -- JSON object
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  share_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed', 'abandoned')),
  started_at TEXT DEFAULT (datetime('now')),
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  interview_id TEXT NOT NULL REFERENCES interviews(id),
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls TEXT, -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  interview_id TEXT NOT NULL REFERENCES interviews(id),
  message_id TEXT REFERENCES messages(id),
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  severity TEXT CHECK(severity IN ('low', 'medium', 'high')),
  quote TEXT,
  context TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

- [ ] **Step 4: Write database module**

Write `server/src/db/database.js`:

```js
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let db;

export function initDb(dbPath = './data/interview.db') {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd D:/school-business/openinteraction/server
npx vitest run tests/db/database.test.js
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/db/ server/tests/db/
git commit -m "feat: add SQLite database layer with schema and init"
```

---

## Task 3: LLM Provider

**Files:**
- Create: `server/src/llm/provider.js`
- Create: `server/tests/llm/provider.test.js`

- [ ] **Step 1: Write LLM provider tests**

Write `server/tests/llm/provider.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMProvider } from '../../src/llm/provider.js';

describe('LLMProvider', () => {
  let provider;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };
    provider = new LLMProvider({ client: mockClient });
  });

  it('sends messages to LLM with system prompt', async () => {
    mockClient.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Hello!', tool_calls: null } }],
    });

    const result = await provider.chat({
      system: 'You are a friend.',
      messages: [{ role: 'user', content: 'Hi' }],
      tools: [],
    });

    expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'You are a friend.' },
          { role: 'user', content: 'Hi' },
        ],
      })
    );
    expect(result.content).toBe('Hello!');
    expect(result.toolCalls).toEqual([]);
  });

  it('returns tool calls when LLM uses tools', async () => {
    const toolCalls = [
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'record_insight', arguments: '{"topic":"search","insight":"slow"}' },
      },
    ];
    mockClient.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'I see.', tool_calls: toolCalls } }],
    });

    const result = await provider.chat({
      system: 'You are a friend.',
      messages: [{ role: 'user', content: '搜索很慢' }],
      tools: [{ type: 'function', function: { name: 'record_insight' } }],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('record_insight');
    expect(result.toolCalls[0].arguments.topic).toBe('search');
  });

  it('handles LLM API errors gracefully', async () => {
    mockClient.chat.completions.create.mockRejectedValue(new Error('API timeout'));

    await expect(
      provider.chat({
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [],
      })
    ).rejects.toThrow('API timeout');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd D:/school-business/openinteraction/server
npx vitest run tests/llm/provider.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Write LLM provider**

Write `server/src/llm/provider.js`:

```js
import OpenAI from 'openai';

export class LLMProvider {
  constructor({ client, model } = {}) {
    this.client = client || new OpenAI({
      apiKey: process.env.LLM_API_KEY || 'test',
      baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
    });
    this.model = model || process.env.LLM_MODEL || 'deepseek-chat';
  }

  async chat({ system, messages, tools = [] }) {
    const fullMessages = [
      { role: 'system', content: system },
      ...messages,
    ];

    const params = {
      model: this.model,
      messages: fullMessages,
    };

    if (tools.length > 0) {
      params.tools = tools;
    }

    const response = await this.client.chat.completions.create(params);
    const choice = response.choices[0];
    const message = choice.message;

    return {
      content: message.content || '',
      toolCalls: (message.tool_calls || []).map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd D:/school-business/openinteraction/server
npx vitest run tests/llm/provider.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/llm/ server/tests/llm/
git commit -m "feat: add LLM provider with OpenAI-compatible tool calling"
```

---

## Task 4: Agent Tools

**Files:**
- Create: `server/src/agent/tools.js`
- Create: `server/tests/agent/tools.test.js`

- [ ] **Step 1: Write tool tests**

Write `server/tests/agent/tools.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { toolDefinitions, executeTool } from '../../src/agent/tools.js';
import { initDb, getDb } from '../../src/db/database.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const TEST_DB = './test-tools.db';

describe('agent tools', () => {
  let interviewId;

  beforeEach(() => {
    initDb(TEST_DB);
    const db = getDb();

    const projectId = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(
      projectId, 'Test Product', 'A test product', '[]'
    );

    interviewId = uuid();
    db.prepare('INSERT INTO interviews (id, project_id, share_token) VALUES (?, ?, ?)').run(
      interviewId, projectId, 'test-token'
    );

    const msgId = uuid();
    db.prepare('INSERT INTO messages (id, interview_id, role, content) VALUES (?, ?, ?, ?)').run(
      msgId, interviewId, 'user', '搜索功能不太好用'
    );
  });

  afterEach(() => {
    getDb().close();
    fs.unlinkSync(TEST_DB);
  });

  it('exports 4 tool definitions', () => {
    expect(toolDefinitions).toHaveLength(4);
    const names = toolDefinitions.map(t => t.function.name);
    expect(names).toContain('record_insight');
    expect(names).toContain('mark_topic_covered');
    expect(names).toContain('extract_annotation');
    expect(names).toContain('end_interview');
  });

  it('record_insight saves insight to annotations table', () => {
    const result = executeTool('record_insight', {
      topic: 'search',
      insight: '搜索结果不准确',
      emotion: 'frustrated',
      quote: '搜出来的都不是我想要的',
    }, interviewId);

    expect(result.success).toBe(true);

    const db = getDb();
    const annotations = db.prepare('SELECT * FROM annotations WHERE interview_id = ? AND category = ?').all(interviewId, 'insight');
    expect(annotations).toHaveLength(1);
    expect(annotations[0].label).toBe('search');
    expect(annotations[0].context).toBe('搜索结果不准确');
  });

  it('extract_annotation saves to annotations table', () => {
    const result = executeTool('extract_annotation', {
      category: 'pain_point',
      label: '搜索不精准',
      severity: 'high',
      quote: '搜出来的都不是我想要的',
      context: '用户多次提到搜索结果不准确',
    }, interviewId);

    expect(result.success).toBe(true);

    const db = getDb();
    const annotations = db.prepare('SELECT * FROM annotations WHERE interview_id = ?').all(interviewId);
    expect(annotations).toHaveLength(1);
    expect(annotations[0].category).toBe('pain_point');
    expect(annotations[0].label).toBe('搜索不精准');
    expect(annotations[0].severity).toBe('high');
  });

  it('mark_topic_covered returns success', () => {
    const result = executeTool('mark_topic_covered', {
      topic_id: 'search_experience',
      coverage: 'full',
      notes: '用户充分讨论了搜索体验',
    }, interviewId);

    expect(result.success).toBe(true);
  });

  it('end_interview updates interview status', () => {
    const result = executeTool('end_interview', {
      reason: '核心话题已覆盖',
      summary: '用户反馈了搜索和加载问题',
    }, interviewId);

    expect(result.success).toBe(true);

    const db = getDb();
    const interview = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interviewId);
    expect(interview.status).toBe('completed');
    expect(interview.ended_at).not.toBeNull();
  });

  it('throws on unknown tool name', () => {
    expect(() => executeTool('unknown_tool', {}, interviewId)).toThrow('Unknown tool');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd D:/school-business/openinteraction/server
npx vitest run tests/agent/tools.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Write tool definitions and executor**

Write `server/src/agent/tools.js`:

```js
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database.js';

export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'record_insight',
      description: 'Record a key insight from the user. Use when the user shares an important observation, feeling, or experience about the product.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic this insight relates to' },
          insight: { type: 'string', description: 'Summary of the insight' },
          emotion: { type: 'string', description: 'User\'s emotional state (e.g., frustrated, happy, neutral)' },
          quote: { type: 'string', description: 'User\'s original words (in Chinese)' },
        },
        required: ['topic', 'insight'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_topic_covered',
      description: 'Mark a core interview topic as discussed. Use when a topic has been sufficiently explored.',
      parameters: {
        type: 'object',
        properties: {
          topic_id: { type: 'string', description: 'ID of the core topic from the project config' },
          coverage: { type: 'string', enum: ['partial', 'full'], description: 'How thoroughly the topic was covered' },
          notes: { type: 'string', description: 'Brief notes about what was discussed' },
        },
        required: ['topic_id', 'coverage'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extract_annotation',
      description: 'Extract a structured annotation from the conversation. Use when the user shares something that can be categorized (pain point, feature request, positive feedback, usage pattern).',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['pain_point', 'feature_request', 'positive_feedback', 'usage_pattern'], description: 'Category of the annotation' },
          label: { type: 'string', description: 'Short label for the annotation' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'], description: 'How significant this is' },
          quote: { type: 'string', description: 'User\'s original words' },
          context: { type: 'string', description: 'Additional context about why this was annotated' },
        },
        required: ['category', 'label'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'end_interview',
      description: 'Signal that the interview can end. Use when all core topics are covered and the user has nothing more to add.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why the interview is ending' },
          summary: { type: 'string', description: 'Brief summary of what was discussed' },
        },
        required: ['reason', 'summary'],
      },
    },
  },
];

export function executeTool(name, args, interviewId) {
  const db = getDb();

  switch (name) {
    case 'record_insight': {
      // Insights are stored as annotations with category derived from topic
      const id = uuid();
      db.prepare(
        'INSERT INTO annotations (id, interview_id, category, label, severity, quote, context) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, interviewId, 'insight', args.topic, null, args.quote || null, args.insight);
      return { success: true, id };
    }

    case 'mark_topic_covered': {
      // Store as an annotation for tracking
      const id = uuid();
      db.prepare(
        'INSERT INTO annotations (id, interview_id, category, label, severity, context) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, interviewId, 'topic_coverage', `${args.topic_id}:${args.coverage}`, null, args.notes || null);
      return { success: true };
    }

    case 'extract_annotation': {
      const id = uuid();
      db.prepare(
        'INSERT INTO annotations (id, interview_id, category, label, severity, quote, context) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, interviewId, args.category, args.label, args.severity || null, args.quote || null, args.context || null);
      return { success: true, id };
    }

    case 'end_interview': {
      db.prepare(
        "UPDATE interviews SET status = 'completed', ended_at = datetime('now') WHERE id = ?"
      ).run(interviewId);
      // Store the summary as a final annotation
      const id = uuid();
      db.prepare(
        'INSERT INTO annotations (id, interview_id, category, label, context) VALUES (?, ?, ?, ?, ?)'
      ).run(id, interviewId, 'summary', 'interview_summary', args.summary);
      return { success: true, summary: args.summary };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd D:/school-business/openinteraction/server
npx vitest run tests/agent/tools.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/agent/tools.js server/tests/agent/tools.test.js
git commit -m "feat: add agent tool definitions and executor"
```

---

## Task 5: Prompt Builder

**Files:**
- Create: `server/src/agent/promptBuilder.js`
- Create: `server/tests/agent/promptBuilder.test.js`

- [ ] **Step 1: Write prompt builder tests**

Write `server/tests/agent/promptBuilder.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../../src/agent/promptBuilder.js';

describe('buildSystemPrompt', () => {
  const project = {
    name: 'TestApp',
    product_context: '一个在线购物平台，主要面向年轻用户',
    core_topics: JSON.stringify([
      { id: 'search', description: '搜索功能的体验' },
      { id: 'checkout', description: '下单支付流程' },
    ]),
    style_guide: JSON.stringify({ tone: 'casual' }),
  };

  it('includes role and style section', () => {
    const prompt = buildSystemPrompt(project);
    expect(prompt).toContain('朋友');
    expect(prompt).toContain('TestApp');
  });

  it('includes product context', () => {
    const prompt = buildSystemPrompt(project);
    expect(prompt).toContain('在线购物平台');
    expect(prompt).toContain('年轻用户');
  });

  it('includes core topics', () => {
    const prompt = buildSystemPrompt(project);
    expect(prompt).toContain('搜索功能');
    expect(prompt).toContain('下单支付');
  });

  it('includes tool usage instructions', () => {
    const prompt = buildSystemPrompt(project);
    expect(prompt).toContain('record_insight');
    expect(prompt).toContain('extract_annotation');
    expect(prompt).toContain('end_interview');
  });

  it('includes conversation strategy', () => {
    const prompt = buildSystemPrompt(project);
    expect(prompt).toContain('共情');
    expect(prompt).toContain('追问');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd D:/school-business/openinteraction/server
npx vitest run tests/agent/promptBuilder.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Write prompt builder**

Write `server/src/agent/promptBuilder.js`:

```js
export function buildSystemPrompt(project) {
  const topics = JSON.parse(project.core_topics || '[]');
  const style = JSON.parse(project.style_guide || '{}');

  const topicsList = topics
    .map((t, i) => `${i + 1}. ${t.id} — ${t.description}`)
    .join('\n');

  return `# 角色

你是一个正在和用户聊天的朋友。你的目的是了解用户对「${project.name}」的使用体验。

## 风格要求
- 语气亲切自然，像朋友间的对话
- 不要说"我是AI"、"这是一个访谈"或任何暴露你AI身份的话
- 用口语化表达，避免书面语
- 适当使用语气词（嗯、哈哈、确实、天哪）
- 回复简短，像微信聊天一样，不要长篇大论
- 可以用表情符号但不要过度

# 产品信息

${project.product_context}

# 核心话题

你需要了解以下话题（不必按顺序，自然引入）：

${topicsList}

每个话题至少深入聊一次。但不要像审问一样连续提问，要让对话自然流动。

# 对话策略

- 用户说完一个点后，先共情或回应，再自然追问
- 用"为什么"、"能举个例子吗"、"后来呢"、"那你怎么处理的"引导深入
- 如果用户提到你没想到的点，顺着聊下去，不要打断
- 当一个话题聊得差不多了，用自然的过渡引入下一个话题
- 如果用户明显不想聊了（简短回复、说"就这些吧"），尊重并自然结束
- 不要一次问多个问题，每次只追问一个方向

# 工具使用

你有以下工具可以调用：

- **record_insight** — 当用户分享了重要的观点、感受或体验时调用，记录下来
- **mark_topic_covered** — 当某个核心话题已经充分讨论后调用，标记为已覆盖
- **extract_annotation** — 当用户的反馈可以被归类时调用（痛点、功能请求、正面反馈、使用习惯）
- **end_interview** — 当所有核心话题都已覆盖，且用户没有更多要补充的时候调用

注意：工具调用不会展示给用户，你可以在回复用户的同时悄悄调用工具。
`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd D:/school-business/openinteraction/server
npx vitest run tests/agent/promptBuilder.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/agent/promptBuilder.js server/tests/agent/promptBuilder.test.js
git commit -m "feat: add prompt builder for interview agent"
```

---

## Task 6: Conversation Manager

**Files:**
- Create: `server/src/services/conversationManager.js`
- Create: `server/tests/services/conversationManager.test.js`

- [ ] **Step 1: Write conversation manager tests**

Write `server/tests/services/conversationManager.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConversationManager } from '../../src/services/conversationManager.js';
import { initDb, getDb } from '../../src/db/database.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const TEST_DB = './test-conv.db';

describe('ConversationManager', () => {
  let manager;
  let interviewId;

  beforeEach(() => {
    initDb(TEST_DB);
    const db = getDb();

    const projectId = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(
      projectId, 'Test', 'Test product', '[]'
    );

    interviewId = uuid();
    db.prepare('INSERT INTO interviews (id, project_id, share_token) VALUES (?, ?, ?)').run(
      interviewId, projectId, 'test-token'
    );

    manager = new ConversationManager(interviewId);
  });

  afterEach(() => {
    getDb().close();
    fs.unlinkSync(TEST_DB);
  });

  it('adds user message and persists to DB', () => {
    manager.addMessage('user', '你好');

    const messages = manager.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('你好');

    const db = getDb();
    const rows = db.prepare('SELECT * FROM messages WHERE interview_id = ?').all(interviewId);
    expect(rows).toHaveLength(1);
  });

  it('adds assistant message with tool calls', () => {
    manager.addMessage('assistant', '你好呀！', [{ name: 'record_insight', arguments: {} }]);

    const messages = manager.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('assistant');
    expect(messages[0].tool_calls).toEqual([{ name: 'record_insight', arguments: {} }]);
  });

  it('returns messages in chronological order', () => {
    manager.addMessage('user', '第一条');
    manager.addMessage('assistant', '回复一');
    manager.addMessage('user', '第二条');

    const messages = manager.getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe('第一条');
    expect(messages[2].content).toBe('第二条');
  });

  it('formats messages for LLM API', () => {
    manager.addMessage('user', '你好');
    manager.addMessage('assistant', '嗨！');

    const formatted = manager.getMessagesForLLM();
    expect(formatted).toEqual([
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '嗨！' },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd D:/school-business/openinteraction/server
npx vitest run tests/services/conversationManager.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Write conversation manager**

Write `server/src/services/conversationManager.js`:

```js
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database.js';

export class ConversationManager {
  constructor(interviewId) {
    this.interviewId = interviewId;
  }

  addMessage(role, content, toolCalls = null) {
    const db = getDb();
    const id = uuid();
    db.prepare(
      'INSERT INTO messages (id, interview_id, role, content, tool_calls) VALUES (?, ?, ?, ?, ?)'
    ).run(id, this.interviewId, role, content, toolCalls ? JSON.stringify(toolCalls) : null);
    return id;
  }

  getMessages() {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM messages WHERE interview_id = ? ORDER BY created_at ASC'
    ).all(this.interviewId);

    return rows.map(row => ({
      ...row,
      tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : null,
    }));
  }

  getMessagesForLLM() {
    return this.getMessages().map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  getMessageCount() {
    const db = getDb();
    const row = db.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE interview_id = ? AND role = ?'
    ).get(this.interviewId, 'user');
    return row.count;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd D:/school-business/openinteraction/server
npx vitest run tests/services/conversationManager.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/services/ server/tests/services/
git commit -m "feat: add conversation manager for message persistence"
```

---

## Task 7: Interview Agent

**Files:**
- Create: `server/src/agent/interviewAgent.js`
- Create: `server/tests/agent/interviewAgent.test.js`

- [ ] **Step 1: Write interview agent tests**

Write `server/tests/agent/interviewAgent.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InterviewAgent } from '../../src/agent/interviewAgent.js';
import { initDb, getDb } from '../../src/db/database.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const TEST_DB = './test-agent.db';

describe('InterviewAgent', () => {
  let agent;
  let interviewId;
  let mockLLM;

  beforeEach(() => {
    initDb(TEST_DB);
    const db = getDb();

    const projectId = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(
      projectId, 'TestApp', '一个测试产品', JSON.stringify([
        { id: 'search', description: '搜索体验' },
      ])
    );

    interviewId = uuid();
    db.prepare('INSERT INTO interviews (id, project_id, share_token) VALUES (?, ?, ?)').run(
      interviewId, projectId, 'test-token'
    );

    mockLLM = {
      chat: vi.fn(),
    };

    agent = new InterviewAgent(interviewId, projectId, mockLLM);
  });

  afterEach(() => {
    getDb().close();
    fs.unlinkSync(TEST_DB);
  });

  it('processes user message and returns agent response', async () => {
    mockLLM.chat.mockResolvedValue({
      content: '你好呀！最近用我们产品感觉怎么样？',
      toolCalls: [],
    });

    const result = await agent.processMessage('你好');

    expect(result.response).toBe('你好呀！最近用我们产品感觉怎么样？');
    expect(result.toolCalls).toEqual([]);
    expect(result.interviewStatus).toBe('in_progress');
  });

  it('executes tool calls and sends results back to LLM', async () => {
    // First call: agent wants to call a tool
    mockLLM.chat.mockResolvedValueOnce({
      content: '搜索确实挺重要的',
      toolCalls: [
        {
          id: 'call_1',
          name: 'extract_annotation',
          arguments: { category: 'pain_point', label: '搜索不好用', severity: 'high' },
        },
      ],
    });

    // Second call: after tool result, agent responds to user
    mockLLM.chat.mockResolvedValueOnce({
      content: '能具体说说搜索哪里不好用吗？',
      toolCalls: [],
    });

    const result = await agent.processMessage('搜索功能不太好用');

    expect(result.response).toBe('能具体说说搜索哪里不好用吗？');
    expect(mockLLM.chat).toHaveBeenCalledTimes(2);
  });

  it('handles end_interview tool call', async () => {
    mockLLM.chat.mockResolvedValue({
      content: '感谢你的反馈！',
      toolCalls: [
        {
          id: 'call_1',
          name: 'end_interview',
          arguments: { reason: '话题已覆盖', summary: '讨论了搜索体验' },
        },
      ],
    });

    // Need a second LLM call for the farewell message
    mockLLM.chat.mockResolvedValueOnce({
      content: '感谢你的反馈！',
      toolCalls: [
        {
          id: 'call_1',
          name: 'end_interview',
          arguments: { reason: '话题已覆盖', summary: '讨论了搜索体验' },
        },
      ],
    });

    const result = await agent.processMessage('就这些吧');

    expect(result.interviewStatus).toBe('completed');
  });

  it('returns error message when LLM fails', async () => {
    mockLLM.chat.mockRejectedValue(new Error('API error'));

    const result = await agent.processMessage('你好');

    expect(result.response).toContain('抱歉');
    expect(result.error).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd D:/school-business/openinteraction/server
npx vitest run tests/agent/interviewAgent.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Write interview agent**

Write `server/src/agent/interviewAgent.js`:

```js
import { getDb } from '../db/database.js';
import { ConversationManager } from '../services/conversationManager.js';
import { buildSystemPrompt } from './promptBuilder.js';
import { toolDefinitions, executeTool } from './tools.js';

export class InterviewAgent {
  constructor(interviewId, projectId, llmProvider) {
    this.interviewId = interviewId;
    this.projectId = projectId;
    this.llm = llmProvider;
    this.conversation = new ConversationManager(interviewId);
  }

  async processMessage(userMessage) {
    // Save user message
    this.conversation.addMessage('user', userMessage);

    // Load project config for system prompt
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(this.projectId);
    const systemPrompt = buildSystemPrompt(project);

    // Get conversation history
    const messages = this.conversation.getMessagesForLLM();

    try {
      // Call LLM
      const result = await this.llm.chat({
        system: systemPrompt,
        messages,
        tools: toolDefinitions,
      });

      // Process tool calls if any
      let finalResponse = result.content;
      let allToolCalls = [...result.toolCalls];
      let interviewStatus = 'in_progress';

      // Handle tool calls in a loop (agent might call multiple tools)
      let currentResult = result;
      let maxIterations = 5; // Safety limit

      while (currentResult.toolCalls.length > 0 && maxIterations > 0) {
        maxIterations--;

        for (const toolCall of currentResult.toolCalls) {
          const toolResult = executeTool(toolCall.name, toolCall.arguments, this.interviewId);

          if (toolCall.name === 'end_interview') {
            interviewStatus = 'completed';
          }
        }

        // If there were tool calls, get the next response from LLM
        // (the agent may want to say something after using tools)
        const updatedMessages = this.conversation.getMessagesForLLM();

        // Add tool call context to messages for the next LLM call
        const toolCallMessages = currentResult.toolCalls.map(tc => ({
          role: 'assistant',
          content: null,
          tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } }],
        }));

        const toolResultMessages = currentResult.toolCalls.map(tc => ({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ success: true }),
        }));

        const nextMessages = [...messages, ...toolCallMessages, ...toolResultMessages];

        currentResult = await this.llm.chat({
          system: systemPrompt,
          messages: nextMessages,
          tools: toolDefinitions,
        });

        finalResponse = currentResult.content || finalResponse;
        allToolCalls = [...allToolCalls, ...currentResult.toolCalls];
      }

      // Save assistant message
      this.conversation.addMessage('assistant', finalResponse, allToolCalls.length > 0 ? allToolCalls : null);

      return {
        response: finalResponse,
        toolCalls: allToolCalls,
        interviewStatus,
      };
    } catch (error) {
      console.error('InterviewAgent error:', error);

      const errorMsg = '抱歉，我这边出了点小问题，你能再说一遍吗？';
      this.conversation.addMessage('assistant', errorMsg);

      return {
        response: errorMsg,
        toolCalls: [],
        interviewStatus: 'in_progress',
        error: error.message,
      };
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd D:/school-business/openinteraction/server
npx vitest run tests/agent/interviewAgent.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/agent/ server/tests/agent/
git commit -m "feat: add interview agent with tool calling loop"
```

---

## Task 8: API Routes

**Files:**
- Create: `server/src/routes/interview.js`
- Create: `server/src/routes/chat.js`
- Modify: `server/src/index.js`
- Create: `server/tests/routes/interview.test.js`
- Create: `server/tests/routes/chat.test.js`

- [ ] **Step 1: Write interview route tests**

Write `server/tests/routes/interview.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { initDb, getDb } from '../../src/db/database.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const TEST_DB = './test-routes-interview.db';

let app;

beforeAll(async () => {
  process.env.DB_PATH = TEST_DB;
  const mod = await import('../../src/index.js');
  app = mod.default;
});

describe('Interview Routes', () => {
  let projectId;

  beforeEach(() => {
    initDb(TEST_DB);
    const db = getDb();

    projectId = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(
      projectId, 'TestApp', 'A test app', JSON.stringify([{ id: 'search', description: '搜索体验' }])
    );
  });

  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('POST /api/interview/create creates interview and returns share link', async () => {
    const res = await request(app)
      .post('/api/interview/create')
      .send({ project_id: projectId })
      .expect(201);

    expect(res.body.interview_id).toBeDefined();
    expect(res.body.share_token).toBeDefined();
    expect(res.body.share_link).toContain(res.body.share_token);
  });

  it('GET /api/interview/:token returns interview data', async () => {
    // Create interview first
    const createRes = await request(app)
      .post('/api/interview/create')
      .send({ project_id: projectId });

    const token = createRes.body.share_token;

    const res = await request(app)
      .get(`/api/interview/${token}`)
      .expect(200);

    expect(res.body.status).toBe('in_progress');
    expect(res.body.project_name).toBe('TestApp');
  });

  it('GET /api/interview/:token returns 404 for invalid token', async () => {
    await request(app)
      .get('/api/interview/nonexistent')
      .expect(404);
  });
});
```

- [ ] **Step 2: Write chat route tests**

Write `server/tests/routes/chat.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { initDb, getDb } from '../../src/db/database.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const TEST_DB = './test-routes-chat.db';

let app;

beforeAll(async () => {
  process.env.DB_PATH = TEST_DB;
  // Mock LLM provider
  process.env.LLM_API_KEY = 'test-key';
  process.env.LLM_BASE_URL = 'http://localhost:9999'; // won't actually connect
  const mod = await import('../../src/index.js');
  app = mod.default;
});

describe('Chat Routes', () => {
  let interviewId;

  beforeEach(() => {
    initDb(TEST_DB);
    const db = getDb();

    const projectId = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(
      projectId, 'TestApp', 'A test app', JSON.stringify([{ id: 'search', description: '搜索体验' }])
    );

    interviewId = uuid();
    db.prepare('INSERT INTO interviews (id, project_id, share_token) VALUES (?, ?, ?)').run(
      interviewId, projectId, 'test-token'
    );
  });

  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('POST /api/chat requires interview_id and message', async () => {
    await request(app)
      .post('/api/chat')
      .send({})
      .expect(400);
  });

  it('POST /api/chat returns 404 for invalid interview', async () => {
    await request(app)
      .post('/api/chat')
      .send({ interview_id: 'nonexistent', message: 'hello' })
      .expect(404);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd D:/school-business/openinteraction/server
npx vitest run tests/routes/
```

Expected: FAIL — routes not implemented

- [ ] **Step 4: Write interview routes**

Write `server/src/routes/interview.js`:

```js
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
```

- [ ] **Step 5: Write chat routes**

Write `server/src/routes/chat.js`:

```js
import { Router } from 'express';
import { getDb } from '../db/database.js';
import { LLMProvider } from '../llm/provider.js';
import { InterviewAgent } from '../agent/interviewAgent.js';

const router = Router();

router.post('/', async (req, res) => {
  const { interview_id, message } = req.body;

  if (!interview_id || !message) {
    return res.status(400).json({ error: 'interview_id and message are required' });
  }

  const db = getDb();
  const interview = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interview_id);

  if (!interview) {
    return res.status(404).json({ error: 'Interview not found' });
  }

  if (interview.status !== 'in_progress') {
    return res.status(400).json({ error: 'Interview already completed' });
  }

  try {
    const llmProvider = new LLMProvider();
    const agent = new InterviewAgent(interview_id, interview.project_id, llmProvider);

    const result = await agent.processMessage(message);

    res.json({
      response: result.response,
      tool_calls: result.toolCalls,
      interview_status: result.interviewStatus,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

- [ ] **Step 6: Update index.js to mount routes and init DB**

Rewrite `server/src/index.js`:

```js
import express from 'express';
import cors from 'cors';
import { initDb } from './db/database.js';
import interviewRoutes from './routes/interview.js';
import chatRoutes from './routes/chat.js';

const dbPath = process.env.DB_PATH || './data/interview.db';
initDb(dbPath);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/interview', interviewRoutes);
app.use('/api/chat', chatRoutes);

const PORT = process.env.PORT || 3001;

// Only start listening if not imported as module (for testing)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd D:/school-business/openinteraction/server
npx vitest run tests/routes/
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/ server/tests/routes/
git commit -m "feat: add API routes for interview creation and chat"
```

---

## Task 9: Client Project Setup

**Files:**
- Create: `client/` (Vite React project)

- [ ] **Step 1: Create React project with Vite**

```bash
cd D:/school-business/openinteraction
npm create vite@latest client -- --template react
cd client
npm install
npm install react-router-dom
```

- [ ] **Step 2: Clean up default files**

Remove default boilerplate files: `src/App.css`, `src/assets/`, `src/index.css` content.

Write minimal `client/src/main.jsx`:

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: Set up routing in App.jsx**

Write `client/src/App.jsx`:

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ChatPage from './pages/ChatPage';
import CompletePage from './pages/CompletePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/interview/:token" element={<LandingPage />} />
        <Route path="/interview/:token/chat" element={<ChatPage />} />
        <Route path="/interview/:token/complete" element={<CompletePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 4: Create API client**

Write `client/src/api/client.js`:

```js
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export async function getInterview(token) {
  const res = await fetch(`${API_BASE}/interview/${token}`);
  if (!res.ok) throw new Error('Interview not found');
  return res.json();
}

export async function sendMessage(interviewId, message) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interview_id: interviewId, message }),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}
```

- [ ] **Step 5: Verify client starts**

```bash
cd D:/school-business/openinteraction/client
npm run dev &
sleep 3
curl http://localhost:5173
kill %1
```

Expected: HTML page loads

- [ ] **Step 6: Commit**

```bash
cd D:/school-business/openinteraction
git add client/
git commit -m "feat: initialize React client with Vite and routing"
```

---

## Task 10: Landing Page

**Files:**
- Create: `client/src/pages/LandingPage.jsx`

- [ ] **Step 1: Write landing page**

Write `client/src/pages/LandingPage.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInterview } from '../api/client';

function LandingPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getInterview(token)
      .then(data => {
        setInterview(data);
        setLoading(false);
      })
      .catch(err => {
        setError('访谈链接无效或已过期');
        setLoading(false);
      });
  }, [token]);

  const handleStart = () => {
    navigate(`/interview/${token}/chat`, { state: { interview } });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>出错了</h2>
          <p style={styles.text}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Hi, 想跟你聊聊~</h1>
        <p style={styles.text}>
          我们想了解一下你使用「{interview.project_name}」的体验，就像朋友间随便聊聊，
          没有标准答案，想到什么说什么就好。
        </p>
        <p style={styles.duration}>大概需要 10-15 分钟</p>
        <button style={styles.button} onClick={handleStart}>
          开始聊天
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f1419',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    background: '#1a2332',
    borderRadius: '16px',
    padding: '48px',
    maxWidth: '480px',
    width: '90%',
    textAlign: 'center',
  },
  title: {
    color: '#e8e8e8',
    fontSize: '28px',
    marginBottom: '20px',
    fontWeight: '600',
  },
  text: {
    color: '#8899aa',
    fontSize: '16px',
    lineHeight: '1.6',
    marginBottom: '16px',
  },
  duration: {
    color: '#555',
    fontSize: '14px',
    marginBottom: '32px',
  },
  button: {
    background: 'linear-gradient(135deg, #4a9eff, #8b5cf6)',
    border: 'none',
    borderRadius: '24px',
    padding: '14px 48px',
    color: 'white',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};

export default LandingPage;
```

- [ ] **Step 2: Verify landing page renders**

```bash
cd D:/school-business/openinteraction/client
npm run dev
```

Open browser to `http://localhost:5173/interview/test-token` — should show the landing page (with error since no backend running yet).

- [ ] **Step 3: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/pages/LandingPage.jsx
git commit -m "feat: add landing page for interview entry"
```

---

## Task 11: Chat Components

**Files:**
- Create: `client/src/components/MessageList.jsx`
- Create: `client/src/components/MessageInput.jsx`
- Create: `client/src/components/TypingIndicator.jsx`

- [ ] **Step 1: Write MessageList component**

Write `client/src/components/MessageList.jsx`:

```jsx
import { useEffect, useRef } from 'react';

function MessageList({ messages }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={styles.container}>
      {messages.map((msg, i) => (
        <div
          key={i}
          style={{
            ...styles.messageRow,
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}
        >
          {msg.role !== 'user' && (
            <div style={styles.avatar}>🤖</div>
          )}
          <div
            style={{
              ...styles.bubble,
              ...(msg.role === 'user' ? styles.userBubble : styles.agentBubble),
            }}
          >
            {msg.content}
          </div>
          {msg.role === 'user' && (
            <div style={{ ...styles.avatar, background: '#2a3a4a' }}>👤</div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  messageRow: {
    display: 'flex',
    gap: '8px',
    maxWidth: '85%',
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #4a9eff, #8b5cf6)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
  },
  bubble: {
    padding: '10px 14px',
    fontSize: '14px',
    lineHeight: '1.5',
    maxWidth: '100%',
    wordBreak: 'break-word',
  },
  userBubble: {
    background: '#2d4a7a',
    borderRadius: '16px 16px 4px 16px',
    color: '#e8e8e8',
  },
  agentBubble: {
    background: '#1e2a3a',
    borderRadius: '16px 16px 16px 4px',
    color: '#d4d4d4',
  },
};

export default MessageList;
```

- [ ] **Step 2: Write MessageInput component**

Write `client/src/components/MessageInput.jsx`:

```jsx
import { useState } from 'react';

function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <form style={styles.container} onSubmit={handleSubmit}>
      <input
        style={styles.input}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="说说你的想法..."
        disabled={disabled}
      />
      <button
        type="submit"
        style={{
          ...styles.button,
          opacity: disabled || !text.trim() ? 0.5 : 1,
        }}
        disabled={disabled || !text.trim()}
      >
        ➤
      </button>
    </form>
  );
}

const styles = {
  container: {
    padding: '12px 16px',
    borderTop: '1px solid #2a2a3a',
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    background: '#1a2332',
    border: '1px solid #333',
    borderRadius: '20px',
    padding: '10px 16px',
    color: '#e8e8e8',
    fontSize: '14px',
    outline: 'none',
  },
  button: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: '#4a9eff',
    border: 'none',
    color: 'white',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default MessageInput;
```

- [ ] **Step 3: Write TypingIndicator component**

Write `client/src/components/TypingIndicator.jsx`:

```jsx
function TypingIndicator() {
  return (
    <div style={styles.container}>
      <div style={styles.avatar}>🤖</div>
      <div style={styles.bubble}>
        <span style={styles.dot}>●</span>
        <span style={{ ...styles.dot, animationDelay: '0.2s' }}>●</span>
        <span style={{ ...styles.dot, animationDelay: '0.4s' }}>●</span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    gap: '8px',
    padding: '0 16px 16px',
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #4a9eff, #8b5cf6)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
  },
  bubble: {
    background: '#1e2a3a',
    borderRadius: '16px 16px 16px 4px',
    padding: '12px 16px',
    display: 'flex',
    gap: '4px',
  },
  dot: {
    color: '#4a9eff',
    fontSize: '8px',
    animation: 'pulse 1.4s infinite',
  },
};

export default TypingIndicator;
```

- [ ] **Step 4: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/components/
git commit -m "feat: add chat UI components (MessageList, MessageInput, TypingIndicator)"
```

---

## Task 12: Chat Page

**Files:**
- Create: `client/src/pages/ChatPage.jsx`

- [ ] **Step 1: Write ChatPage**

Write `client/src/pages/ChatPage.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getInterview, sendMessage } from '../api/client';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import TypingIndicator from '../components/TypingIndicator';

function ChatPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [interview, setInterview] = useState(location.state?.interview || null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!interview) {
      getInterview(token)
        .then(setInterview)
        .catch(() => navigate(`/interview/${token}`));
    }
  }, [token, interview, navigate]);

  const handleSend = async (text) => {
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    setError(null);

    try {
      const result = await sendMessage(interview.interview_id, text);
      setMessages(prev => [...prev, { role: 'assistant', content: result.response }]);

      if (result.interview_status === 'completed') {
        setTimeout(() => {
          navigate(`/interview/${token}/complete`, { state: { interview } });
        }, 1500);
      }
    } catch (err) {
      setError('发送失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerIcon}>💬</div>
        <div>
          <div style={styles.headerTitle}>产品体验访谈</div>
        </div>
      </div>

      <MessageList messages={messages} />
      {loading && <TypingIndicator />}
      {error && <div style={styles.error}>{error}</div>}

      <MessageInput onSend={handleSend} disabled={loading} />
    </div>
  );
}

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0f1419',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    maxWidth: '640px',
    margin: '0 auto',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #2a2a3a',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  headerIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #4a9eff, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
  },
  headerTitle: {
    color: '#e8e8e8',
    fontSize: '16px',
    fontWeight: '600',
  },
  error: {
    color: '#ef4444',
    textAlign: 'center',
    padding: '8px',
    fontSize: '13px',
  },
};

export default ChatPage;
```

- [ ] **Step 2: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/pages/ChatPage.jsx
git commit -m "feat: add chat page with message sending and agent response"
```

---

## Task 13: Completion Page

**Files:**
- Create: `client/src/pages/CompletePage.jsx`

- [ ] **Step 1: Write CompletePage**

Write `client/src/pages/CompletePage.jsx`:

```jsx
import { useParams, useLocation } from 'react-router-dom';

function CompletePage() {
  const { token } = useParams();
  const location = useLocation();
  const interview = location.state?.interview;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>✨</div>
        <h1 style={styles.title}>聊完啦，谢谢你！</h1>
        <p style={styles.text}>
          感谢你抽出时间分享使用体验，你的反馈对我们非常重要。
          每一条建议我们都会认真对待。
        </p>
        <p style={styles.subtext}>你可以关闭这个页面了</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f1419',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    background: '#1a2332',
    borderRadius: '16px',
    padding: '48px',
    maxWidth: '480px',
    width: '90%',
    textAlign: 'center',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '24px',
  },
  title: {
    color: '#e8e8e8',
    fontSize: '28px',
    marginBottom: '20px',
    fontWeight: '600',
  },
  text: {
    color: '#8899aa',
    fontSize: '16px',
    lineHeight: '1.6',
    marginBottom: '16px',
  },
  subtext: {
    color: '#555',
    fontSize: '14px',
  },
};

export default CompletePage;
```

- [ ] **Step 2: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/pages/CompletePage.jsx
git commit -m "feat: add interview completion page"
```

---

## Task 14: End-to-End Verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Start backend server**

```bash
cd D:/school-business/openinteraction/server
cp .env.example .env  # Create .env with LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
npm run dev
```

- [ ] **Step 2: Start frontend dev server**

```bash
cd D:/school-business/openinteraction/client
npm run dev
```

- [ ] **Step 3: Create a test project and interview via API**

```bash
# Create project
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"TestApp","product_context":"一个测试购物平台","core_topics":[{"id":"search","description":"搜索功能体验"},{"id":"checkout","description":"下单支付流程"}]}'

# Create interview (use project_id from above)
curl -X POST http://localhost:3001/api/interview/create \
  -H "Content-Type: application/json" \
  -d '{"project_id":"<PROJECT_ID>"}'
```

- [ ] **Step 4: Open share link in browser and complete a test interview**

Open the `share_link` from the previous step. Chat with the agent, verify:
- Agent greets naturally
- Agent asks follow-up questions
- Conversation flows naturally
- Interview ends properly

- [ ] **Step 5: Verify data was saved**

```bash
# Check annotations were extracted
curl http://localhost:3001/api/interview/<TOKEN>/annotations
```

- [ ] **Step 6: Run all server tests**

```bash
cd D:/school-business/openinteraction/server
npm test
```

Expected: All tests pass

- [ ] **Step 7: Commit any fixes**

```bash
cd D:/school-business/openinteraction
git add -A
git commit -m "fix: end-to-end verification fixes"
```

---

## Task 15: Project Admin Routes (for creating projects)

**Files:**
- Create: `server/src/routes/project.js`
- Modify: `server/src/index.js`

- [ ] **Step 1: Write project routes**

Write `server/src/routes/project.js`:

```js
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database.js';

const router = Router();

router.post('/', (req, res) => {
  const { name, product_context, core_topics, style_guide } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const db = getDb();
  const id = uuid();

  db.prepare(
    'INSERT INTO projects (id, name, product_context, core_topics, style_guide) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, product_context || '', JSON.stringify(core_topics || []), JSON.stringify(style_guide || {}));

  res.status(201).json({ id, name });
});

router.get('/', (req, res) => {
  const db = getDb();
  const projects = db.prepare('SELECT id, name, created_at FROM projects ORDER BY created_at DESC').all();
  res.json(projects);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  res.json({
    ...project,
    core_topics: JSON.parse(project.core_topics || '[]'),
    style_guide: JSON.parse(project.style_guide || '{}'),
  });
});

export default router;
```

- [ ] **Step 2: Mount project routes in index.js**

Add to `server/src/index.js` after existing route mounts:

```js
import projectRoutes from './routes/project.js';
app.use('/api/projects', projectRoutes);
```

- [ ] **Step 3: Run tests**

```bash
cd D:/school-business/openinteraction/server
npm test
```

Expected: All tests pass (no regressions)

- [ ] **Step 4: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/routes/project.js server/src/index.js
git commit -m "feat: add project CRUD routes"
```
