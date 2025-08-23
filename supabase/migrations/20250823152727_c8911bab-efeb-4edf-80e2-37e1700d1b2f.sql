-- Create database function to update assign_reviewer RPC
CREATE OR REPLACE FUNCTION public.assign_reviewer(p_post_id uuid, p_reviewer_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := public._require_auth(); v_is_admin boolean; BEGIN
  v_is_admin := public.has_role(v_uid, 'admin');
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Forbidden'; END IF;
  
  -- Insert into blog_review_assignments instead of updating blog_posts.reviewer_id
  INSERT INTO public.blog_review_assignments(post_id, reviewer_id, assigned_by, notes)
  VALUES (p_post_id, p_reviewer_id, v_uid, p_note);
  
  INSERT INTO public.blog_review_logs(post_id, actor_id, action, note) 
  VALUES (p_post_id, v_uid, 'assign', coalesce(p_note,''));
END $$;

-- Update RLS policies to reference blog_review_assignments
DROP POLICY IF EXISTS "Authors and reviewers can view own posts (v2)" ON public.blog_posts;
DROP POLICY IF EXISTS "Reviewers update in_review posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Reviewers/Admins can update posts (v2)" ON public.blog_posts;

CREATE POLICY "Authors and assigned reviewers can view own posts" ON public.blog_posts
FOR SELECT USING (
  (auth.uid() = author_id) OR 
  (auth.uid() = reviewed_by) OR 
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.blog_review_assignments 
    WHERE post_id = blog_posts.id 
    AND reviewer_id = auth.uid() 
    AND status = 'pending'
  )
);

CREATE POLICY "Assigned reviewers update in_review posts" ON public.blog_posts
FOR UPDATE USING (
  (status = 'in_review'::blog_post_status) AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (auth.uid() = reviewed_by) OR
    EXISTS (
      SELECT 1 FROM public.blog_review_assignments 
      WHERE post_id = blog_posts.id 
      AND reviewer_id = auth.uid() 
      AND status = 'pending'
    )
  )
)
WITH CHECK (
  (status = 'in_review'::blog_post_status) AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (auth.uid() = reviewed_by) OR
    EXISTS (
      SELECT 1 FROM public.blog_review_assignments 
      WHERE post_id = blog_posts.id 
      AND reviewer_id = auth.uid() 
      AND status = 'pending'
    )
  )
);

CREATE POLICY "Assigned reviewers/Admins can update posts" ON public.blog_posts
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (auth.uid() = reviewed_by) OR
  EXISTS (
    SELECT 1 FROM public.blog_review_assignments 
    WHERE post_id = blog_posts.id 
    AND reviewer_id = auth.uid() 
    AND status = 'pending'
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (auth.uid() = reviewed_by) OR
  EXISTS (
    SELECT 1 FROM public.blog_review_assignments 
    WHERE post_id = blog_posts.id 
    AND reviewer_id = auth.uid() 
    AND status = 'pending'
  )
);

-- Drop reviewer_id column from blog_posts
ALTER TABLE public.blog_posts DROP COLUMN IF EXISTS reviewer_id;