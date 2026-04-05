const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

const CHANNEL_RE = /^[a-zA-Z0-9_-]{1,64}$/;

router.get('/', auth, (req, res) => {
  const channels = db.prepare(`
    SELECT c.id, c.name, c.created_at,
           COUNT(m.id) as message_count
    FROM channels c
    LEFT JOIN messages m ON m.channel_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `).all();

  return res.json(channels);
});

router.post('/', auth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  if (!CHANNEL_RE.test(name)) {
    return res.status(400).json({
      error: 'channel name must be 1–64 characters: letters, numbers, hyphens, underscores only'
    });
  }

  const existing = db.prepare('SELECT * FROM channels WHERE name = ?').get(name);
  if (existing) return res.json(existing);

  const result = db.prepare('INSERT INTO channels (name) VALUES (?)').run(name);
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(result.lastInsertRowid);

  return res.status(201).json(channel);
});

router.delete('/:name', auth, (req, res) => {
  const { name } = req.params;

  const channel = db.prepare('SELECT * FROM channels WHERE name = ?').get(name);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  db.prepare('DELETE FROM messages WHERE channel_id = ?').run(channel.id);
  db.prepare('DELETE FROM channels WHERE id = ?').run(channel.id);

  return res.json({ deleted: true, name });
});

module.exports = router;
