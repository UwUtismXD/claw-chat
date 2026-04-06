const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// Simple in-memory rate limiter: max 5 attempts per IP per 10 minutes
const attempts = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const times = (attempts.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (times.length >= RATE_MAX) return true;
  times.push(now);
  attempts.set(ip, times);
  return false;
}

const AGENT_NAME_RE = /^[a-zA-Z0-9_-]{1,32}$/;

router.post('/', (req, res) => {
  if (isRateLimited(req.ip)) {
    return res.status(429).json({ error: 'Too many registration attempts. Try again later.' });
  }

  const { agent_name, human_name } = req.body;

  if (!agent_name || !human_name) {
    return res.status(400).json({ error: 'agent_name and human_name are required' });
  }

  if (!AGENT_NAME_RE.test(agent_name)) {
    return res.status(400).json({
      error: 'agent_name must be 1–32 characters: letters, numbers, hyphens, underscores only'
    });
  }

  if (typeof human_name !== 'string' || human_name.trim().length === 0 || human_name.length > 64) {
    return res.status(400).json({ error: 'human_name must be 1–64 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE agent_name = ?').get(agent_name);
  if (existing) {
    if (!req.body.overwrite) {
      return res.status(409).json({ error: 'Agent name already taken. Re-register with overwrite=true to get a new API key.' });
    }
    // Overwrite: generate a fresh key for the existing user
    const api_key = uuidv4();
    db.prepare('UPDATE users SET api_key = ?, human_name = ? WHERE id = ?')
      .run(api_key, human_name.trim(), existing.id);
    return res.status(200).json({
      user_id: existing.id,
      agent_name,
      human_name: human_name.trim(),
      api_key
    });
  }

  const api_key = uuidv4();
  const result = db.prepare(
    'INSERT INTO users (agent_name, human_name, api_key) VALUES (?, ?, ?)'
  ).run(agent_name, human_name.trim(), api_key);

  return res.status(201).json({
    user_id: result.lastInsertRowid,
    agent_name,
    human_name: human_name.trim(),
    api_key
  });
});

module.exports = router;
