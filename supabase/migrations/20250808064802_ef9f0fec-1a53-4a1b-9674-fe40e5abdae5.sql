-- Complete blogs schema upgrade and RLS on blog_posts, categories, tags

-- 1) blog_post_status enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_post_status') THEN
    CREATE TYPE blog_post_status AS ENUM ('draft','in_review','published','archived');
  END IF;
END $$;

-- 2) blog_categories columns and unique
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_categories' AND column_name='title') THEN
    ALTER TABLE public.blog_categories ADD COLUMN title text;
    -- backfill from name if exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_categories' AND column_name='name') THEN
      UPDATE public.blog_categories SET title = COALESCE(title, name);
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_categories' AND column_name='description') THEN
    ALTER TABLE public.blog_categories ADD COLUMN description text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_blog_categories_slug') THEN
    CREATE UNIQUE INDEX ux_blog_categories_slug ON public.blog_categories (slug);
  END IF;
END $$;

-- 3) blog_tags and blog_post_tags
CREATE TABLE IF NOT EXISTS public.blog_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_post_tags (
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_tags' AND policyname='Public can view blog tags') THEN
    CREATE POLICY "Public can view blog tags" ON public.blog_tags FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_tags' AND policyname='Admins manage blog tags') THEN
    CREATE POLICY "Admins manage blog tags" ON public.blog_tags FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_post_tags' AND policyname='Public can view blog_post_tags') THEN
    CREATE POLICY "Public can view blog_post_tags" ON public.blog_post_tags FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_post_tags' AND policyname='Admins manage blog_post_tags') THEN
    CREATE POLICY "Admins manage blog_post_tags" ON public.blog_post_tags FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- 4) blog_posts columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='excerpt') THEN
    ALTER TABLE public.blog_posts ADD COLUMN excerpt text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='content_md') THEN
    ALTER TABLE public.blog_posts ADD COLUMN content_md text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='content_html') THEN
    ALTER TABLE public.blog_posts ADD COLUMN content_html text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='reading_minutes') THEN
    ALTER TABLE public.blog_posts ADD COLUMN reading_minutes integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='reviewer_id') THEN
    ALTER TABLE public.blog_posts ADD COLUMN reviewer_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='is_featured') THEN
    ALTER TABLE public.blog_posts ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='is_editors_pick') THEN
    ALTER TABLE public.blog_posts ADD COLUMN is_editors_pick boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='published_at') THEN
    ALTER TABLE public.blog_posts ADD COLUMN published_at timestamptz;
  END IF;
END $$;

-- Unique on slug
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_blog_posts_slug_unique') THEN
    CREATE UNIQUE INDEX ux_blog_posts_slug_unique ON public.blog_posts (slug);
  END IF;
END $$;

-- 5) Convert status to blog_post_status
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='status') THEN
    -- Convert only if not already of type blog_post_status
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='status' AND udt_name='blog_post_status') THEN
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
    END IF;
  END IF;
END $$;

-- 6) RLS: reset blog_posts policies per new rules
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Drop old policies by name if exist
DROP POLICY IF EXISTS "Admins can delete all posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authors can delete own drafts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authors can update own drafts or submitted" ON public.blog_posts;
DROP POLICY IF EXISTS "Authors can view own posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Gurus and admins can update all posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Gurus and admins can view all posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Public can view published posts" ON public.blog_posts;

-- Create new policies
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

-- 7) Seeds: categories & tags
INSERT INTO public.blog_categories (slug, title, description)
VALUES
  ('general','General','General updates and broad topics'),
  ('exam-guidance','Exam Guidance','Preparation and strategies for EM exams'),
  ('clinical-compendium','Clinical Compendium','Clinical pearls and case-based learning'),
  ('research-evidence','Research & Evidence','Summaries and discussion of evidence'),
  ('careers','Careers','Training, jobs, and professional growth'),
  ('announcements','Announcements','Platform and community announcements')
ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title;

INSERT INTO public.blog_tags (slug, title) VALUES
 ('mrcem','MRCEM'), ('frcem','FRCEM'), ('osce','OSCE'), ('ultrasound','Ultrasound'),
 ('airway','Airway'), ('trauma','Trauma'), ('resus','Resus'), ('ecg','ECG'),
 ('pediatrics','Pediatrics'), ('toxicology','Toxicology'), ('sepsis','Sepsis'), ('procedures','Procedures')
ON CONFLICT (slug) DO NOTHING;