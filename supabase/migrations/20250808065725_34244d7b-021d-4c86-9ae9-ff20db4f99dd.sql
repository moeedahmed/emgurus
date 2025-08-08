-- Ensure extra columns, categories fields, tags tables, and seeds

-- blog_posts extra columns
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

-- unique slug index
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_blog_posts_slug_unique') THEN
    CREATE UNIQUE INDEX ux_blog_posts_slug_unique ON public.blog_posts (slug);
  END IF;
END $$;

-- blog_categories fields and unique
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_categories' AND column_name='title') THEN
    ALTER TABLE public.blog_categories ADD COLUMN title text;
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

-- blog_tags & blog_post_tags
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

-- Seeds
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