# EMGurus – Project Brief

**Goal:** Ship a functional MVP for Emergency Medicine exam prep + mentorship:
- AI practice (generate MCQs + explanations)
- Guru‑reviewed question bank
- Simple mentorship booking (CTA only for now)
- AI “Guru” chat (compact widget, bottom‑right)

---

## Tech Stack (current)
- **Frontend:** Next.js (React, TypeScript), Tailwind, Shadcn
- **Backend/DB:** Supabase (Postgres + RLS, Edge Functions)
- **Vector Search:** `pgvector` with IVF index
- **Deploy/Preview:** Lovable (primary editing) → Vercel (deployment)
- **Search/Embeddings:** OpenAI embeddings via Edge Functions

---

## Environment & Keys
- `OPENAI_API_KEY`: required
- `EMBEDDING_MODEL`: `text-embedding-3-small`
- `EMBEDDING_DIM`: `1536`  
  (Chosen to keep ANN index ≤ 2000 dims on Supabase)
- Supabase project connected; RLS enabled.

---

## Database (public schema)

### Tables
**`gurus`**
- `id` (uuid, pk)
- `name` (text, required)
- `bio` (text)
- `created_at` (timestamptz, default now())

**`reviewed_exam_questions`**
- `id` (uuid, pk)
- `exam` (text) e.g., `MRCEM_Primary`
- `topic` (text)
- `subtopic` (text)
- `stem` (text, required)
- `options` (jsonb) – `[{key:"A", text:"…"}, …]`
- `answer` (text) – e.g., `"B"`
- `explanation` (text)
- `reviewer_id` (uuid, fk → gurus.id, nullable)
- `status` (text) – `"approved" | "pending" | "rejected"`
- `reviewed_at` (timestamptz, nullable)
- `created_at` (timestamptz, default now())

**`ai_content_index`**
- `id` (bigint, pk)
- `doc_id` (text) – source key (e.g., `blog:123`)
- `source_type` (text) – `blog | forum | exam_question`
- `title` (text)
- `slug_url` (text)
- `tags` (text[])
- `text_chunk` (text)
- `embedding` (vector(1536))
- `model` (text)
- `last_embedded_at` (timestamptz)

### Indexes
- `ai_content_index_embedding_ivfflat` on `embedding` (lists=100)

### RLS (summary)
- `reviewed_exam_questions`: `SELECT` allowed where `status = 'approved'`.
- Admins (service role) can full CRUD.

---

## Edge Functions

**`seed_ai_embeddings_once`**
- Pulls published blogs, forum threads, and approved exam questions.
- Chunks text (3000/500 overlap), embeds via OpenAI, upserts into `ai_content_index`.
- Reads `EMBEDDING_MODEL` + `EMBEDDING_DIM`.

**`refresh_ai_embeddings`**
- Same as seed, but idempotent re-embed.

**`admin-generate-questions`** *(guarded; optional)*
- Drafts up to 5 pending MCQs using `gpt-4.1-mini` when `ENABLE_AI_QGEN=true`.
- Admin JWT required.

---

## UI Routes (MVP)
- `/` Landing: tight hero, 2 CTAs — **Start Exam Prep**, **Book a Guru**, and **See Pricing** (anchors to pricing section).
- `/exams`:
  - **AI Practice** → config modal → generate session.
  - **Reviewed Question Bank** → list (filters: exam/topic/subtopic, pagination) → detail page.
- `/forums` (basic)
- `/blogs` (basic)

**AI Chat Widget**
- Floating button bottom-right on all pages (non-blocking).
- Not full-screen on mobile.

---

## Current Issues / Fixes
1) **TypeScript any-casts around `reviewed_exam_questions`**
   - Quick guard used: `(supabase as any)`.  
   - **Action:** Generate fresh Supabase types and replace `any`.
   - Script suggestion:
     ```
     supabase gen types typescript --project-id $SUPABASE_PROJECT_REF --schema public > src/lib/supabase/types.generated.ts
     ```

2) **Reviewed Bank “Browse” runtime error**
   - Likely query/types mismatch or RLS filter.
   - **Action:** Ensure list query filters `status = 'approved'` and columns match UI expectations; log errors to toast; add graceful empty-state.

3) **Embedding model dimension**
   - Keep **1536** for ANN; revisit 3072 later if Supabase increases vector cap.

---

## Seed Data (present)
- 1 demo guru: **Dr Test Guru**
- ~25 approved demo questions (exam=`MRCEM_Primary`)
- Optional AI generator is **disabled** by default.

---

## MVP Acceptance (what “working” means)
- AI Practice: generate session, show MCQs+answers+explanations.
- Reviewed Bank: list loads (filters work), detail shows reviewer name & date.
- AI Chat: opens as compact widget; sends & receives.
- Pricing CTAs: go to pricing anchors or dedicated `/pricing`.
- No uncaught runtime errors on mobile & desktop.

---

## Codex – Quick Commands

> Run these in Codex (connected to this repo). It will open PRs.

1. **Fix reviewed bank crash + empty state**
   - “Find and fix the runtime error when tapping **Browse** on Reviewed Question Bank. Ensure list queries only `status='approved'`, add try/catch with toast, and return an empty-state component. Add a regression test if test setup exists.”

2. **Generate fresh Supabase types & remove `any`**
   - “Add a `gen:types` npm script using Supabase CLI, check in `src/lib/supabase/types.generated.ts`, wire imports, and replace `(supabase as any)` with typed calls.”

3. **AI chat: convert to floating widget**
   - “Refactor the AI Guru chat to a bottom-right floating widget with a small launcher button; avoid full-screen on mobile; keep state across route changes.”

4. **Landing polish**
   - “Tighten hero spacing, center CTAs, make ‘Book a Guru’ and ‘See Pricing’ real buttons, hide fake stats, and link ‘See Pricing’ to the pricing section.”

5. **Seed task**
   - “Add an admin-only button or edge function call to run `seed_ai_embeddings_once` with limit 200; show JSON summary.”

---

## Ownership / Contacts
- Product owner: Moeed (GitHub: `mo