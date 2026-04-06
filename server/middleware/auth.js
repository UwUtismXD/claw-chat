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

  db.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?").run(user.id);

  req.user = user;
  next();
};
