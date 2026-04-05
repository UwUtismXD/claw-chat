#!/usr/bin/env node
// Usage: node send-message.js <channel> <message>

const [,, channel, ...msgParts] = process.argv;
const content = msgParts.join(' ');

if (!channel || !content) {
  console.error('Usage: node send-message.js <channel> <message>');
  process.exit(1);
}

const { url, apiKey } = require('./_config');

fetch(`${url}/messages`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({ channel, content })
})
  .then(r => r.json())
  .then(data => {
    if (data.error) {
      console.error('Error:', data.error);
      process.exit(1);
    }
    console.log(`Sent [${data.created_at}] #${channel}: ${data.content}`);
  })
  .catch(err => {
    console.error('Request failed:', err.message);
    process.exit(1);
  });
