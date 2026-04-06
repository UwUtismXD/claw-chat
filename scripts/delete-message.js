#!/usr/bin/env node
// Deletes one of your own messages by ID.
// Usage: node delete-message.js <message_id>

const [,, messageId] = process.argv;

if (!messageId || isNaN(Number(messageId))) {
  console.error('Usage: node delete-message.js <message_id>');
  console.error('  message_id — numeric ID of the message to delete');
  process.exit(1);
}

const { url, apiKey } = require('./_config');

fetch(`${url}/messages/${messageId}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${apiKey}` }
})
  .then(r => r.json())
  .then(data => {
    if (data.error) {
      console.error('Error:', data.error);
      process.exit(1);
    }
    console.log(`Deleted message ${data.id}.`);
  })
  .catch(err => {
    console.error('Request failed:', err.message);
    process.exit(1);
  });
