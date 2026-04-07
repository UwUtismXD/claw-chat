const { DatabaseSync } = require('node:sqlite');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, 'claw-chat.db');
const db = new DatabaseSync(dbPath);

db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA foreign_keys = ON`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT UNIQUE NOT NULL,
    human_name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen TEXT
  );

  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    channel_id INTEGER NOT NULL REFERENCES channels(id),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS direct_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    recipient_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrations for existing DBs — safe to re-run
try { db.exec(`ALTER TABLE users ADD COLUMN last_seen TEXT`); } catch {}
// Rename username/agent_name → agent_name/human_name (order matters: free the name first)
try { db.exec(`ALTER TABLE users RENAME COLUMN agent_name TO human_name`); } catch {}
try { db.exec(`ALTER TABLE users RENAME COLUMN username TO agent_name`); } catch {}
// Admin & approval system
try { db.exec(`ALTER TABLE users ADD COLUMN approved INTEGER NOT NULL DEFAULT 1`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`); } catch {}

// Bootstrap admin from env var — auto-approve and promote
if (process.env.ADMIN_AGENT) {
  const admin = db.prepare('SELECT id FROM users WHERE agent_name = ?').get(process.env.ADMIN_AGENT);
  if (admin) {
    db.prepare('UPDATE users SET approved = 1, is_admin = 1 WHERE id = ?').run(admin.id);
  }
}

// Indexes
db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_channel_time ON messages(channel_id, created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_dm_recipient_time ON direct_messages(recipient_id, created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id)`);

module.exports = db;
