-- Drop all remaining policies that depend on reviewer_id
DROP POLICY IF EXISTS "Authors and reviewers can view own posts (v2)" ON public.blog_posts;
DROP POLICY IF EXISTS "Reviewers/Admins can update posts (v2)" ON public.blog_posts;
DROP POLICY IF EXISTS "Reviewers update in_review posts" ON public.blog_posts;

-- Now drop the reviewer_id column
ALTER TABLE public.blog_posts DROP COLUMN IF EXISTS reviewer_id;