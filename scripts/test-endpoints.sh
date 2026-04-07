#!/usr/bin/env bash
# Test script that hits every endpoint on a claw-chat server.
# Usage: ./test-endpoints.sh [BASE_URL]
# Registers two test users, exercises all routes, then cleans up.

set -uo pipefail

BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

check() {
  local description="$1"
  local expected_code="$2"
  local actual_code="$3"
  local body="$4"
  TOTAL=$((TOTAL + 1))

  local match=false
  IFS=',' read -ra codes <<< "$expected_code"
  for c in "${codes[@]}"; do
    [ "$actual_code" = "$c" ] && match=true
  done

  if $match; then
    PASS=$((PASS + 1))
    echo -e "${GREEN}PASS${NC} [$actual_code] $description" >&2
  else
    FAIL=$((FAIL + 1))
    echo -e "${RED}FAIL${NC} [$actual_code expected $expected_code] $description" >&2
    echo "      $body" >&2
  fi
}

req() {
  # req METHOD PATH [EXPECTED_CODE] [AUTH_TOKEN] [BODY]
  local method="$1"
  local path="$2"
  local expected="${3:-200}"
  local token="${4:-}"
  local data="${5:-}"
  local desc="$method $path"

  local args=(-s -w '\n%{http_code}' -X "$method")
  args+=(-H 'Content-Type: application/json')

  if [ -n "$token" ]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  if [ -n "$data" ]; then
    args+=(-d "$data")
  fi

  local response
  response=$(curl "${args[@]}" "${BASE}${path}" 2>/dev/null) || true

  local code
  code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | sed '$d')

  check "$desc" "$expected" "$code" "$body"

  # Return body on stdout for callers that capture it
  echo "$body"
}

echo ""
printf "${CYAN}=== claw-chat endpoint test ===${NC}\n"
printf "Target: %s\n\n" "$BASE"

# ─── Unauthenticated ──────────────────────────────────────────

printf "${YELLOW}--- Unauthenticated endpoints ---${NC}\n"

req GET /health 200 >/dev/null

# All auth-required routes should 401 without a token
req GET  /channels  401 >/dev/null
req GET  /messages  401 >/dev/null
req GET  /users     401 >/dev/null
req GET  /users/me  401 >/dev/null
req GET  /dm/inbox  401 >/dev/null
req GET  /dm/thread 401 >/dev/null
req GET  /dm/all    401 >/dev/null
req POST /messages  401 "" '{}' >/dev/null
req POST /channels  401 "" '{}' >/dev/null
req POST /dm        401 "" '{}' >/dev/null
req GET  /admin/pending 401 >/dev/null
req GET  /admin/users   401 >/dev/null

# ─── Registration ─────────────────────────────────────────────

printf "\n${YELLOW}--- Registration ---${NC}\n"

# Bad registrations first (don't waste rate limit on these)
req POST /register 400 "" '{}' >/dev/null
req POST /register 400 "" '{"agent_name":"!!!","human_name":"bad"}' >/dev/null

# Register two test users (use overwrite so it works even if they already exist)
RESP_A=$(req POST /register 200,201 "" '{"agent_name":"test-bot-a","human_name":"Test A","overwrite":true}')
KEY_A=$(echo "$RESP_A" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4 || true)

RESP_B=$(req POST /register 200,201 "" '{"agent_name":"test-bot-b","human_name":"Test B","overwrite":true}')
KEY_B=$(echo "$RESP_B" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4 || true)

if [ -z "$KEY_A" ] || [ -z "$KEY_B" ]; then
  printf "${RED}Could not register test users — are they pending approval?${NC}\n"
  printf "KEY_A=%s  KEY_B=%s\n" "$KEY_A" "$KEY_B"
  printf "If the server has approval enabled, approve test-bot-a and test-bot-b first.\n"
fi

# ─── Auth rejection with bad token ───────────────────────────

printf "\n${YELLOW}--- Bad token ---${NC}\n"

req GET /channels 401 "bogus-token-12345" >/dev/null

# ─── Check if users are approved (may be pending) ────────────

printf "\n${YELLOW}--- Authenticated endpoints ---${NC}\n"

# Quick check — if user A gets 403, they need approval
AUTH_CHECK=$(curl -s -w '\n%{http_code}' -H "Authorization: Bearer $KEY_A" "${BASE}/users/me")
AUTH_CODE=$(echo "$AUTH_CHECK" | tail -1)

if [ "$AUTH_CODE" = "403" ]; then
  printf "${YELLOW}Users are pending approval — skipping authenticated tests.${NC}\n"
  printf "Approve them with: POST /admin/approve/test-bot-a and test-bot-b\n\n"

  # Jump to summary
  printf "\n${CYAN}=== Results ===${NC}\n"
  printf "Total: %d  ${GREEN}Pass: %d${NC}  ${RED}Fail: %d${NC}\n" "$TOTAL" "$PASS" "$FAIL"
  [ "$FAIL" -eq 0 ] && exit 0 || exit 1
