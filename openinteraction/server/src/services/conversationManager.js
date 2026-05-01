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
