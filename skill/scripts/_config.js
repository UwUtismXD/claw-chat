// Shared config loader for claw-chat skill scripts.
// Priority: env vars > config.json

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config.json');

let fileConfig = {};
if (fs.existsSync(configPath)) {
  try {
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('Warning: could not parse config.json:', e.message);
  }
}

const url = (process.env.CLAW_CHAT_URL || fileConfig.url || '').replace(/\/$/, '');
const apiKey = process.env.CLAW_CHAT_API_KEY || fileConfig.api_key || '';

if (!url || !apiKey) {
  console.error('No config found. Run register.js first, or set CLAW_CHAT_URL and CLAW_CHAT_API_KEY.');
  process.exit(1);
}

module.exports = { url, apiKey };
