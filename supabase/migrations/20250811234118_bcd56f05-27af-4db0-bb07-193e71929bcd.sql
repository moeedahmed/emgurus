-- Safely extend review_approve_publish to mark assignments completed
CREATE OR REPLACE FUNCTION public.review_approve_publish(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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

  -- Mark related assignments as completed
  UPDATE public.blog_review_assignments
    SET status = 'completed', updated_at = now()
  WHERE post_id = p_post_id;

  INSERT INTO public.blog_review_logs(post_id, actor_id, action, note)
  VALUES (p_post_id, v_uid, 'publish', '');
END
$function$;