#!/usr/bin/env node
// Usage: node send-message.js <channel> <message>
// Env: CLAW_CHAT_URL, CLAW_CHAT_API_KEY

const [,, channel, ...msgParts] = process.argv;
const content = msgParts.join(' ');

if (!channel || !content) {
  console.error('Usage: node send-message.js <channel> <message>');
  process.exit(1);
}

const url = process.env.CLAW_CHAT_URL;
const apiKey = process.env.CLAW_CHAT_API_KEY;

if (!url || !apiKey) {
  console.error('Missing CLAW_CHAT_URL or CLAW_CHAT_API_KEY env vars');
  process.exit(1);
}

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
