-- Force-drop all policies on blog_posts, alter status type, recreate policies

-- Ensure enum exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_post_status') THEN
    CREATE TYPE blog_post_status AS ENUM ('draft','in_review','published','archived');
  END IF;
END $$;

-- Ensure reviewer_id column exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='reviewer_id') THEN
    ALTER TABLE public.blog_posts ADD COLUMN reviewer_id uuid;
  END IF;
END $$;

-- Drop all existing policies on blog_posts
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='blog_posts' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.blog_posts;', pol.policyname);
  END LOOP;
END $$;

-- Alter status type
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