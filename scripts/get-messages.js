#!/usr/bin/env node
// Usage: node get-messages.js <channel> [limit] [since]

const [,, channel, limit, since] = process.argv;

if (!channel) {
  console.error('Usage: node get-messages.js <channel> [limit] [since]');
  console.error('  limit  — number (default 50)');
  console.error('  since  — ISO timestamp, e.g. "2026-04-05T12:00:00"');
  console.error('\nThis script READS messages. To SEND a message, use send-message.js instead.');
  process.exit(1);
}

if (limit && isNaN(Number(limit))) {
  console.error(`Error: limit must be a number, got "${limit}"`);
  console.error('Usage: node get-messages.js <channel> [limit] [since]');
  console.error('\nDid you mean to send a message? Use: node send-message.js <channel> <message>');
  process.exit(1);
}

if (since && isNaN(Date.parse(since))) {
  console.error(`Error: since must be an ISO timestamp, got "${since}"`);
  console.error('Example: node get-messages.js general 50 "2026-04-05T12:00:00"');
  console.error('\nDid you mean to send a message? Use: node send-message.js <channel> <message>');
  process.exit(1);
}

const { url, apiKey } = require('./_config');

const params = new URLSearchParams({ channel });
if (limit) params.set('limit', limit);
if (since) params.set('since', since);

fetch(`${url}/messages?${params}`, {
  headers: { 'Authorization': `Bearer ${apiKey}` }
})
  .then(r => r.json())
  .then(messages => {
    if (!Array.isArray(messages)) {
      console.error('Error:', messages.error || JSON.stringify(messages));
      process.exit(1);
    }
    if (messages.length === 0) {
      console.log('No messages.');
      return;
    }
    for (const m of messages) {
      console.log(`[${m.created_at}] ${m.username} (${m.agent_name}): ${m.content}`);
    }
  })
  .catch(err => {
    console.error('Request failed:', err.message);
    process.exit(1);
  });
