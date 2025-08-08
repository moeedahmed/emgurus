-- BLOGS BACKEND REFACTOR MIGRATION
-- 1) Types/Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_post_status') THEN
    CREATE TYPE blog_post_status AS ENUM ('draft','in_review','published','archived');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_reaction_type') THEN
    CREATE TYPE blog_reaction_type AS ENUM ('like','love','insightful','curious','thumbs_up','thumbs_down');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_comment_reaction_type') THEN
    CREATE TYPE blog_comment_reaction_type AS ENUM ('like','thumbs_up','thumbs_down');
  END IF;
END $$;

-- 2) Tables: Categories & Tags
-- Ensure required columns and constraints on blog_categories
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='blog_categories' AND column_name='title') THEN
    ALTER TABLE public.blog_categories ADD COLUMN title text;
    -- Backfill from existing name column if present
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='blog_categories' AND column_name='name') THEN
      UPDATE public.blog_categories SET title = COALESCE(title, name);
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='blog_categories' AND column_name='description') THEN
    ALTER TABLE public.blog_categories ADD COLUMN description text;
  END IF;
END $$;

-- Unique index on slug
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_blog_categories_slug') THEN
    CREATE UNIQUE INDEX ux_blog_categories_slug ON public.blog_categories (slug);
  END IF;
END $$;

-- Blog tags
CREATE TABLE IF NOT EXISTS public.blog_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- junction table
CREATE TABLE IF NOT EXISTS public.blog_post_tags (
  post_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  CONSTRAINT fk_bpt_post FOREIGN KEY (post_id) REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_bpt_tag FOREIGN KEY (tag_id) REFERENCES public.blog_tags(id) ON DELETE CASCADE
);

-- 3) Extend blog_posts schema
-- Add new columns if missing
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

-- Ensure unique index on slug (nullable slugs allowed but uniqueness when present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_blog_posts_slug_unique') THEN
    CREATE UNIQUE INDEX ux_blog_posts_slug_unique ON public.blog_posts (slug);
  END IF;
END $$;

-- Migrate status enum to blog_post_status
DO $$ BEGIN
  -- Only attempt if column exists and is not already the desired type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='blog_posts' AND column_name='status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='blog_posts' AND column_name='status' AND udt_name='blog_post_status') THEN
      -- Convert enum type using CASE mapping from any existing enum/text
      ALTER TABLE public.blog_posts
      ALTER COLUMN status TYPE blog_post_status
      USING (
        CASE 
          WHEN status::text = 'submitted' THEN 'in_review'::blog_post_status
          WHEN status::text = 'published' THEN 'published'::blog_post_status
          WHEN status::text = 'draft' THEN 'draft'::blog_post_status
          WHEN status::text = 'in_review' THEN 'in_review'::blog_post_status
          WHEN status::text = 'archived' THEN 'archived'::blog_post_status
          ELSE 'draft'::blog_post_status
        END
      );
    END IF;
  END IF;
END $$;

-- 4) Comments & Reactions & Summaries tables
CREATE TABLE IF NOT EXISTS public.blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  parent_id uuid NULL REFERENCES public.blog_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_reactions (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reaction blog_reaction_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, reaction)
);

CREATE TABLE IF NOT EXISTS public.blog_comment_reactions (
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reaction blog_comment_reaction_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id, reaction)
);

CREATE TABLE IF NOT EXISTS public.blog_ai_summaries (
  post_id uuid PRIMARY KEY REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'openai',
  model text,
  summary_md text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5) RLS policies
-- Enable RLS on new tables
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_ai_summaries ENABLE ROW LEVEL SECURITY;

-- Blog tags/posts-tags: public readable, admin manage
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

-- Reset blog_posts policies to align with new rules
DO $$ BEGIN
  -- Drop existing policies if they exist
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_posts';
  IF FOUND THEN
    -- Drop by names known from previous schema if present
    FOR policyname IN 
      SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='blog_posts'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.blog_posts;', policyname);
    END LOOP;
  END IF;
