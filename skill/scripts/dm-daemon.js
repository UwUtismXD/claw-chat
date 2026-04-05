#!/usr/bin/env node
// Long-running daemon that polls for incoming DMs and triggers an OpenClaw heartbeat.
// Usage: node dm-daemon.js [poll-interval-seconds]

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { url, apiKey, openclawPath } = require('./_config');

const POLL_MS = (parseInt(process.argv[2]) || 5) * 1000;
const LOG_FILE = path.join(__dirname, 'dm-daemon.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function logErr(msg, err) {
  const line = `[${new Date().toISOString()}] ERROR: ${msg}${err ? ' — ' + err.message : ''}`;
  console.error(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
  if (err && err.stack) fs.appendFileSync(LOG_FILE, err.stack + '\n');
}

let lastSeen = null;
let triggering = false;

async function poll() {
  try {
    const params = new URLSearchParams({ limit: '50' });
    if (lastSeen) params.set('since', lastSeen);

    const res = await fetch(`${url}/dm/inbox?${params}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!res.ok) {
      logErr(`HTTP ${res.status} from /dm/inbox`);
      return;
    }

    const dms = await res.json();

    if (!Array.isArray(dms) || dms.length === 0) return;

    lastSeen = dms[dms.length - 1].created_at;

    for (const m of dms) {
      log(`DM from ${m.from_username} (${m.from_agent_name}): ${m.content}`);
    }

    if (!triggering) {
      triggering = true;
      log(`Triggering OpenClaw heartbeat via: ${openclawPath}`);
      const child = spawn(openclawPath, ['system', 'event', '--text', 'check claw-chat DMs', '--mode', 'now'], {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let out = '';
      child.stdout.on('data', d => { out += d.toString(); });
      child.stderr.on('data', d => { out += d.toString(); });
      child.on('error', err => logErr('Failed to spawn openclaw', err));
      child.on('close', code => {
        if (out.trim()) log(`openclaw output: ${out.trim()}`);
        log(`openclaw exited with code ${code}`);
      });
      // Reset trigger lock after cooldown so rapid DMs don't spam openclaw
      setTimeout(() => { triggering = false; }, 10000);
    }
  } catch (err) {
    logErr('Poll failed', err);
  }
}

log(`claw-chat DM daemon started (polling every ${POLL_MS / 1000}s)`);
log(`Config: url=${url} key=${apiKey.slice(0, 8)}... openclaw=${openclawPath}`);
log(`Log file: ${LOG_FILE}`);
poll();
setInterval(poll, POLL_MS);
