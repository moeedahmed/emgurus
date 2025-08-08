-- Retry: add reviewer_id, convert status, recreate policies

-- Ensure enum exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_post_status') THEN
    CREATE TYPE blog_post_status AS ENUM ('draft','in_review','published','archived');
  END IF;
END $$;

-- Add reviewer_id if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='reviewer_id') THEN
    ALTER TABLE public.blog_posts ADD COLUMN reviewer_id uuid;
  END IF;
END $$;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public can view published posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authors can view own posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Gurus and admins can view all posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authors can update own drafts or submitted" ON public.blog_posts;
DROP POLICY IF EXISTS "Gurus and admins can update all posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can delete all posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authors can delete own drafts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Public can view published posts (v2)" ON public.blog_posts;
DROP POLICY IF EXISTS "Authors and reviewers can view own posts (v2)" ON public.blog_posts;
DROP POLICY IF EXISTS "Users can create own posts (v2)" ON public.blog_posts;
DROP POLICY IF EXISTS "Authors can update own drafts or in_review (v2)" ON public.blog_posts;
DROP POLICY IF EXISTS "Reviewers/Admins can update posts (v2)" ON public.blog_posts;

-- Convert status type if needed
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='status' AND udt_name='blog_post_status') THEN
      ALTER TABLE public.blog_posts ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE public.blog_posts
      ALTER COLUMN status TYPE blog_post_status
      USING (
        CASE status::text
          WHEN 'submitted' THEN 'in_review'::blog_post_status
          WHEN 'published' THEN 'published'::blog_post_status
          WHEN 'draft' THEN 'draft'::blog_post_status
          WHEN 'in_review' THEN 'in_review'::blog_post_status
          WHEN 'archived' THEN 'archived'::blog_post_status
          ELSE 'draft'::blog_post_status
        END
      );
      ALTER TABLE public.blog_posts ALTER COLUMN status SET DEFAULT 'draft'::blog_post_status;
    END IF;
  END IF;
END $$;

-- Recreate policies
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published posts (v2)" ON public.blog_posts
  FOR SELECT USING (status = 'published'::blog_post_status);

CREATE POLICY "Authors and reviewers can view own posts (v2)" ON public.blog_posts
  FOR SELECT USING (auth.uid() = author_id OR auth.uid() = reviewer_id OR auth.uid() = reviewed_by OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create own posts (v2)" ON public.blog_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own drafts or in_review (v2)" ON public.blog_posts
  FOR UPDATE USING (auth.uid() = author_id AND status IN ('draft','in_review')) WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Reviewers/Admins can update posts (v2)" ON public.blog_posts
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = reviewer_id OR auth.uid() = reviewed_by) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = reviewer_id OR auth.uid() = reviewed_by);