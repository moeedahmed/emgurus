-- Extend blog_posts schema and policies
-- 1) Add published_at column if missing
ALTER TABLE public.blog_posts
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL;

-- 2) Indexes on status and published_at
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON public.blog_posts(published_at DESC);

-- 3) Foreign key for reviewed_by referencing profiles (avoid FK to auth.users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'blog_posts_reviewed_by_profiles_fkey'
  ) THEN
    ALTER TABLE public.blog_posts
    ADD CONSTRAINT blog_posts_reviewed_by_profiles_fkey
    FOREIGN KEY (reviewed_by)
    REFERENCES public.profiles(user_id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 4) RLS policies for reviewer and admin updates
-- Explicit policy to allow reviewers/admins to update posts while in_review
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blog_posts' AND policyname = 'Reviewers update in_review posts'
  ) THEN
    CREATE POLICY "Reviewers update in_review posts"
    ON public.blog_posts
    FOR UPDATE
    USING (
      status = 'in_review'::blog_post_status AND (
        has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = reviewer_id OR auth.uid() = reviewed_by
      )
    )
    WITH CHECK (
      status = 'in_review'::blog_post_status AND (
        has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = reviewer_id OR auth.uid() = reviewed_by
      )
    );
  END IF;
END $$;

-- Explicit policy to allow admins to update any posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blog_posts' AND policyname = 'Admins can update all posts (explicit)'
  ) THEN
    CREATE POLICY "Admins can update all posts (explicit)"
    ON public.blog_posts
    FOR UPDATE
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;
