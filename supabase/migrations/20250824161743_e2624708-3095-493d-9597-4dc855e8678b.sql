-- Enforce reviewer assignment for ALL blog publishing
-- Update the review_approve_publish function to require assignment verification

CREATE OR REPLACE FUNCTION public.review_approve_publish(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := public._require_auth();
  v_can boolean;
  v_assignment_count integer;
BEGIN
  -- Check if user can approve (admin or assigned reviewer)
  v_can := public.has_role(v_uid,'admin') OR EXISTS (
    SELECT 1 FROM public.blog_review_assignments 
    WHERE post_id = p_post_id AND reviewer_id = v_uid AND status = 'pending'
  );
  
  IF NOT v_can THEN 
    RAISE EXCEPTION 'Forbidden: Only assigned reviewers or admins can approve posts'; 
  END IF;

  -- Verify that a reviewer has been assigned (even for admin-authored posts)
  SELECT COUNT(*) INTO v_assignment_count
  FROM public.blog_review_assignments
  WHERE post_id = p_post_id AND status IN ('pending', 'completed');

  IF v_assignment_count = 0 THEN
    RAISE EXCEPTION 'Cannot publish: A reviewer must be assigned before publishing any blog post';
  END IF;

  -- Check that at least one assignment is completed (approved)
  IF NOT EXISTS (
    SELECT 1 FROM public.blog_review_assignments 
    WHERE post_id = p_post_id AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'Cannot publish: At least one reviewer must approve the post before publishing';
  END IF;

  -- Proceed with publishing
  UPDATE public.blog_posts
    SET status='published', published_at = now(), reviewed_at = now(), 
        reviewed_by = COALESCE(reviewed_by, v_uid)
  WHERE id = p_post_id;

  -- Mark related assignments as completed if not already
  UPDATE public.blog_review_assignments
    SET status = 'completed', updated_at = now()
  WHERE post_id = p_post_id AND status = 'pending';

  -- Log the action
  INSERT INTO public.blog_review_logs(post_id, actor_id, action, note)
  VALUES (p_post_id, v_uid, 'publish', 'Published after review approval');
END
$function$;

-- Add a function to handle review approval notifications
CREATE OR REPLACE FUNCTION public.notify_on_blog_review_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_post_title text;
  v_author_id uuid;
  v_reviewer_name text;
BEGIN
  -- Only trigger on status change to 'completed' (approved)
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
    -- Get post details
    SELECT bp.title, bp.author_id INTO v_post_title, v_author_id
    FROM public.blog_posts bp
    WHERE bp.id = NEW.post_id;

    -- Get reviewer name
    SELECT p.full_name INTO v_reviewer_name
    FROM public.profiles p
    WHERE p.user_id = NEW.reviewer_id;

    -- Notify the author
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_author_id,
      'blog_review_approved',
      'Blog Review Approved',
      format('Your blog "%s" has been approved by %s', 
        COALESCE(v_post_title, 'Unknown'), 
        COALESCE(v_reviewer_name, 'reviewer')),
      jsonb_build_object(
        'post_id', NEW.post_id,
        'reviewer_id', NEW.reviewer_id,
        'assignment_id', NEW.id
      )
    );

    -- Notify admins
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT 
      ur.user_id,
      'blog_review_approved_admin',
      'Blog Review Completed',
      format('Blog "%s" has been approved and is ready for publishing', 
        COALESCE(v_post_title, 'Unknown')),
      jsonb_build_object(
        'post_id', NEW.post_id,
        'reviewer_id', NEW.reviewer_id,
        'assignment_id', NEW.id
      )
    FROM public.user_roles ur
    WHERE ur.role = 'admin';
  END IF;

  RETURN NEW;
END;
$function$;

-- Create the trigger for review approval notifications
DROP TRIGGER IF EXISTS blog_review_approval_notification ON public.blog_review_assignments;
CREATE TRIGGER blog_review_approval_notification
  AFTER UPDATE ON public.blog_review_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_blog_review_approval();