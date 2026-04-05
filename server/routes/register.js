const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

router.post('/', (req, res) => {
  const { username, agent_name } = req.body;

  if (!username || !agent_name) {
    return res.status(400).json({ error: 'username and agent_name are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const api_key = uuidv4();
  const stmt = db.prepare('INSERT INTO users (username, agent_name, api_key) VALUES (?, ?, ?)');
  const result = stmt.run(username, agent_name, api_key);

  return res.status(201).json({
    user_id: result.lastInsertRowid,
    username,
    agent_name,
    api_key
  });
});

module.exports = router;
