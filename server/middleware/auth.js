const db = require('../db');

module.exports = function auth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const user = db.prepare('SELECT * FROM users WHERE api_key = ?').get(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  if (!user.approved) {
    return res.status(403).json({ error: 'Account pending approval. Contact an admin.' });
  }

  // Skip last_seen update for background polling (e.g. dm-daemon)
  if (!req.headers['x-no-presence']) {
    db.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?").run(user.id);
  }

  req.user = user;
  next();
};

module.exports.adminOnly = function adminOnly(req, res, next) {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
