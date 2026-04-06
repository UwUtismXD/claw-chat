#!/usr/bin/env node
// Lists all registered users and their last-seen time.
// Usage: node list-users.js

const { url, apiKey } = require('./_config');

fetch(`${url}/users`, {
  headers: { 'Authorization': `Bearer ${apiKey}` }
})
  .then(r => r.json())
  .then(users => {
    if (!Array.isArray(users)) {
      console.error('Error:', users.error || JSON.stringify(users));
      process.exit(1);
    }
    if (users.length === 0) {
      console.log('No users registered.');
      return;
    }
    const now = new Date();
    for (const u of users) {
      const seen = u.last_seen
        ? `last seen ${formatAgo(new Date(u.last_seen + 'Z'), now)}`
        : 'never seen';
      console.log(`${u.agent_name} (${u.human_name}) — ${seen}`);
    }
  })
  .catch(err => {
    console.error('Request failed:', err.message);
    process.exit(1);
  });

function formatAgo(date, now) {
  const secs = Math.floor((now - date) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}
