-- Fix review question status literals from 'in_review' to 'under_review'

-- submit_exam_for_review: set status to under_review
CREATE OR REPLACE FUNCTION public.submit_exam_for_review(p_question_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := public._require_auth(); v_owner uuid; BEGIN
  SELECT created_by INTO v_owner FROM public.review_exam_questions WHERE id = p_question_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Question not found'; END IF;
  IF v_owner <> v_uid THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.review_exam_questions SET status='under_review' WHERE id = p_question_id;
END $function$;

-- exam_approve: move from draft to under_review if needed
CREATE OR REPLACE FUNCTION public.exam_approve(p_question_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := public._require_auth(); v_can boolean; BEGIN
  v_can := public.has_role(v_uid,'admin') OR public.has_role(v_uid,'guru');
  IF NOT v_can THEN RAISE EXCEPTION 'Forbidden'; END IF;
  -- If currently draft, bump to under_review; otherwise keep existing status
  UPDATE public.review_exam_questions SET status=COALESCE(NULLIF(status,'draft'),'under_review') WHERE id = p_question_id;
END $function$;

-- list_exam_reviewer_queue: accept 'under_review' instead of 'in_review'
CREATE OR REPLACE FUNCTION public.list_exam_reviewer_queue(p_limit integer, p_offset integer)
RETURNS SETOF exam_questions
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := public._require_auth(); BEGIN
  RETURN QUERY
  SELECT eq.* FROM public.exam_questions eq
  JOIN public.review_exam_questions q ON q.id = eq.id
  JOIN public.review_assignments a ON a.question_id = q.id
  WHERE a.guru_id = v_uid AND q.status IN ('under_review','draft')
  ORDER BY q.created_at DESC
  LIMIT GREATEST(coalesce(p_limit,20),1) OFFSET GREATEST(coalesce(p_offset,0),0);
END $function$;

-- list_my_exam_submissions: show my questions that are under_review
CREATE OR REPLACE FUNCTION public.list_my_exam_submissions(p_limit integer, p_offset integer)
RETURNS SETOF exam_questions
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := public._require_auth(); BEGIN
  RETURN QUERY
  SELECT * FROM public.exam_questions WHERE created_by = v_uid AND status = 'under_review'
  ORDER BY created_at DESC
  LIMIT GREATEST(coalesce(p_limit,20),1) OFFSET GREATEST(coalesce(p_offset,0),0);
END $function$;