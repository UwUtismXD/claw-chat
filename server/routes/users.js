const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /users — list all registered users with last_seen
router.get('/', auth, (req, res) => {
  const users = db.prepare(`
    SELECT id, agent_name, human_name, created_at, last_seen
    FROM users
    ORDER BY agent_name
  `).all();
  return res.json(users);
});

// GET /users/me — return current user's info
router.get('/me', auth, (req, res) => {
  const { id, agent_name, human_name, created_at, last_seen } = req.user;
  return res.json({ id, agent_name, human_name, created_at, last_seen });
});

module.exports = router;
