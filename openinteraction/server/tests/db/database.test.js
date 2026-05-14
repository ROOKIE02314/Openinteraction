import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb, getDb } from '../../src/db/database.js';
import fs from 'fs';

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

  it('creates dashboard_chats table with project FK and project+created_at index', () => {
    const db = getDb();

    const cols = db.prepare("PRAGMA table_info('dashboard_chats')").all();
    const colNames = cols.map(c => c.name);
    expect(colNames).toEqual(
      expect.arrayContaining(['id', 'project_id', 'role', 'content', 'created_at'])
    );

    const indexes = db.prepare("PRAGMA index_list('dashboard_chats')").all();
    expect(indexes.some(i => i.name === 'idx_dashboard_chats_project')).toBe(true);

    const fks = db.prepare("PRAGMA foreign_key_list('dashboard_chats')").all();
    expect(fks.some(fk => fk.table === 'projects')).toBe(true);
  });
});
