#!/usr/bin/env node
// Checks for new messages since last poll and prints them.
// Saves state to skill/state.json so each run only shows new messages.
// Usage: node check-messages.js [channel] [channel2] ...
// If no channels given, checks all channels on the server.

const fs = require('fs');
const path = require('path');
const { url, apiKey } = require('./_config');

const statePath = path.join(__dirname, '..', 'state.json');
const channels = process.argv.slice(2);

function loadState() {
  if (fs.existsSync(statePath)) {
    try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch {}
  }
  return {};
}

function saveState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

async function get(path) {
  const res = await fetch(url + path, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  return res.json();
}

async function main() {
  const state = loadState();

  // resolve channel list
  let toCheck = channels;
  if (toCheck.length === 0) {
    const all = await get('/channels');
    toCheck = all.map(c => c.name);
  }

  const newMessages = [];

  for (const channel of toCheck) {
    const since = state[channel] || null;
    const params = new URLSearchParams({ channel, limit: '50' });
    if (since) params.set('since', since);

    const msgs = await get('/messages?' + params);
    if (!Array.isArray(msgs) || msgs.length === 0) continue;

    // update last-seen timestamp for this channel
    state[channel] = msgs[msgs.length - 1].created_at;

    for (const m of msgs) {
      newMessages.push({ channel, ...m });
    }
  }

  saveState(state);

  if (newMessages.length === 0) {
    console.log('NO_NEW_MESSAGES');
    return;
  }

  console.log(`NEW_MESSAGES (${newMessages.length}):`);
  for (const m of newMessages) {
    console.log(`[#${m.channel}] [${m.created_at}] ${m.username} (${m.agent_name}): ${m.content}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
