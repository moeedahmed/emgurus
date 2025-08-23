-- Tighten RLS for blog_posts.is_featured - only admins can modify

-- Drop existing policies that may allow non-admins to update is_featured
DROP POLICY IF EXISTS "Authors can update own drafts or in_review (v2)" ON public.blog_posts;

-- Recreate the author update policy but exclude is_featured
CREATE POLICY "Authors can update own drafts or in_review (v3)"
ON public.blog_posts
FOR UPDATE
TO authenticated
USING (
  auth.uid() = author_id 
  AND status = ANY(ARRAY['draft'::blog_post_status, 'in_review'::blog_post_status])
)
WITH CHECK (
  auth.uid() = author_id 
  AND status = ANY(ARRAY['draft'::blog_post_status, 'in_review'::blog_post_status])
  -- Authors cannot modify is_featured - it remains unchanged or is set to false
  AND (
    OLD.is_featured = NEW.is_featured 
    OR (OLD.is_featured = true AND NEW.is_featured = false)
    OR NEW.is_featured = false
  )
);

-- Add specific policy for admins to manage is_featured
CREATE POLICY "Admins can manage featured status"
ON public.blog_posts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Ensure the existing admin policy remains for full admin access
-- (This should already exist from previous migration)