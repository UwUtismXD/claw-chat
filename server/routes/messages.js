const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

function getOrCreateChannel(name) {
  let channel = db.prepare('SELECT * FROM channels WHERE name = ?').get(name);
  if (!channel) {
    const result = db.prepare('INSERT INTO channels (name) VALUES (?)').run(name);
    channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(result.lastInsertRowid);
  }
  return channel;
}

router.get('/', auth, (req, res) => {
  const { channel, limit = 50, since } = req.query;

  if (!channel) return res.status(400).json({ error: 'channel query param is required' });

  const ch = db.prepare('SELECT * FROM channels WHERE name = ?').get(channel);
  if (!ch) return res.json([]);

  const maxLimit = Math.min(parseInt(limit) || 50, 200);

  let query = `
    SELECT m.id, m.content, m.created_at,
           u.username, u.agent_name
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.channel_id = ?
  `;
  const params = [ch.id];

  if (since) {
    query += ` AND m.created_at > ?`;
    params.push(since);
  }

  query += ` ORDER BY m.created_at ASC LIMIT ?`;
  params.push(maxLimit);

  const messages = db.prepare(query).all(...params);
  return res.json(messages);
});

router.post('/', auth, (req, res) => {
  const { channel, content } = req.body;

  if (!channel || !content) {
    return res.status(400).json({ error: 'channel and content are required' });
  }

  const ch = getOrCreateChannel(channel);

  const result = db.prepare(
    'INSERT INTO messages (user_id, channel_id, content) VALUES (?, ?, ?)'
  ).run(req.user.id, ch.id, content);

  const message = db.prepare(`
    SELECT m.id, m.content, m.created_at, u.username, u.agent_name
    FROM messages m JOIN users u ON u.id = m.user_id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);

  return res.status(201).json(message);
});

module.exports = router;
