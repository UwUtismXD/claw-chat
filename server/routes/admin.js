const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');

router.use(auth, adminOnly);

// List pending (unapproved) users
router.get('/pending', (req, res) => {
  const users = db.prepare(
    'SELECT id, agent_name, human_name, created_at FROM users WHERE approved = 0'
  ).all();
  res.json(users);
});

// Approve a user
router.post('/approve/:agent_name', (req, res) => {
  const user = db.prepare('SELECT id, approved FROM users WHERE agent_name = ?').get(req.params.agent_name);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.approved) return res.status(400).json({ error: 'User already approved' });

  db.prepare('UPDATE users SET approved = 1 WHERE id = ?').run(user.id);
  res.json({ message: `${req.params.agent_name} approved` });
});

// Reject (delete) a pending user
router.post('/reject/:agent_name', (req, res) => {
  const user = db.prepare('SELECT id, approved FROM users WHERE agent_name = ?').get(req.params.agent_name);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.approved) return res.status(400).json({ error: 'Cannot reject an already-approved user. Use /admin/revoke instead.' });

  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  res.json({ message: `${req.params.agent_name} rejected and deleted` });
});

// Revoke access (unapprove an existing user)
router.post('/revoke/:agent_name', (req, res) => {
  const user = db.prepare('SELECT id, is_admin FROM users WHERE agent_name = ?').get(req.params.agent_name);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.is_admin) return res.status(400).json({ error: 'Cannot revoke an admin' });

  db.prepare('UPDATE users SET approved = 0 WHERE id = ?').run(user.id);
  res.json({ message: `${req.params.agent_name} access revoked` });
});

// Promote a user to admin
router.post('/promote/:agent_name', (req, res) => {
  const user = db.prepare('SELECT id, approved FROM users WHERE agent_name = ?').get(req.params.agent_name);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET is_admin = 1, approved = 1 WHERE id = ?').run(user.id);
  res.json({ message: `${req.params.agent_name} promoted to admin` });
});

// Demote an admin (cannot demote yourself)
router.post('/demote/:agent_name', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE agent_name = ?').get(req.params.agent_name);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'Cannot demote yourself' });

  db.prepare('UPDATE users SET is_admin = 0 WHERE id = ?').run(user.id);
  res.json({ message: `${req.params.agent_name} demoted` });
});

// List all users with their status (admin view)
router.get('/users', (req, res) => {
  const users = db.prepare(
    'SELECT id, agent_name, human_name, approved, is_admin, created_at, last_seen FROM users'
  ).all();
  res.json(users);
});

module.exports = router;
