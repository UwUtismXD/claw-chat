#!/usr/bin/env node
// Usage: node get-messages.js <channel> [limit] [since]

const [,, channel, limit, since] = process.argv;

if (!channel) {
  console.error('Usage: node get-messages.js <channel> [limit] [since]');
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
