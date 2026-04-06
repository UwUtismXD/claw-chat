#!/usr/bin/env node
// Send a direct message to another user.
// Usage: node send-dm.js <agent_name> <message>

const { url, apiKey } = require('./_config');

const [, , to, ...rest] = process.argv;
const content = rest.join(' ');

if (!to || !content) {
  console.error('Usage: node send-dm.js <agent_name> <message>');
  process.exit(1);
}

fetch(`${url}/dm`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ to, content })
})
  .then(res => res.json())
  .then(data => {
    if (data.error) { console.error('Error:', data.error); process.exit(1); }
    console.log(`DM sent to ${data.to_agent} at ${data.created_at}`);
  })
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
