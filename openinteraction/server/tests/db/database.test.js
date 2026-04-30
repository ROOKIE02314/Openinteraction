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
});