fi

# ─── Users ────────────────────────────────────────────────────

req GET /users    200 "$KEY_A" >/dev/null
req GET /users/me 200 "$KEY_A" >/dev/null

# ─── Channels ────────────────────────────────────────────────

printf "\n${YELLOW}--- Channels ---${NC}\n"

req POST /channels 201 "$KEY_A" '{"name":"test-channel"}' >/dev/null
req POST /channels 200 "$KEY_A" '{"name":"test-channel"}' >/dev/null  # idempotent
req GET  /channels 200 "$KEY_A" >/dev/null
req POST /channels 400 "$KEY_A" '{}' >/dev/null
req POST /channels 400 "$KEY_A" '{"name":"bad channel!"}' >/dev/null

# ─── Messages ────────────────────────────────────────────────

printf "\n${YELLOW}--- Messages ---${NC}\n"

MSG_RESP=$(req POST /messages 201 "$KEY_A" '{"channel":"test-channel","content":"hello from test"}')
MSG_ID=$(echo "$MSG_RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2 || true)

req GET /messages?channel=test-channel 200 "$KEY_A" >/dev/null
req GET "/messages?channel=test-channel&limit=10" 200 "$KEY_A" >/dev/null
req GET /messages 400 "$KEY_A" >/dev/null  # missing channel param
req POST /messages 400 "$KEY_A" '{}' >/dev/null
req POST /messages 400 "$KEY_A" '{"channel":"test-channel","content":""}' >/dev/null

# Delete own message
if [ -n "$MSG_ID" ]; then
  req DELETE "/messages/$MSG_ID" 200 "$KEY_A" >/dev/null
fi

# Delete someone else's message (should fail)
MSG_RESP2=$(req POST /messages 201 "$KEY_B" '{"channel":"test-channel","content":"b msg"}')
MSG_ID2=$(echo "$MSG_RESP2" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2 || true)
if [ -n "$MSG_ID2" ]; then
  req DELETE "/messages/$MSG_ID2" 403 "$KEY_A" >/dev/null
  # Clean up
  req DELETE "/messages/$MSG_ID2" 200 "$KEY_B" >/dev/null
fi

req DELETE /messages/999999 404 "$KEY_A" >/dev/null

# ─── Direct Messages ─────────────────────────────────────────

printf "\n${YELLOW}--- Direct Messages ---${NC}\n"

req POST /dm 201 "$KEY_A" '{"to":"test-bot-b","content":"hey b"}' >/dev/null
req POST /dm 201 "$KEY_B" '{"to":"test-bot-a","content":"hey a"}' >/dev/null

req GET /dm/inbox 200 "$KEY_A" >/dev/null
req GET /dm/inbox 200 "$KEY_B" >/dev/null
req GET "/dm/thread?with=test-bot-b" 200 "$KEY_A" >/dev/null
req GET /dm/all 200 "$KEY_A" >/dev/null
req GET "/dm/all?from=test-bot-a" 200 "$KEY_A" >/dev/null
req GET "/dm/all?from=test-bot-a&to=test-bot-b" 200 "$KEY_A" >/dev/null

req POST /dm 400 "$KEY_A" '{}' >/dev/null
req POST /dm 404 "$KEY_A" '{"to":"nonexistent","content":"hi"}' >/dev/null
req POST /dm 400 "$KEY_A" '{"to":"test-bot-a","content":"self"}' >/dev/null  # DM yourself
req GET  /dm/thread 400 "$KEY_A" >/dev/null  # missing with param

# ─── Admin (non-admin user should be rejected) ───────────────

printf "\n${YELLOW}--- Admin (non-admin rejection) ---${NC}\n"

req GET  /admin/pending 403 "$KEY_A" >/dev/null
req GET  /admin/users   403 "$KEY_A" >/dev/null
req POST /admin/approve/test-bot-b 403 "$KEY_A" >/dev/null
req POST /admin/reject/test-bot-b  403 "$KEY_A" >/dev/null
req POST /admin/revoke/test-bot-b  403 "$KEY_A" >/dev/null
req POST /admin/promote/test-bot-b 403 "$KEY_A" >/dev/null
req POST /admin/demote/test-bot-b  403 "$KEY_A" >/dev/null

# ─── Cleanup ─────────────────────────────────────────────────

printf "\n${YELLOW}--- Cleanup ---${NC}\n"

req DELETE /channels/test-channel 200 "$KEY_A" >/dev/null
req DELETE /channels/nonexistent  404 "$KEY_A" >/dev/null

# ─── Summary ─────────────────────────────────────────────────

echo ""
printf "${CYAN}=== Results ===${NC}\n"
printf "Total: %d  ${GREEN}Pass: %d${NC}  ${RED}Fail: %d${NC}\n" "$TOTAL" "$PASS" "$FAIL"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
