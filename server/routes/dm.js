const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

const MAX_CONTENT_LENGTH = 4000;

// GET /dm/inbox — all DMs sent to me, newest-last
// Query: ?limit=50&since=<ISO>
router.get('/inbox', auth, (req, res) => {
  const { limit = 50, since } = req.query;
  const maxLimit = Math.min(parseInt(limit) || 50, 200);
  const params = [req.user.id];

  let query = `
    SELECT dm.id, dm.content, dm.created_at,
           s.username AS from_username, s.agent_name AS from_agent_name
    FROM direct_messages dm
    JOIN users s ON s.id = dm.sender_id
    WHERE dm.recipient_id = ?
  `;

  if (since) { query += ` AND dm.created_at > ?`; params.push(since); }
  query += ` ORDER BY dm.created_at ASC LIMIT ?`;
  params.push(maxLimit);

  return res.json(db.prepare(query).all(...params));
});

// GET /dm/thread?with=<username> — full conversation between me and another user
// Query: ?limit=50&since=<ISO>
router.get('/thread', auth, (req, res) => {
  const { with: withUsername, limit = 50, since } = req.query;
  if (!withUsername) return res.status(400).json({ error: 'with query param is required' });

  const other = db.prepare('SELECT * FROM users WHERE username = ?').get(withUsername);
  if (!other) return res.status(404).json({ error: 'User not found' });

  const maxLimit = Math.min(parseInt(limit) || 50, 200);
  const params = [req.user.id, other.id, other.id, req.user.id];

  let query = `
    SELECT dm.id, dm.content, dm.created_at,
           s.username AS from_username, s.agent_name AS from_agent_name,
           r.username AS to_username
    FROM direct_messages dm
    JOIN users s ON s.id = dm.sender_id
    JOIN users r ON r.id = dm.recipient_id
    WHERE (dm.sender_id = ? AND dm.recipient_id = ?)
       OR (dm.sender_id = ? AND dm.recipient_id = ?)
  `;

  if (since) { query += ` AND dm.created_at > ?`; params.push(since); }
  query += ` ORDER BY dm.created_at ASC LIMIT ?`;
  params.push(maxLimit);

  return res.json(db.prepare(query).all(...params));
});

// POST /dm — send a DM
// Body: { to: "username", content: "..." }
// GET /dm/all — all DMs on the server (admin/observer view)
// Query: ?limit=100&since=<ISO>&from=username&to=username (from+to = bidirectional thread)
router.get('/all', auth, (req, res) => {
  const { limit = 100, since, from: fromUser, to: toUser } = req.query;
  const maxLimit = Math.min(parseInt(limit) || 100, 500);
  const params = [];

  let query = `
    SELECT dm.id, dm.content, dm.created_at,
           s.username AS from_username, s.agent_name AS from_agent_name,
           r.username AS to_username
    FROM direct_messages dm
    JOIN users s ON s.id = dm.sender_id
    JOIN users r ON r.id = dm.recipient_id
    WHERE 1=1
  `;

  if (fromUser && toUser) {
    query += ` AND ((s.username = ? AND r.username = ?) OR (s.username = ? AND r.username = ?))`;
    params.push(fromUser, toUser, toUser, fromUser);
  } else if (fromUser) {
    query += ` AND s.username = ?`; params.push(fromUser);
  } else if (toUser) {
    query += ` AND r.username = ?`; params.push(toUser);
  }

  if (since) { query += ` AND dm.created_at > ?`; params.push(since); }
  query += ` ORDER BY dm.created_at ASC LIMIT ?`;
  params.push(maxLimit);

  return res.json(db.prepare(query).all(...params));
});

router.post('/', auth, (req, res) => {
  const { to, content } = req.body;

  if (!to || !content) {
    return res.status(400).json({ error: 'to and content are required' });
  }

  if (typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'content cannot be empty' });
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({
      error: `content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`
    });
  }

  const recipient = db.prepare('SELECT * FROM users WHERE username = ?').get(to);
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

  if (recipient.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot send a DM to yourself' });
  }

  const result = db.prepare(
    'INSERT INTO direct_messages (sender_id, recipient_id, content) VALUES (?, ?, ?)'
  ).run(req.user.id, recipient.id, content.trim());

  const message = db.prepare(`
    SELECT dm.id, dm.content, dm.created_at,
           s.username AS from_username, s.agent_name AS from_agent_name,
           r.username AS to_username
    FROM direct_messages dm
    JOIN users s ON s.id = dm.sender_id
    JOIN users r ON r.id = dm.recipient_id
    WHERE dm.id = ?
  `).get(result.lastInsertRowid);

  return res.status(201).json(message);
});

module.exports = router;
