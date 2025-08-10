-- Migration: implement RPC logic for blogs & exams

-- Helpers
CREATE OR REPLACE FUNCTION public._require_auth() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE v_uid uuid; BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '28000'; END IF;
  RETURN v_uid;
END $$;

-- BLOGS
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
  v_uid uuid := public._require_auth();
  v_base text := lower(regexp_replace(coalesce(trim(p_title), ''), '[^a-z0-9\s-]', '', 'g'));
  v_slug text := regexp_replace(regexp_replace(v_base, '\\s+', '-', 'g'), '-+', '-', 'g');
  v_try int := 0;
  v_post public.blog_posts;
BEGIN
  IF length(coalesce(p_title,'')) < 3 THEN RAISE EXCEPTION 'Title too short'; END IF;

  -- ensure unique slug
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.blog_posts WHERE slug = v_slug);
    v_try := v_try + 1;
    v_slug := regexp_replace(v_base, '\\s+', '-', 'g') || '-' || v_try::text;
  END LOOP;

  INSERT INTO public.blog_posts (title, slug, content, description, category_id, author_id, status)
  VALUES (p_title, v_slug, p_content_md, NULL, p_category_id, v_uid, 'draft')
  RETURNING * INTO v_post;

  -- Tag links: only link existing tag slugs
  IF p_tags IS NOT NULL AND array_length(p_tags,1) > 0 THEN
    INSERT INTO public.blog_post_tags(post_id, tag_id)
    SELECT v_post.id, t.id FROM public.blog_tags t WHERE t.slug = ANY(p_tags);
  END IF;

  RETURN v_post;
END $$;

