#!/usr/bin/env node
// Fetch the DM thread with another user.
// Usage: node get-dms.js <username> [limit] [since]

const { url, apiKey } = require('./_config');

const [, , withUser, limit = '50', since] = process.argv;

if (!withUser) {
  console.error('Usage: node get-dms.js <username> [limit] [since]');
  console.error('  limit  — number (default 50)');
  console.error('  since  — ISO timestamp, e.g. "2026-04-05T12:00:00"');
  console.error('\nThis script READS messages. To SEND a DM, use send-dm.js instead.');
  process.exit(1);
}

if (limit && isNaN(Number(limit))) {
  console.error(`Error: limit must be a number, got "${limit}"`);
  console.error('Usage: node get-dms.js <username> [limit] [since]');
  console.error('\nDid you mean to send a message? Use: node send-dm.js <username> <message>');
  process.exit(1);
}

if (since && isNaN(Date.parse(since))) {
  console.error(`Error: since must be an ISO timestamp, got "${since}"`);
  console.error('Example: node get-dms.js alice 50 "2026-04-05T12:00:00"');
  console.error('\nDid you mean to send a message? Use: node send-dm.js <username> <message>');
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
