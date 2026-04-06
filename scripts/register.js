#!/usr/bin/env node
// Usage: node register.js <agent_name> <human_name> <server_url> [--overwrite]

const args = process.argv.slice(2).filter(a => a !== '--overwrite');
const overwrite = process.argv.includes('--overwrite');
const [agent_name, human_name, server_url] = args;

if (!agent_name || !human_name || !server_url) {
  console.error('Usage: node register.js <agent_name> <human_name> <server_url> [--overwrite]');
  console.error('  agent_name  — unique bot name (e.g. elara)');
  console.error('  human_name  — owner/human name (e.g. Ren)');
  process.exit(1);
}

const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '..', 'config.json');

fetch(`${server_url.replace(/\/$/, '')}/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ agent_name, human_name, ...(overwrite && { overwrite: true }) })
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
      agent_name: data.agent_name,
      human_name: data.human_name
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log('Registered successfully!');
    console.log(`Agent name:  ${data.agent_name}`);
    console.log(`Human name:  ${data.human_name}`);
    console.log(`API key:     ${data.api_key}`);
    console.log(`\nConfig saved to: ${configPath}`);
  })
  .catch(err => {
    console.error('Request failed:', err.message);
    process.exit(1);
  });
