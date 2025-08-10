#!/usr/bin/env bash
set -euo pipefail

# Fill these before running
PROJECT_REF="xxxxxxxxxxxxxxxxxxxx"
USER_JWT="eyJhbGciOi...user"
GURU_JWT="eyJhbGciOi...guru"
ADMIN_JWT="eyJhbGciOi...admin"
ALLOWED_ORIGIN="https://emgurus.com"
BLOCKED_ORIGIN="https://evil.example"

BASE_FN_URL="https://${PROJECT_REF}.functions.supabase.co"

pass() { echo -e "PASS: $1"; }
fail() { echo -e "FAIL: $1"; }

expect_code() {
  local code="$1" expected="$2"; shift 2
  local name="$*"
  if [[ "$code" == "$expected" ]]; then pass "$name ($code)"; else fail "$name (got $code, expected $expected)"; fi
}

# 1) ai-route with USER_JWT (expect 200); print x-model-used header if present
code=$(curl -s -o /tmp/ai_headers -w "%{http_code}" -X POST \
  "$BASE_FN_URL/ai-route" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -d '{"action":"ping"}') || code=000
expect_code "$code" 200 "ai-route authorized"
if [[ -f /tmp/ai_headers ]]; then grep -i "^x-model-used:" /tmp/ai_headers || true; fi

# 2) ai-route without Authorization (expect 401)
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$BASE_FN_URL/ai-route" \
  -H "Content-Type: application/json" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -d '{"action":"ping"}') || code=000
expect_code "$code" 401 "ai-route missing auth"

# 3) review-exams-api with blocked Origin (expect 403)
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$BASE_FN_URL/review-exams-api" \
  -H "Authorization: Bearer $GURU_JWT" \
  -H "Content-Type: application/json" \
  -H "Origin: $BLOCKED_ORIGIN" \
  -d '{"action":"admin_assign","payload":{"question_id":"00000000-0000-0000-0000-000000000000","guru_id":"00000000-0000-0000-0000-000000000000"}}') || code=000
expect_code "$code" 403 "review-exams-api blocked origin"

# 4) review-exams-api with allowed Origin + USER_JWT (expect 401/403)
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$BASE_FN_URL/review-exams-api" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -d '{"action":"guru_feedback","payload":{"assignment_id":"00000000-0000-0000-0000-000000000000","note":"Looks good"}}') || code=000
if [[ "$code" == "401" || "$code" == "403" ]]; then pass "review-exams-api user role restricted ($code)"; else fail "review-exams-api user role expected 401/403, got $code"; fi

# 5) review-exams-api with allowed Origin + GURU_JWT (expect 200)
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$BASE_FN_URL/review-exams-api" \
  -H "Authorization: Bearer $GURU_JWT" \
  -H "Content-Type: application/json" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -d '{"action":"guru_feedback","payload":{"assignment_id":"00000000-0000-0000-0000-000000000000","note":"Approved"}}') || code=000
expect_code "$code" 200 "review-exams-api guru allowed"

echo "Done."
