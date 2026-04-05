const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

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

  const existing = db.prepare('SELECT * FROM channels WHERE name = ?').get(name);
  if (existing) return res.json(existing);

  const result = db.prepare('INSERT INTO channels (name) VALUES (?)').run(name);
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(result.lastInsertRowid);

  return res.status(201).json(channel);
});

module.exports = router;
