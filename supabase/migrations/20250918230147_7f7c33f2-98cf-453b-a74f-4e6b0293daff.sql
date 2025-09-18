-- Fix remaining function search_path security warnings

-- Fix all remaining functions that don't have proper search_path set
CREATE OR REPLACE FUNCTION public.trg_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_update_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_user_exam_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_blog_assignment_assigned_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.assigned_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_exam_assignment_assigned_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.assigned_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_guru_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT NEW.user_id, 'guru'::public.app_role
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'guru'::public.app_role
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_blog_review_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.validate_forum_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF char_length(coalesce(NEW.title, '')) < 5 THEN 
    RAISE EXCEPTION 'Thread title must be at least 5 characters'; 
  END IF;
  IF char_length(coalesce(NEW.content, '')) < 10 THEN 
    RAISE EXCEPTION 'Thread content must be at least 10 characters'; 
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_forum_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF char_length(coalesce(NEW.content, '')) < 10 THEN 
    RAISE EXCEPTION 'Reply content must be at least 10 characters'; 
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_thread_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.forum_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._log_flag_to_discussion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.exam_question_discussions(question_id, author_id, message, kind)
  VALUES (NEW.question_id, NEW.flagged_by, coalesce(NEW.comment,'(no comment)'), 'feedback');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._notify_admins_on_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_rec RECORD;
BEGIN
  FOR admin_rec IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      admin_rec.user_id,
      'question_flagged',
      'Question flagged for review',
      coalesce(NEW.comment,'(no comment)'),
      jsonb_build_object('flag_id', NEW.id, 'question_id', NEW.question_id, 'source', NEW.question_source)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._notify_on_flag_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.assigned_to,
      'flag_assigned',
      'New question assigned for review',
      coalesce(NEW.comment,'(no comment)'),
      jsonb_build_object('flag_id', NEW.id, 'question_id', NEW.question_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._notify_on_flag_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_rec RECORD;
  msg text;
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status IN ('resolved','removed','archived') THEN
    msg := coalesce(NEW.resolution_note,'');
    -- Notify original flagger
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.flagged_by,
      'flag_resolved',
      'Your flagged question was processed',
      msg,
      jsonb_build_object('flag_id', NEW.id, 'question_id', NEW.question_id, 'status', NEW.status)
    );
    -- Notify admins
    FOR admin_rec IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        admin_rec.user_id,
        'flag_resolved',
        'Flag processed',
        msg,
        jsonb_build_object('flag_id', NEW.id, 'question_id', NEW.question_id, 'status', NEW.status)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;