#!/usr/bin/env bash
# Helper: commands to set Supabase Edge Function secrets (no secrets are stored here)
# Usage: customize <PROJECT_REF>, then run: chmod +x scripts/supabase-set-env.sh && ./scripts/supabase-set-env.sh

PROJECT_REF="<your-project-ref>" # e.g. cgtvvpzrzwyvsbavboxa

cat <<EOF
# OpenAI
supabase functions secrets set OPENAI_API_KEY=sk-... --project-ref $PROJECT_REF
supabase functions secrets set OPENAI_MODEL_CHAT_BASIC=gpt-5.0-nano --project-ref $PROJECT_REF
supabase functions secrets set OPENAI_MODEL_CHAT_EXAM=gpt-5.0-pro --project-ref $PROJECT_REF
supabase functions secrets set OPENAI_MODEL_EXAM=gpt-5.0-pro --project-ref $PROJECT_REF
supabase functions secrets set OPENAI_EMBED_MODEL=text-embedding-3-small --project-ref $PROJECT_REF
supabase functions secrets set OPENAI_EMBED_DIM=1536 --project-ref $PROJECT_REF
supabase functions secrets set OPENAI_CHAT_TIMEOUT_MS=60000 --project-ref $PROJECT_REF
supabase functions secrets set OPENAI_EMBED_TIMEOUT_MS=30000 --project-ref $PROJECT_REF
supabase functions secrets set CHAT_MAX_TOKENS=300 --project-ref $PROJECT_REF
supabase functions secrets set EXAM_MAX_TOKENS=800 --project-ref $PROJECT_REF

# CORS
supabase functions secrets set ORIGIN_ALLOWLIST="https://emgurus.com,https://www.emgurus.com,https://localhost:3000" --project-ref $PROJECT_REF

# Supabase project
supabase functions secrets set SUPABASE_URL=https://<your-ref>.supabase.co --project-ref $PROJECT_REF
supabase functions secrets set SUPABASE_ANON_KEY=eyJ... --project-ref $PROJECT_REF
supabase functions secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ... --project-ref $PROJECT_REF
EOF
