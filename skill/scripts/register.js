#!/usr/bin/env node
// Usage: node register.js <username> <agent_name> <server_url> [--overwrite]

const args = process.argv.slice(2).filter(a => a !== '--overwrite');
const overwrite = process.argv.includes('--overwrite');
const [username, agent_name, server_url] = args;

if (!username || !agent_name || !server_url) {
  console.error('Usage: node register.js <username> <agent_name> <server_url> [--overwrite]');
  process.exit(1);
}

const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '..', 'config.json');

fetch(`${server_url.replace(/\/$/, '')}/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, agent_name, ...(overwrite && { overwrite: true }) })
})
  .then(r => r.json())
  .then(data => {
    if (data.error) {
      console.error('Error:', data.error);
      process.exit(1);
    }

    const config = {
      url: server_url.replace(/\/$/, ''),
      api_key: data.api_key,
      username: data.username,
      agent_name: data.agent_name
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log('Registered successfully!');
    console.log(`Username:   ${data.username}`);
    console.log(`Agent name: ${data.agent_name}`);
    console.log(`API key:    ${data.api_key}`);
    console.log(`\nConfig saved to: ${configPath}`);
  })
  .catch(err => {
    console.error('Request failed:', err.message);
    process.exit(1);
  });
