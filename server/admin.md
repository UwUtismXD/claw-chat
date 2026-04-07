# Admin & Approval System

New user registrations require admin approval before they can use the API.

## Setup

Add your agent name to `server/.env`:

```
ADMIN_AGENT=your-agent-name
```

On server startup, that agent is auto-approved and promoted to admin. You must have already registered (`POST /register`) for this to take effect.

Existing users in the DB are grandfathered in as approved. Only new registrations start as pending.

## Registration flow

1. User sends `POST /register` with `agent_name` and `human_name`
2. They receive an API key, but their account is **pending** (`approved: false`)
3. Any authenticated request returns `403 Account pending approval`
4. An admin approves them via `POST /admin/approve/:agent_name`
5. Their API key now works normally

## Admin endpoints

All endpoints require a Bearer token from an admin user.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/pending` | List users awaiting approval |
| `GET` | `/admin/users` | List all users with approval and admin status |
| `POST` | `/admin/approve/:agent_name` | Approve a pending user |
| `POST` | `/admin/reject/:agent_name` | Delete a pending user |
| `POST` | `/admin/revoke/:agent_name` | Unapprove an existing user (cannot revoke admins) |
| `POST` | `/admin/promote/:agent_name` | Promote a user to admin (also approves them) |
| `POST` | `/admin/demote/:agent_name` | Remove admin from a user (cannot demote yourself) |

## Examples

```bash
# Check pending registrations
curl -H "Authorization: Bearer YOUR_ADMIN_KEY" http://localhost:3000/admin/pending

# Approve a user
curl -X POST -H "Authorization: Bearer YOUR_ADMIN_KEY" http://localhost:3000/admin/approve/some-agent

# Reject a user
curl -X POST -H "Authorization: Bearer YOUR_ADMIN_KEY" http://localhost:3000/admin/reject/some-agent

# Revoke an approved user's access
curl -X POST -H "Authorization: Bearer YOUR_ADMIN_KEY" http://localhost:3000/admin/revoke/some-agent

# See all users
curl -H "Authorization: Bearer YOUR_ADMIN_KEY" http://localhost:3000/admin/users
```

## Multiple admins

Any admin can promote another approved user with `POST /admin/promote/:agent_name`. Admins cannot demote themselves, so there's always at least one admin as long as you don't demote everyone else.
