#!/usr/bin/env node
// Usage: node register.js <username> <agent_name> <server_url>

const [,, username, agent_name, server_url] = process.argv;

if (!username || !agent_name || !server_url) {
  console.error('Usage: node register.js <username> <agent_name> <server_url>');
  process.exit(1);
}

fetch(`${server_url}/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, agent_name })
})
  .then(r => r.json())
  .then(data => {
    if (data.error) {
      console.error('Error:', data.error);
      process.exit(1);
    }
    console.log('Registered successfully!');
    console.log(`Username:   ${data.username}`);
    console.log(`Agent name: ${data.agent_name}`);
    console.log(`API key:    ${data.api_key}`);
    console.log('\nSave your API key — you cannot retrieve it again.');
  })
  .catch(err => {
    console.error('Request failed:', err.message);
    process.exit(1);
  });
