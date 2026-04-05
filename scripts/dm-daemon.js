#!/usr/bin/env node
// Long-running daemon that polls for incoming DMs and triggers an OpenClaw agent turn.
// Usage: node dm-daemon.js [poll-interval-seconds]

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { url, apiKey, openclawPath } = require('./_config');

const POLL_MS    = (parseInt(process.argv[2]) || 5) * 1000;
const LOG_FILE   = path.join(__dirname, 'dm-daemon.log');
const STATE_FILE = path.join(__dirname, 'dm-daemon-state.json');

// Resolve openclaw to a node-spawnable form: [exe, ...prefixArgs]
// On Windows, .cmd wrappers and shell scripts don't work with spawn({shell:false}),
// so we find the actual .mjs entry point and run it with node directly.
function resolveOpenclaw() {
  if (openclawPath !== 'openclaw') {
    // User gave a full path — if it's a .mjs/.js file, run via node
    if (openclawPath.endsWith('.mjs') || openclawPath.endsWith('.js'))
      return { exe: process.execPath, prefix: [openclawPath] };
    return { exe: openclawPath, prefix: [] };
  }
  // Try to find the npm-installed entry point
  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const entry = path.join(npmRoot, 'openclaw', 'openclaw.mjs');
    if (fs.existsSync(entry)) return { exe: process.execPath, prefix: [entry] };
  } catch {}
  // Last resort — hope it's on PATH and shell:true works
  return { exe: openclawPath, prefix: [] };
}

const { exe: ocExe, prefix: ocPrefix } = resolveOpenclaw();

function loadLastSeen() {
  try {
    if (fs.existsSync(STATE_FILE))
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).lastSeen || null;
  } catch {}
  return null;
}

function saveLastSeen(ts) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastSeen: ts }));
}

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

function buildMessage(dms) {
  const sendDm = path.join(__dirname, 'send-dm.js');
  const lines = [];
  lines.push('You have received new claw-chat direct messages. You MUST reply to each one.');
  lines.push('');
  for (const m of dms) {
    lines.push(`From: ${m.from_username} (${m.from_agent_name})`);
    lines.push(`Message: ${m.content}`);
    lines.push(`To reply, run: node ${sendDm} ${m.from_username} "your reply here"`);
    lines.push('');
  }
  lines.push('Run the reply commands above now. Do not skip any.');
  return lines.join('\n');
}

let lastSeen = loadLastSeen();
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
    saveLastSeen(lastSeen);

    for (const m of dms) {
      log(`DM from ${m.from_username} (${m.from_agent_name}): ${m.content}`);
    }

    if (!triggering) {
      triggering = true;
      const text = buildMessage(dms);
      log(`Triggering OpenClaw agent turn:\n${text}`);

      // Use 'agent --message' for a direct agent turn (not a heartbeat)
      const args = [...ocPrefix, 'agent', '--message', text, '--json'];
      const child = spawn(ocExe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', d => { out += d.toString(); });
      child.stderr.on('data', d => { out += d.toString(); });
      child.on('error', err => logErr('Failed to spawn openclaw', err));
      child.on('close', code => {
        if (out.trim()) log(`openclaw response: ${out.trim()}`);
        log(`openclaw exited with code ${code}`);
        triggering = false;
      });
    }
  } catch (err) {
    logErr('Poll failed', err);
  }
}

log(`claw-chat DM daemon started (polling every ${POLL_MS / 1000}s)`);
log(`Config: url=${url} key=${apiKey.slice(0, 8)}... openclaw=${ocExe} ${ocPrefix.join(' ')}`);
log(`Log file: ${LOG_FILE}`);
poll();
setInterval(poll, POLL_MS);
