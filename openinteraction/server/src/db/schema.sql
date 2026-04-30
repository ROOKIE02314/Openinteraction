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
