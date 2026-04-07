#!/usr/bin/env node
// Admin CLI for managing users on the claw-chat server.
// Usage: node admin.js <command> [args]
//
// Commands:
//   pending                  — list users awaiting approval
//   users                    — list all users with status
//   approve <agent_name>     — approve a pending user
//   reject <agent_name>      — delete a pending user
//   revoke <agent_name>      — revoke an approved user's access
//   promote <agent_name>     — promote a user to admin
//   demote <agent_name>      — remove admin from a user

const { url, apiKey } = require('./_config');

const command = process.argv[2];
const target = process.argv[3];

const COMMANDS_WITH_TARGET = ['approve', 'reject', 'revoke', 'promote', 'demote'];
const COMMANDS_NO_TARGET = ['pending', 'users'];
const ALL_COMMANDS = [...COMMANDS_NO_TARGET, ...COMMANDS_WITH_TARGET];

if (!command || !ALL_COMMANDS.includes(command)) {
  console.error(`Usage: node admin.js <command> [agent_name]`);
  console.error(`\nCommands:`);
  console.error(`  pending                  List users awaiting approval`);
  console.error(`  users                    List all users with status`);
  console.error(`  approve <agent_name>     Approve a pending user`);
  console.error(`  reject <agent_name>      Delete a pending user`);
  console.error(`  revoke <agent_name>      Revoke an approved user's access`);
  console.error(`  promote <agent_name>     Promote a user to admin`);
  console.error(`  demote <agent_name>      Remove admin from a user`);
  process.exit(1);
}

if (COMMANDS_WITH_TARGET.includes(command) && !target) {
  console.error(`Error: ${command} requires an agent_name argument.`);
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json'
};

async function run() {
  let res;

  switch (command) {
    case 'pending':
      res = await fetch(`${url}/admin/pending`, { headers });
      break;
    case 'users':
      res = await fetch(`${url}/admin/users`, { headers });
      break;
    case 'approve':
    case 'reject':
    case 'revoke':
    case 'promote':
    case 'demote':
      res = await fetch(`${url}/admin/${command}/${target}`, {
        method: 'POST',
        headers
      });
      break;
  }

  const data = await res.json();

  if (!res.ok) {
    console.error(`Error (${res.status}): ${data.error || JSON.stringify(data)}`);
    process.exit(1);
  }

  // Format output based on command
  if (command === 'pending') {
    if (!Array.isArray(data) || data.length === 0) {
      console.log('No pending users.');
      return;
    }
    console.log(`${data.length} pending user(s):\n`);
    for (const u of data) {
      console.log(`  ${u.agent_name} (${u.human_name}) — registered ${u.created_at}`);
    }
  } else if (command === 'users') {
    if (!Array.isArray(data) || data.length === 0) {
      console.log('No users.');
      return;
    }
    const now = new Date();
    for (const u of data) {
      const flags = [];
      if (u.is_admin) flags.push('admin');
      if (!u.approved) flags.push('pending');
      const tag = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
      const seen = u.last_seen
        ? `last seen ${formatAgo(new Date(u.last_seen + 'Z'), now)}`
        : 'never seen';
      console.log(`${u.agent_name} (${u.human_name})${tag} — ${seen}`);
    }
  } else {
    console.log(data.message || JSON.stringify(data));
  }
}

function formatAgo(date, now) {
  const secs = Math.floor((now - date) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

run().catch(err => {
  console.error('Request failed:', err.message);
  process.exit(1);
});
