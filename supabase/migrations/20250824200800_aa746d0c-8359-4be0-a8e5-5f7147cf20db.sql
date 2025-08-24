-- Update blog_review_assignments table to support multi-reviewer workflow
ALTER TABLE public.blog_review_assignments ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.blog_review_assignments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Update exam_review_assignments table to support multi-reviewer workflow  
ALTER TABLE public.exam_review_assignments ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.exam_review_assignments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Add audit trail fields to blog_posts
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id);

-- Add audit trail fields to exam_questions  
ALTER TABLE public.exam_questions ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.exam_questions ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id);

-- Update blog review assignment trigger to populate assigned_at
CREATE OR REPLACE FUNCTION public.touch_blog_assignment_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.assigned_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_review_assignments_assigned_at
  BEFORE INSERT ON public.blog_review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_blog_assignment_assigned_at();

-- Update exam review assignment trigger to populate assigned_at
CREATE OR REPLACE FUNCTION public.touch_exam_assignment_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.assigned_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER exam_review_assignments_assigned_at
  BEFORE INSERT ON public.exam_review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_exam_assignment_assigned_at();

-- Update review approval function to require all reviewers to complete
CREATE OR REPLACE FUNCTION public.review_approve_publish_multi(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := public._require_auth();
  v_can boolean;
  v_pending_count integer;
  v_total_count integer;
BEGIN
  -- Check if user can approve (admin or assigned reviewer)
  v_can := public.has_role(v_uid,'admin') OR EXISTS (
    SELECT 1 FROM public.blog_review_assignments 
    WHERE post_id = p_post_id AND reviewer_id = v_uid AND status IN ('pending', 'pending_review')
  );
  
  IF NOT v_can THEN 
    RAISE EXCEPTION 'Forbidden: Only assigned reviewers or admins can approve posts'; 
  END IF;

  -- Check review assignment counts
  SELECT 
    COUNT(*) FILTER (WHERE status IN ('pending', 'pending_review')),
    COUNT(*)
  INTO v_pending_count, v_total_count
  FROM public.blog_review_assignments
  WHERE post_id = p_post_id;

  IF v_total_count = 0 THEN
    RAISE EXCEPTION 'Cannot publish: A reviewer must be assigned before publishing any blog post';
  END IF;

  -- Mark current user's assignment as completed
  UPDATE public.blog_review_assignments
    SET status = 'completed', reviewed_at = now(), updated_at = now()
  WHERE post_id = p_post_id AND reviewer_id = v_uid;

  -- Recheck pending count after update
  SELECT COUNT(*) INTO v_pending_count
  FROM public.blog_review_assignments
  WHERE post_id = p_post_id AND status IN ('pending', 'pending_review');

  -- Only publish if all reviewers have completed
  IF v_pending_count = 0 THEN
    UPDATE public.blog_posts
      SET status='published', published_at = now(), reviewed_at = now(), 
          reviewed_by = COALESCE(reviewed_by, v_uid)
    WHERE id = p_post_id;

    -- Log the action
    INSERT INTO public.blog_review_logs(post_id, actor_id, action, note)
    VALUES (p_post_id, v_uid, 'publish', 'Published after all reviewers approved');
  ELSE
    -- Log partial approval
    INSERT INTO public.blog_review_logs(post_id, actor_id, action, note)
    VALUES (p_post_id, v_uid, 'approve', 'Reviewer approved, waiting for other reviewers');
  END IF;
END
$function$;