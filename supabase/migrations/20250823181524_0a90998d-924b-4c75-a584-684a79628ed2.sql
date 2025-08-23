-- Tighten RLS for blog_posts.is_featured - only admins can modify

-- Drop existing policies that may allow non-admins to update is_featured
DROP POLICY IF EXISTS "Authors can update own drafts or in_review (v2)" ON public.blog_posts;

-- Recreate the author update policy - simplified approach
CREATE POLICY "Authors can update own drafts or in_review (v3)"
ON public.blog_posts
FOR UPDATE
TO authenticated
USING (
  auth.uid() = author_id 
  AND status = ANY(ARRAY['draft'::blog_post_status, 'in_review'::blog_post_status])
  AND NOT has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() = author_id 
  AND status = ANY(ARRAY['draft'::blog_post_status, 'in_review'::blog_post_status])
  AND NOT has_role(auth.uid(), 'admin'::app_role)
  -- Authors cannot modify is_featured - set to false for safety
  AND is_featured = false
);

-- Ensure the existing admin policy handles all admin updates including is_featured
-- (This should already exist but let's make sure)
CREATE POLICY "Admins can update all posts with featured control" 
ON public.blog_posts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));