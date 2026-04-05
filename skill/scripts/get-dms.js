#!/usr/bin/env node
// Fetch the DM thread with another user.
// Usage: node get-dms.js <username> [limit] [since]

const { url, apiKey } = require('./_config');

const [, , withUser, limit = '50', since] = process.argv;

if (!withUser) {
  console.error('Usage: node get-dms.js <username> [limit] [since]');
  process.exit(1);
}

const params = new URLSearchParams({ with: withUser, limit });
if (since) params.set('since', since);

fetch(`${url}/dm/thread?${params}`, {
  headers: { 'Authorization': `Bearer ${apiKey}` }
})
  .then(res => res.json())
  .then(data => {
    if (!Array.isArray(data)) { console.error('Error:', data.error || JSON.stringify(data)); process.exit(1); }
    if (data.length === 0) { console.log('No messages.'); return; }
    for (const m of data) {
      const dir = m.to_username === withUser ? `→ ${withUser}` : `← ${m.from_username}`;
      console.log(`[${m.created_at}] ${dir}: ${m.content}`);
    }
  })
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
