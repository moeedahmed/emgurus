-- Blog engagement schema: view and like support
-- 1) Add persistent counters to blog_posts
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

-- 2) Create per-user likes table (prevents duplicate likes)
CREATE TABLE IF NOT EXISTS public.blog_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

-- Enable RLS and secure access
ALTER TABLE public.blog_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own likes" ON public.blog_likes;
CREATE POLICY "Users can view own likes"
ON public.blog_likes
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can like posts" ON public.blog_likes;
CREATE POLICY "Users can like posts"
ON public.blog_likes
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can unlike posts" ON public.blog_likes;
CREATE POLICY "Users can unlike posts"
ON public.blog_likes
FOR DELETE
USING (user_id = auth.uid());