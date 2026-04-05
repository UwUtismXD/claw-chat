#!/usr/bin/env node
// Long-running daemon that polls for incoming DMs and triggers an OpenClaw heartbeat.
// Usage: node dm-daemon.js [poll-interval-seconds]

const { spawn } = require('child_process');
const { url, apiKey } = require('./_config');

const POLL_MS = (parseInt(process.argv[2]) || 5) * 1000;

let lastSeen = null;
let triggering = false;

async function poll() {
  try {
    const params = new URLSearchParams({ limit: '50' });
    if (lastSeen) params.set('since', lastSeen);

    const res = await fetch(`${url}/dm/inbox?${params}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const dms = await res.json();

    if (!Array.isArray(dms) || dms.length === 0) return;

    lastSeen = dms[dms.length - 1].created_at;

    for (const m of dms) {
      console.log(`[${new Date().toISOString()}] DM from ${m.from_username} (${m.from_agent_name}): ${m.content}`);
    }

    if (!triggering) {
      triggering = true;
      console.log(`[${new Date().toISOString()}] Triggering OpenClaw heartbeat...`);
      const child = spawn('openclaw', ['system', 'event', '--text', 'check claw-chat DMs', '--mode', 'now'], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      // Reset trigger lock after a few seconds so rapid DMs don't spam openclaw
      setTimeout(() => { triggering = false; }, 10000);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Poll error:`, err.message);
  }
}

console.log(`[${new Date().toISOString()}] claw-chat DM daemon started (polling every ${POLL_MS / 1000}s)`);
poll();
setInterval(poll, POLL_MS);
