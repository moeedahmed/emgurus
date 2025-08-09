# Deploying AI Guru and RAG

Checklist

1) Set environment variables (Project Settings -> Functions -> Secrets):
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY
- EMBEDDING_MODEL (e.g. text-embedding-3-small)
- EMBEDDING_DIM (e.g. 1536)
- FIRECRAWL_API_KEY (optional)

2) Security & CORS
- supabase/config.toml has [functions.ai-route] verify_jwt = true
- ai-route enforces an Origin allowlist (localhost and *.lovable.app). Add your production origin if different.

3) RAG indexing
- Run seed_ai_embeddings_once to build the index (it paginates >200 docs).
- Optionally schedule refresh_ai_embeddings via pg_cron.

4) Verify quotas
- Ensure your OpenAI and Supabase quotas are sufficient; check logs if you see 429 or timeouts.

5) Smoke tests
- Ask “What’s your name?” (streaming tokens)
- Ask “Give me 2 links about sepsis from EMGurus” (browsing off)
- Toggle browsing on for web-dependent queries
