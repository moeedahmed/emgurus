-- Ensure blog_categories has title/description, then seed safely
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_categories' AND column_name='title') THEN
    ALTER TABLE public.blog_categories ADD COLUMN title text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_categories' AND column_name='description') THEN
    ALTER TABLE public.blog_categories ADD COLUMN description text;
  END IF;
END $$;

-- Insert seeds using required columns
INSERT INTO public.blog_categories (name, slug, description)
VALUES
  ('General','general','General updates and broad topics'),
  ('Exam Guidance','exam-guidance','Preparation and strategies for EM exams'),
  ('Clinical Compendium','clinical-compendium','Clinical pearls and case-based learning'),
  ('Research & Evidence','research-evidence','Summaries and discussion of evidence'),
  ('Careers','careers','Training, jobs, and professional growth'),
  ('Announcements','announcements','Platform and community announcements')
ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

-- Backfill title from name
UPDATE public.blog_categories SET title = COALESCE(title, name);

-- Ensure unique index on slug
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_blog_categories_slug') THEN
    CREATE UNIQUE INDEX ux_blog_categories_slug ON public.blog_categories (slug);
  END IF;
END $$;