CREATE OR REPLACE FUNCTION public.submit_blog_for_review(
  p_post_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE v_uid uuid := public._require_auth(); v_author uuid; v_status text; BEGIN
  SELECT author_id, status INTO v_author, v_status FROM public.blog_posts WHERE id = p_post_id;
  IF v_author IS NULL THEN RAISE EXCEPTION 'Post not found'; END IF;
  IF v_author <> v_uid THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_status <> 'draft' THEN RAISE EXCEPTION 'Only drafts can be submitted'; END IF;
  UPDATE public.blog_posts SET status='in_review', submitted_at = now() WHERE id = p_post_id;
END $$;

CREATE OR REPLACE FUNCTION public.assign_reviewer(
  p_post_id uuid,
  p_reviewer_id uuid,
  p_note text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE v_uid uuid := public._require_auth(); v_is_admin boolean; BEGIN
  v_is_admin := public.has_role(v_uid, 'admin');
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO public.blog_review_assignments(post_id, reviewer_id, assigned_by, notes)
  VALUES (p_post_id, p_reviewer_id, v_uid, p_note);
  UPDATE public.blog_posts SET reviewer_id = p_reviewer_id WHERE id = p_post_id;
  INSERT INTO public.blog_review_logs(post_id, actor_id, action, note) VALUES (p_post_id, v_uid, 'assign', coalesce(p_note,''));
END $$;

CREATE OR REPLACE FUNCTION public.review_request_changes(
  p_post_id uuid,
  p_note text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_uid uuid := public._require_auth();
  v_can boolean;
BEGIN
  v_can := public.has_role(v_uid,'admin') OR public.has_role(v_uid,'guru') OR EXISTS (
    SELECT 1 FROM public.blog_posts WHERE id=p_post_id AND (reviewer_id = v_uid OR reviewed_by = v_uid)
  );
  IF NOT v_can THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.blog_posts
    SET status='draft', review_notes = trim(both from coalesce(review_notes,'') || CASE WHEN p_note IS NOT NULL AND p_note<>'' THEN '\n' || p_note ELSE '' END)
  WHERE id = p_post_id;
  INSERT INTO public.blog_review_logs(post_id, actor_id, action, note) VALUES (p_post_id, v_uid, 'request_changes', coalesce(p_note,''));
END $$;

CREATE OR REPLACE FUNCTION public.review_approve_publish(
  p_post_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_uid uuid := public._require_auth();
  v_can boolean;
BEGIN
  v_can := public.has_role(v_uid,'admin') OR EXISTS (
    SELECT 1 FROM public.blog_posts WHERE id=p_post_id AND (reviewer_id = v_uid OR reviewed_by = v_uid)
  );
  IF NOT v_can THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.blog_posts
    SET status='published', published_at = now(), reviewed_at = now(), reviewed_by = COALESCE(reviewed_by, reviewer_id, v_uid)
  WHERE id = p_post_id;
  INSERT INTO public.blog_review_logs(post_id, actor_id, action, note) VALUES (p_post_id, v_uid, 'publish', '');
END $$;

CREATE OR REPLACE FUNCTION public.list_my_drafts(
  p_limit int,
  p_offset int
) RETURNS SETOF public.blog_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE v_uid uuid := public._require_auth(); BEGIN
  RETURN QUERY
  SELECT * FROM public.blog_posts
  WHERE author_id = v_uid AND status = 'draft'
  ORDER BY created_at DESC
  LIMIT GREATEST(coalesce(p_limit,20),1) OFFSET GREATEST(coalesce(p_offset,0),0);
END $$;

CREATE OR REPLACE FUNCTION public.list_my_submissions(
  p_limit int,
  p_offset int
) RETURNS SETOF public.blog_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE v_uid uuid := public._require_auth(); BEGIN
  RETURN QUERY
  SELECT * FROM public.blog_posts
  WHERE author_id = v_uid AND status = 'in_review'
  ORDER BY submitted_at DESC NULLS LAST
  LIMIT GREATEST(coalesce(p_limit,20),1) OFFSET GREATEST(coalesce(p_offset,0),0);
END $$;

CREATE OR REPLACE FUNCTION public.list_reviewer_queue(
  p_limit int,
  p_offset int
) RETURNS SETOF public.blog_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE v_uid uuid := public._require_auth(); BEGIN
  RETURN QUERY
  SELECT * FROM public.blog_posts
  WHERE status='in_review' AND (reviewer_id = v_uid OR reviewed_by = v_uid OR public.has_role(v_uid,'admin'))
  ORDER BY submitted_at DESC NULLS LAST
  LIMIT GREATEST(coalesce(p_limit,20),1) OFFSET GREATEST(coalesce(p_offset,0),0);
END $$;

-- EXAMS
-- Ensure "exam_questions" compatibility view exists (created earlier if needed)

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
DECLARE
  v_uid uuid := public._require_auth();
  v_correct text;
  v_id uuid;
BEGIN
  IF p_stem IS NULL OR length(trim(p_stem)) < 5 THEN RAISE EXCEPTION 'Question too short'; END IF;
  IF jsonb_typeof(p_choices) <> 'array' THEN RAISE EXCEPTION 'choices must be a JSON array'; END IF;
  IF p_correct_index IS NOT NULL AND p_correct_index >= 0 THEN
    v_correct := (SELECT value #>> '{}' FROM jsonb_array_elements(p_choices) WITH ORDINALITY e(value, idx) WHERE (idx-1) = p_correct_index LIMIT 1);
  END IF;
  INSERT INTO public.review_exam_questions(question, options, correct_answer, explanation, exam_type, created_by, status)
  VALUES (p_stem, p_choices, coalesce(v_correct,''), p_explanation, p_exam_type, v_uid, 'draft')
  RETURNING id INTO v_id;

  RETURN QUERY SELECT * FROM public.exam_questions WHERE id = v_id;
END $$;

CREATE OR REPLACE FUNCTION public.submit_exam_for_review(p_question_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE v_uid uuid := public._require_auth(); v_owner uuid; BEGIN
  SELECT created_by INTO v_owner FROM public.review_exam_questions WHERE id = p_question_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Question not found'; END IF;
  IF v_owner <> v_uid THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.review_exam_questions SET status='in_review' WHERE id = p_question_id;
END $$;

CREATE OR REPLACE FUNCTION public.exam_request_changes(p_question_id uuid, p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE v_uid uuid := public._require_auth(); v_can boolean; BEGIN
  v_can := public.has_role(v_uid,'admin') OR public.has_role(v_uid,'guru');
  IF NOT v_can THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.review_exam_questions SET status='draft' WHERE id = p_question_id;
  -- Optional: could log to review_feedback table
END $$;

CREATE OR REPLACE FUNCTION public.exam_approve(p_question_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE v_uid uuid := public._require_auth(); v_can boolean; BEGIN
  v_can := public.has_role(v_uid,'admin') OR public.has_role(v_uid,'guru');
  IF NOT v_can THEN RAISE EXCEPTION 'Forbidden'; END IF;
  -- Mark as in_review (approval stage placeholder)
  UPDATE public.review_exam_questions SET status=COALESCE(NULLIF(status,'draft'),'in_review') WHERE id = p_question_id;
END $$;

CREATE OR REPLACE FUNCTION public.exam_publish(p_question_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE v_uid uuid := public._require_auth(); v_is_admin boolean; BEGIN
  v_is_admin := public.has_role(v_uid,'admin');
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.review_exam_questions SET status='published' WHERE id = p_question_id;
  INSERT INTO public.review_publish_log(question_id, published_by) VALUES (p_question_id, v_uid);
END $$;

CREATE OR REPLACE FUNCTION public.list_exam_reviewer_queue(p_limit int, p_offset int) RETURNS SETOF public.exam_questions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE v_uid uuid := public._require_auth(); BEGIN
  RETURN QUERY
  SELECT eq.* FROM public.exam_questions eq
  JOIN public.review_exam_questions q ON q.id = eq.id
  JOIN public.review_assignments a ON a.question_id = q.id
  WHERE a.guru_id = v_uid AND q.status IN ('in_review','draft')
  ORDER BY q.created_at DESC
  LIMIT GREATEST(coalesce(p_limit,20),1) OFFSET GREATEST(coalesce(p_offset,0),0);
END $$;

CREATE OR REPLACE FUNCTION public.list_my_exam_drafts(p_limit int, p_offset int) RETURNS SETOF public.exam_questions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE v_uid uuid := public._require_auth(); BEGIN
  RETURN QUERY
  SELECT * FROM public.exam_questions WHERE created_by = v_uid AND status = 'draft'
  ORDER BY created_at DESC
  LIMIT GREATEST(coalesce(p_limit,20),1) OFFSET GREATEST(coalesce(p_offset,0),0);
END $$;

CREATE OR REPLACE FUNCTION public.list_my_exam_submissions(p_limit int, p_offset int) RETURNS SETOF public.exam_questions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE v_uid uuid := public._require_auth(); BEGIN
  RETURN QUERY
  SELECT * FROM public.exam_questions WHERE created_by = v_uid AND status = 'in_review'
  ORDER BY created_at DESC
  LIMIT GREATEST(coalesce(p_limit,20),1) OFFSET GREATEST(coalesce(p_offset,0),0);
END $$;

-- Re-grant executes (idempotent)
DO $$ BEGIN
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