END $$;

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Select policy: anyone can read published; authors and assigned reviewers can read
CREATE POLICY "Public can view published posts (v2)" ON public.blog_posts
  FOR SELECT USING (status = 'published'::blog_post_status);

CREATE POLICY "Authors and reviewers can view own posts (v2)" ON public.blog_posts
  FOR SELECT USING (auth.uid() = author_id OR auth.uid() = reviewer_id OR has_role(auth.uid(), 'admin'::app_role));

-- Insert: authenticated users, force author_id = auth.uid()
CREATE POLICY "Users can create own posts (v2)" ON public.blog_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Update: author when draft/in_review; reviewer/admin any
CREATE POLICY "Authors can update own drafts or in_review (v2)" ON public.blog_posts
  FOR UPDATE USING (auth.uid() = author_id AND status IN ('draft','in_review')) WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Reviewers/Admins can update posts (v2)" ON public.blog_posts
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = reviewer_id) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = reviewer_id);

-- Comments policies
CREATE POLICY IF NOT EXISTS "Public can read blog comments" ON public.blog_comments FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Users insert own comments" ON public.blog_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY IF NOT EXISTS "Users update own comments" ON public.blog_comments FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY IF NOT EXISTS "Users/Admins delete own or admin" ON public.blog_comments FOR DELETE USING (auth.uid() = author_id OR has_role(auth.uid(), 'admin'::app_role));

-- Reactions policies
CREATE POLICY IF NOT EXISTS "Public can read blog reactions" ON public.blog_reactions FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Users add own reactions" ON public.blog_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users remove own reactions" ON public.blog_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Public can read blog comment reactions" ON public.blog_comment_reactions FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Users add own comment reactions" ON public.blog_comment_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users remove own comment reactions" ON public.blog_comment_reactions FOR DELETE USING (auth.uid() = user_id);

-- AI summaries policies
CREATE POLICY IF NOT EXISTS "Public can read AI summaries" ON public.blog_ai_summaries FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Reviewer/Admin can write AI summaries" ON public.blog_ai_summaries
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_ai_summaries.post_id AND p.reviewer_id = auth.uid())
  );
CREATE POLICY IF NOT EXISTS "Reviewer/Admin can update AI summaries" ON public.blog_ai_summaries
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_ai_summaries.post_id AND p.reviewer_id = auth.uid())
  ) WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_ai_summaries.post_id AND p.reviewer_id = auth.uid())
  );

-- 6) Triggers for updated_at on blog_posts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_blog_posts_updated_at') THEN
    CREATE TRIGGER trg_blog_posts_updated_at
    BEFORE UPDATE ON public.blog_posts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 7) Seed data for categories and tags
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
 ('mrcem','MRCEM'),
 ('frcem','FRCEM'),
 ('osce','OSCE'),
 ('ultrasound','Ultrasound'),
 ('airway','Airway'),
 ('trauma','Trauma'),
 ('resus','Resus'),
 ('ecg','ECG'),
 ('pediatrics','Pediatrics'),
 ('toxicology','Toxicology'),
 ('sepsis','Sepsis'),
 ('procedures','Procedures')
ON CONFLICT (slug) DO NOTHING;

-- Optional: seed a few demo posts if none exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.blog_posts WHERE status = 'published') THEN
    -- pick any existing user as author
    WITH any_user AS (
      SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL LIMIT 1
    )
    INSERT INTO public.blog_posts (title, slug, excerpt, cover_image_url, content_md, content_html, reading_minutes, status, author_id, published_at, view_count, likes_count, is_featured, is_editors_pick)
    SELECT 
      'Managing Sepsis in the ED: A Practical Guide', 'managing-sepsis-in-the-ed-a-practical-guide', 'Sample article for preview of EMGurus blog layout.', NULL,
      '# Sepsis in the ED\nPractical guide...', '<h1>Sepsis in the ED</h1><p>Practical guide...</p>', 4, 'published', user_id, now(), 0, 0, false, false
    FROM any_user
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;