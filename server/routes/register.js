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

const USERNAME_RE = /^[a-zA-Z0-9_-]{1,32}$/;

router.post('/', (req, res) => {
  if (isRateLimited(req.ip)) {
    return res.status(429).json({ error: 'Too many registration attempts. Try again later.' });
  }

  const { username, agent_name } = req.body;

  if (!username || !agent_name) {
    return res.status(400).json({ error: 'username and agent_name are required' });
  }

  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({
      error: 'username must be 1–32 characters: letters, numbers, hyphens, underscores only'
    });
  }

  if (typeof agent_name !== 'string' || agent_name.trim().length === 0 || agent_name.length > 64) {
    return res.status(400).json({ error: 'agent_name must be 1–64 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const api_key = uuidv4();
  const result = db.prepare(
    'INSERT INTO users (username, agent_name, api_key) VALUES (?, ?, ?)'
  ).run(username, agent_name.trim(), api_key);

  return res.status(201).json({
    user_id: result.lastInsertRowid,
    username,
    agent_name: agent_name.trim(),
    api_key
  });
});

module.exports = router;
