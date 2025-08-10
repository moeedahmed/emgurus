# QA: Final Sanity Checklist

This checklist helps verify production readiness for EMGurus across Supabase (DB, Edge Functions), RLS, roles, and the frontend.

Sections
- Env & Functions
- CORS & JWT
- Frontend Guards
- RLS & Roles
- Curl Templates (authorized/unauthorized, allowed/disallowed origins)
- SQL Snippets (should pass/fail)
- Troubleshooting

Env & Functions
- Supabase Functions secrets configured (Settings → Configuration → Functions):
  - OPENAI_API_KEY
  - ORIGIN_ALLOWLIST = https://emgurus.com, https://www.emgurus.com, http://localhost:3000
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - (Optional) FIRECRAWL_API_KEY, RESEND_API_KEY, ADMIN_NOTIFICATIONS_EMAIL
- supabase/config.toml:
  - [functions.blogs-api] verify_jwt = true
  - [functions.review-exams-api] verify_jwt = true
  - [functions.ai-route] verify_jwt = true (unless intentionally public)
- Edge Functions deploy status OK in dashboard; logs show no runtime errors on cold start.

CORS & JWT
- ORIGIN_ALLOWLIST is set and includes the production domains:
  - https://emgurus.com
  - https://www.emgurus.com
  - http://localhost:3000 (dev)
- Requests from disallowed origins return 403 with proper CORS headers.
- Missing/invalid Authorization returns 401.

Frontend Guards
- All /dashboard/* routes are wrapped in RoleProtectedRoute.
- Role hook caches roles across routes for at least 60s; repeated navigation does not spam role queries.

RLS & Roles
- Authors cannot read other users’ drafts (blog_posts).
- Non-guru receives 401/403 calling guru endpoints (review-exams-api restricted actions).
- Non-admin cannot publish posts via RPC.

Curl Templates
Replace placeholders before running:
- PROJECT_REF: cgtvvpzrzwyvsbavboxa
- USER_JWT, GURU_JWT, ADMIN_JWT: JWTs from real sessions
- ALLOWED_ORIGIN: https://emgurus.com
- BLOCKED_ORIGIN: https://evil.example

1) ai-route (authorized)
```
curl -i -sS -X POST \
  "https://PROJECT_REF.functions.supabase.co/ai-route" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -d '{"action":"ping"}'
# Expect: 200, response JSON, CORS headers present
```

2) ai-route (missing auth → 401)
```
curl -i -sS -X POST \
  "https://PROJECT_REF.functions.supabase.co/ai-route" \
  -H "Content-Type: application/json" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -d '{"action":"ping"}'
# Expect: 401
```

3) review-exams-api origin blocked → 403
```
curl -i -sS -X POST \
  "https://PROJECT_REF.functions.supabase.co/review-exams-api" \
  -H "Authorization: Bearer $GURU_JWT" \
  -H "Content-Type: application/json" \
  -H "Origin: $BLOCKED_ORIGIN" \
  -d '{"action":"admin_assign","payload":{"question_id":"00000000-0000-0000-0000-000000000000","guru_id":"00000000-0000-0000-0000-000000000000"}}'
# Expect: 403 (disallowed origin)
```

4) review-exams-api allowed origin + USER_JWT (non-guru)
```
curl -i -sS -X POST \
  "https://PROJECT_REF.functions.supabase.co/review-exams-api" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -d '{"action":"guru_feedback","payload":{"assignment_id":"00000000-0000-0000-0000-000000000000","note":"Looks good"}}'
# Expect: 401/403 (role insufficient)
```

5) review-exams-api allowed origin + GURU_JWT
```
curl -i -sS -X POST \
  "https://PROJECT_REF.functions.supabase.co/review-exams-api" \
  -H "Authorization: Bearer $GURU_JWT" \
  -H "Content-Type: application/json" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -d '{"action":"guru_feedback","payload":{"assignment_id":"00000000-0000-0000-0000-000000000000","note":"Approved"}}'
# Expect: 200
```

SQL Snippets (validate RLS — run with a user JWT via client; SQL editor uses service role and bypasses RLS)
-- Author sees only their own drafts (should pass via client with author JWT)
```
select id, title, status from public.blog_posts where status = 'draft';
```
-- Non-author tries to update someone else’s draft (should fail via client)
```
update public.blog_posts set title = title || ' [hack]' where status = 'draft' and author_id <> auth.uid();
```
-- Reviewer/Admin can publish in_review post via RPC (client-only)
```
-- supabase.rpc('review_approve_publish', { p_post_id: '...' })
```

Troubleshooting
- 401 Unauthorized
  - Missing/invalid Authorization header; verify JWT is fresh (observe refresh flow); verify verify_jwt=true for function.
- 403 Forbidden
  - Origin not in ORIGIN_ALLOWLIST; role insufficient; RLS policy denies action; function enforces role checks.
- 500 Internal Error
  - Function exception; open Edge Function logs to inspect stack traces and input payload.
- CORS preflight fails
  - Ensure function returns proper CORS headers and handles OPTIONS.
