-- Migration: feat/schema-align-and-rpcs
-- 1) Create/align exam_type_enum and migrate columns

-- Create enum if not exists
DO $$ BEGIN
  PERFORM 1 FROM pg_type WHERE typname = 'exam_type_enum';
  IF NOT FOUND THEN
    CREATE TYPE public.exam_type_enum AS ENUM ('MRCEM_PRIMARY','MRCEM_SBA','FRCEM_SBA','OTHER');
  END IF;
END $$;

-- Helper: ensure all expected labels exist (idempotent adds)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'exam_type_enum' AND e.enumlabel = 'MRCEM_PRIMARY'
  ) THEN ALTER TYPE public.exam_type_enum ADD VALUE 'MRCEM_PRIMARY'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'exam_type_enum' AND e.enumlabel = 'MRCEM_SBA'
  ) THEN ALTER TYPE public.exam_type_enum ADD VALUE 'MRCEM_SBA'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'exam_type_enum' AND e.enumlabel = 'FRCEM_SBA'
  ) THEN ALTER TYPE public.exam_type_enum ADD VALUE 'FRCEM_SBA'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'exam_type_enum' AND e.enumlabel = 'OTHER'
  ) THEN ALTER TYPE public.exam_type_enum ADD VALUE 'OTHER'; END IF;
END $$;

-- Function to map legacy text/enum to new exam_type_enum
CREATE OR REPLACE FUNCTION public._map_exam_type_to_enum(_val text)
RETURNS public.exam_type_enum
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF _val IS NULL THEN RETURN 'OTHER'; END IF;
  CASE lower(_val)
    WHEN 'rcem_primary', 'mrcem_primary' THEN RETURN 'MRCEM_PRIMARY';
    WHEN 'mrcem', 'mrcem_sba', 'sba' THEN RETURN 'MRCEM_SBA';
    WHEN 'fellowship', 'frcem', 'frcem_sba' THEN RETURN 'FRCEM_SBA';
    ELSE RETURN 'OTHER';
  END CASE;
END; $$;

-- List of candidate tables and columns to migrate to exam_type_enum
-- 1) review_exam_questions.exam_type
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'review_exam_questions' AND column_name = 'exam_type'
  ) THEN
    -- Only migrate if current type is not already exam_type_enum
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      JOIN pg_type t ON t.oid = (SELECT atttypid FROM pg_attribute a 
                                  WHERE a.attrelid = (quote_ident(c.table_schema)||'.'||quote_ident(c.table_name))::regclass
                                    AND a.attname = c.column_name AND a.attnum > 0 AND NOT a.attisdropped
                                  LIMIT 1)
      WHERE c.table_schema='public' AND c.table_name='review_exam_questions' AND c.column_name='exam_type'
        AND t.typname <> 'exam_type_enum'
    ) THEN
      ALTER TABLE public.review_exam_questions ADD COLUMN exam_type_new public.exam_type_enum;
      UPDATE public.review_exam_questions SET exam_type_new = public._map_exam_type_to_enum(exam_type::text);
      ALTER TABLE public.review_exam_questions DROP COLUMN exam_type;
      ALTER TABLE public.review_exam_questions RENAME COLUMN exam_type_new TO exam_type;
    END IF;
  END IF;
END $$;

-- 2) reviewed_exam_questions.exam_type (if present)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'reviewed_exam_questions' AND column_name = 'exam_type'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      JOIN pg_type t ON t.oid = (SELECT atttypid FROM pg_attribute a 
                                  WHERE a.attrelid = (quote_ident(c.table_schema)||'.'||quote_ident(c.table_name))::regclass
                                    AND a.attname = c.column_name AND a.attnum > 0 AND NOT a.attisdropped
                                  LIMIT 1)
      WHERE c.table_schema='public' AND c.table_name='reviewed_exam_questions' AND c.column_name='exam_type'
        AND t.typname <> 'exam_type_enum'
    ) THEN
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN exam_type_new public.exam_type_enum;
      UPDATE public.reviewed_exam_questions SET exam_type_new = public._map_exam_type_to_enum(exam_type::text);
      ALTER TABLE public.reviewed_exam_questions DROP COLUMN exam_type;
      ALTER TABLE public.reviewed_exam_questions RENAME COLUMN exam_type_new TO exam_type;
    END IF;
  END IF;
END $$;

