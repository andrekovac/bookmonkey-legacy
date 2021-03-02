// Tiny wrapper around node:sqlite. One connection for the whole process.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_FILE = process.env.BM_DB_FILE || path.join(__dirname, 'data', 'bookmonkey.db');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

let db = null;

function open() {
  if (db) return db;
  if (DB_FILE !== ':memory:') {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  }
  db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(conn) {
  conn.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const applied = conn.prepare('SELECT name FROM schema_migrations').all().map(r => r.name);
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

  files.forEach(function (file) {
    if (applied.indexOf(file) !== -1) return;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    conn.exec('BEGIN');
    try {
      conn.exec(sql);
      conn.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)')
        .run(file, new Date().toISOString());
      conn.exec('COMMIT');
      if (process.env.NODE_ENV !== 'test') console.log('[db] applied ' + file);
    } catch (err) {
      conn.exec('ROLLBACK');
      err.message = 'migration ' + file + ' failed: ' + err.message;
      throw err;
    }
  });
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { open, close, migrate, DB_FILE };
