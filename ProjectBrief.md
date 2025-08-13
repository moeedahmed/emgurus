# EM Gurus – Project Brief

**Goal:** Ship a functional MVP for Emergency Medicine exam prep + mentorship:
- AI practice (generate MCQs + explanations)
- Guru‑reviewed question bank
- Simple mentorship booking (CTA only for now)
- AI “Guru” chat (compact widget, bottom‑right)

---

## Brand and Roles Standardization
- Brand name: "EM Gurus" (two words) across all UI text and titles. Keep the domain emgurus.com.
- Workspace sections (Blogs, Exams, Forums, Consultations) follow consistent tabs for User/Guru/Admin views:
  - Overview • Drafts • Submitted/Assigned • Approved • Rejected • Marked • Generate/Tools • Settings
- Use WorkspaceLayout sections/tabs to keep structure uniform and discoverable.

---

## Tech Stack (current)

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

## UI/UX Implementation Rules

- Filters pattern
  - Each main page has a Filters control: Sheet on mobile, sticky sidebar on desktop (top: 5rem/20).
  - Search inputs accept continuous typing and do not throttle to 1 char.
  - Chips/tags on cards trigger filters when clicked.
- Sticky page titles
  - Section titles like “Reviewed Question Bank” are sticky below the app header and remain visible while scrolling.
- Memberships
  - All membership CTAs link to /pricing.
  - Pricing page triggers Stripe checkout for Exams, Consultation, Premium.
- Header and profile
  - Show user avatar if available; otherwise initials.
  - Reflect profile name changes live via realtime subscription.
- Blogs
  - Category dropdown shows names only (no counts); show total results separately.
  - Blog cards use moderate image heights and clickable category/tags chips.
- Consultations
  - Guru cards are clickable; their badges set the corresponding filters.
- Auth & Onboarding
  - Remove redundant branding; keep flows minimal.
- Accessibility & Theming
  - Use semantic Tailwind tokens (bg-background, text-foreground, border-border, etc.). No raw colors.
  - Images are lazy-loaded with alt text and appropriate decoding.

---

## Workspace & Chips (design notes)
- Left‑panel workspace
  - Dashboards at `/dashboard/{user|guru|admin}` use a persistent left sidebar with sections (Blogs, Exams, Consultations, Forums…).
  - Each section renders sub‑tabs on the right. Sections are addressable via URL hash (e.g., `#blogs`).
  - Embedded mode: when reusing full pages inside the workspace, pass `embedded` to hide big heroes and tighten padding.
- Chip atom
  - Component: `src/components/ui/chip.tsx`.
  - Props: `{ name, value, selected?, onSelect?, variant?: 'solid'|'outline'|'ghost', size?: 'sm'|'md' }` (+ `as`, `href`, icons).
  - A11y: `role="button"`, `aria-pressed`, Space/Enter toggles, focus-visible ring.
  - Usage now: Blog cards (category/tags, Most Liked) and Reviewed Question Bank (exam/topic/difficulty).
  - Extend gradually; avoid ad‑hoc clickable badges.

---

## MVP Acceptance (what “working” means)
- AI Practice: generate session, show MCQs+answers+explanations.
- Reviewed Bank: list loads (filters work), detail shows reviewer name & date.
- AI Chat: opens as compact widget; sends & receives.
- Pricing CTAs: go to /pricing; Stripe opens in a new tab.
- No uncaught runtime errors on mobile & desktop.

---

## Ownership / Contacts
- Product owner: Moeed (GitHub: `mo`)