-- 3) ai_exam_sessions.exam_type
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'ai_exam_sessions' AND column_name = 'exam_type'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      JOIN pg_type t ON t.oid = (SELECT atttypid FROM pg_attribute a 
                                  WHERE a.attrelid = (quote_ident(c.table_schema)||'.'||quote_ident(c.table_name))::regclass
                                    AND a.attname = c.column_name AND a.attnum > 0 AND NOT a.attisdropped
                                  LIMIT 1)
      WHERE c.table_schema='public' AND c.table_name='ai_exam_sessions' AND c.column_name='exam_type'
        AND t.typname <> 'exam_type_enum'
    ) THEN
      ALTER TABLE public.ai_exam_sessions ADD COLUMN exam_type_new public.exam_type_enum;
      UPDATE public.ai_exam_sessions SET exam_type_new = public._map_exam_type_to_enum(exam_type::text);
      ALTER TABLE public.ai_exam_sessions DROP COLUMN exam_type;
      ALTER TABLE public.ai_exam_sessions RENAME COLUMN exam_type_new TO exam_type;
    END IF;
  END IF;
END $$;

-- 4) curriculum_map.exam_type
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'curriculum_map' AND column_name = 'exam_type'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      JOIN pg_type t ON t.oid = (SELECT atttypid FROM pg_attribute a 
                                  WHERE a.attrelid = (quote_ident(c.table_schema)||'.'||quote_ident(c.table_name))::regclass
                                    AND a.attname = c.column_name AND a.attnum > 0 AND NOT a.attisdropped
                                  LIMIT 1)
      WHERE c.table_schema='public' AND c.table_name='curriculum_map' AND c.column_name='exam_type'
        AND t.typname <> 'exam_type_enum'
    ) THEN
      ALTER TABLE public.curriculum_map ADD COLUMN exam_type_new public.exam_type_enum;
      UPDATE public.curriculum_map SET exam_type_new = public._map_exam_type_to_enum(exam_type::text);
      ALTER TABLE public.curriculum_map DROP COLUMN exam_type;
      ALTER TABLE public.curriculum_map RENAME COLUMN exam_type_new TO exam_type;
    END IF;
  END IF;
END $$;

-- 2) Standardize blog_categories: title is canonical; backfill from name if necessary
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='blog_categories'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_categories' AND column_name='title'
    ) THEN
      ALTER TABLE public.blog_categories ADD COLUMN title text;
    END IF;
    -- Backfill title from name when title is null and name exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_categories' AND column_name='name'
    ) THEN
      UPDATE public.blog_categories SET title = COALESCE(title, name) WHERE title IS NULL;
      COMMENT ON COLUMN public.blog_categories.name IS 'DEPRECATED: use title';
    END IF;
  END IF;
END $$;

-- 3) RPC stubs (server-side only)
-- Grant execution to authenticated users to validate permissions

