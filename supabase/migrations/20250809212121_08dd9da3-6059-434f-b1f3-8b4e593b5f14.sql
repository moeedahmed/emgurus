-- Add submitted_at to blog_posts if missing and supporting indexes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'blog_posts' AND column_name = 'submitted_at'
  ) THEN
    ALTER TABLE public.blog_posts ADD COLUMN submitted_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- Ensure published_at column exists (safety)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'blog_posts' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE public.blog_posts ADD COLUMN published_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- Ensure reviewed_by column exists (safety)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'blog_posts' AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE public.blog_posts ADD COLUMN reviewed_by uuid NULL;
  END IF;
END $$;

-- Add FK to auth.users for reviewed_by if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'blog_posts' AND c.conname = 'blog_posts_reviewed_by_fkey'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_reviewed_by_fkey FOREIGN KEY (reviewed_by)
      REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON public.blog_posts(published_at DESC);
