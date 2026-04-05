const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

const MAX_CONTENT_LENGTH = 4000;
const CHANNEL_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function getOrCreateChannel(name) {
  let channel = db.prepare('SELECT * FROM channels WHERE name = ?').get(name);
  if (!channel) {
    const result = db.prepare('INSERT INTO channels (name) VALUES (?)').run(name);
    channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(result.lastInsertRowid);
  }
  return channel;
}

router.get('/', auth, (req, res) => {
  const { channel, limit = 50, since, before } = req.query;

  if (!channel) return res.status(400).json({ error: 'channel query param is required' });

  const ch = db.prepare('SELECT * FROM channels WHERE name = ?').get(channel);
  if (!ch) return res.json([]);

  const maxLimit = Math.min(parseInt(limit) || 50, 200);
  const params = [ch.id];

  let query = `
    SELECT m.id, m.content, m.created_at,
           u.username, u.agent_name
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.channel_id = ?
  `;

  if (since) { query += ` AND m.created_at > ?`; params.push(since); }
  if (before) { query += ` AND m.created_at < ?`; params.push(before); }

  // Paging backwards: fetch DESC then reverse so output is always oldest→newest
  if (before && !since) {
    query += ` ORDER BY m.created_at DESC LIMIT ?`;
    params.push(maxLimit);
    const messages = db.prepare(query).all(...params);
    return res.json(messages.reverse());
  }

  query += ` ORDER BY m.created_at ASC LIMIT ?`;
  params.push(maxLimit);

  return res.json(db.prepare(query).all(...params));
});

router.post('/', auth, (req, res) => {
  const { channel, content } = req.body;

  if (!channel || !content) {
    return res.status(400).json({ error: 'channel and content are required' });
  }

  if (!CHANNEL_RE.test(channel)) {
    return res.status(400).json({
      error: 'channel name must be 1–64 characters: letters, numbers, hyphens, underscores only'
    });
  }

  if (typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'content cannot be empty' });
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({
      error: `content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`
    });
  }

  const ch = getOrCreateChannel(channel);

  const result = db.prepare(
    'INSERT INTO messages (user_id, channel_id, content) VALUES (?, ?, ?)'
  ).run(req.user.id, ch.id, content.trim());

  const message = db.prepare(`
    SELECT m.id, m.content, m.created_at, u.username, u.agent_name
    FROM messages m JOIN users u ON u.id = m.user_id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);

  return res.status(201).json(message);
});

router.delete('/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid message id' });

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  if (!message) return res.status(404).json({ error: 'Message not found' });

  if (message.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own messages' });
  }

  db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  return res.json({ deleted: true, id });
});

module.exports = router;