-- BLOG RPCs
CREATE OR REPLACE FUNCTION public.create_blog_draft(
  p_title text,
  p_content_md text,
  p_category_id uuid,
  p_tags text[]
) RETURNS public.blog_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_row public.blog_posts;
BEGIN
  RAISE NOTICE 'create_blog_draft stub called';
  RAISE EXCEPTION 'Not implemented';
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_blog_for_review(
  p_post_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RAISE NOTICE 'submit_blog_for_review stub called';
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.assign_reviewer(
  p_post_id uuid,
  p_reviewer_id uuid,
  p_note text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RAISE NOTICE 'assign_reviewer stub called';
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.review_request_changes(
  p_post_id uuid,
  p_note text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RAISE NOTICE 'review_request_changes stub called';
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.review_approve_publish(
  p_post_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RAISE NOTICE 'review_approve_publish stub called';
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.list_my_drafts(
  p_limit int,
  p_offset int
) RETURNS SETOF public.blog_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RAISE NOTICE 'list_my_drafts stub called';
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.list_my_submissions(
  p_limit int,
  p_offset int
) RETURNS SETOF public.blog_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RAISE NOTICE 'list_my_submissions stub called';
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.list_reviewer_queue(
  p_limit int,
  p_offset int
) RETURNS SETOF public.blog_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RAISE NOTICE 'list_reviewer_queue stub called';
  RETURN;
END; $$;

-- EXAM RPCs (stubs)
-- For return types, use review_exam_questions where available
-- Create a compatibility view if not present to satisfy return type exam_questions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='exam_questions'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='review_exam_questions'
    ) THEN
      CREATE OR REPLACE VIEW public.exam_questions AS
      SELECT 
        id,
        question AS stem,
        options AS choices,
        NULL::int AS correct_index,
        explanation,
        ARRAY[]::text[] AS tags,
        exam_type,
        COALESCE(status::text, 'draft') AS status,
        created_by,
        created_at,
        updated_at
      FROM public.review_exam_questions;
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_exam_draft(
  p_stem text,
  p_choices jsonb,
  p_correct_index int,
  p_explanation text,
  p_tags text[],
  p_exam_type public.exam_type_enum
) RETURNS SETOF public.exam_questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RAISE NOTICE 'create_exam_draft stub called';
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_exam_for_review(p_question_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
BEGIN
  RAISE NOTICE 'submit_exam_for_review stub called';
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.exam_request_changes(p_question_id uuid, p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
BEGIN
  RAISE NOTICE 'exam_request_changes stub called';
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.exam_approve(p_question_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
BEGIN
  RAISE NOTICE 'exam_approve stub called';
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.exam_publish(p_question_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
BEGIN
  RAISE NOTICE 'exam_publish stub called';
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.list_exam_reviewer_queue(p_limit int, p_offset int) RETURNS SETOF public.exam_questions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
BEGIN
  RAISE NOTICE 'list_exam_reviewer_queue stub called';
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.list_my_exam_drafts(p_limit int, p_offset int) RETURNS SETOF public.exam_questions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
BEGIN
  RAISE NOTICE 'list_my_exam_drafts stub called';
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.list_my_exam_submissions(p_limit int, p_offset int) RETURNS SETOF public.exam_questions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
BEGIN
  RAISE NOTICE 'list_my_exam_submissions stub called';
  RETURN;
END; $$;

-- 4) RLS: Outline + create only if table currently has no policies
-- blog_posts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='blog_posts') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_posts') THEN
      ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Public can view published posts (v3)" ON public.blog_posts FOR SELECT USING (status = 'published'::blog_post_status);
      CREATE POLICY "Authors can insert own posts (v3)" ON public.blog_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
      CREATE POLICY "Authors can update own drafts (v3)" ON public.blog_posts FOR UPDATE USING (auth.uid() = author_id AND status IN ('draft','in_review')) WITH CHECK (auth.uid() = author_id);
      CREATE POLICY "Reviewers/Admin select assigned (v3)" ON public.blog_posts FOR SELECT USING ((auth.uid() = reviewer_id) OR (auth.uid() = reviewed_by) OR has_role(auth.uid(), 'admin'::app_role));
    END IF;
  END IF;
END $$;

-- blog_review_assignments
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='blog_review_assignments') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_review_assignments') THEN
      ALTER TABLE public.blog_review_assignments ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Reviewers can view their assignments (v2)" ON public.blog_review_assignments FOR SELECT USING (reviewer_id = auth.uid());
      CREATE POLICY "Admins manage all assignments (v2)" ON public.blog_review_assignments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    END IF;
  END IF;
END $$;

-- blog_review_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='blog_review_logs') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_review_logs') THEN
      ALTER TABLE public.blog_review_logs ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Actors insert own logs (v2)" ON public.blog_review_logs FOR INSERT WITH CHECK (actor_id = auth.uid());
      CREATE POLICY "Admins manage all logs (v2)" ON public.blog_review_logs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
      CREATE POLICY "Gurus can view logs (v2)" ON public.blog_review_logs FOR SELECT USING (has_role(auth.uid(), 'guru'::app_role) OR actor_id = auth.uid());
    END IF;
  END IF;
END $$;

-- review_exam_questions (mirror policies, if table exists and has none)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='review_exam_questions') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='review_exam_questions') THEN
      ALTER TABLE public.review_exam_questions ENABLE ROW LEVEL SECURITY;
      -- Authors can insert/select/update own drafts
      CREATE POLICY "Authors manage own exam drafts (v1)" ON public.review_exam_questions FOR ALL
      USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
      -- Gurus/Admins can select for review
      CREATE POLICY "Gurus/Admins view for review (v1)" ON public.review_exam_questions FOR SELECT
      USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role));
    END IF;
  END IF;
END $$;

-- reviewed_exam_questions public select (if exists and no policies)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='reviewed_exam_questions') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reviewed_exam_questions') THEN
      ALTER TABLE public.reviewed_exam_questions ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Public can read reviewed exam questions (v1)" ON public.reviewed_exam_questions FOR SELECT USING (true);
      CREATE POLICY "Admins manage reviewed exam questions (v1)" ON public.reviewed_exam_questions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    END IF;
  END IF;
END $$;

-- Grants for RPCs to authenticated role
DO $$ BEGIN
  PERFORM 1; -- no-op container
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_blog_draft(text, text, uuid, text[]) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.submit_blog_for_review(uuid) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.assign_reviewer(uuid, uuid, text) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.review_request_changes(uuid, text) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.review_approve_publish(uuid) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.list_my_drafts(int, int) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.list_my_submissions(int, int) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.list_reviewer_queue(int, int) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_exam_draft(text, jsonb, int, text, text[], public.exam_type_enum) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.submit_exam_for_review(uuid) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.exam_request_changes(uuid, text) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.exam_approve(uuid) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.exam_publish(uuid) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.list_exam_reviewer_queue(int, int) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.list_my_exam_drafts(int, int) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.list_my_exam_submissions(int, int) TO authenticated';
END $$;

-- Post-check helpers (can be run manually after migration)
-- SELECT enum values
-- SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname='exam_type_enum' ORDER BY e.enumsortorder;
-- Check policies existence
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename IN ('blog_posts','blog_review_assignments','blog_review_logs','review_exam_questions','reviewed_exam_questions') ORDER BY tablename, policyname;
