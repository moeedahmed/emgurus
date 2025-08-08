-- Ensure blog_post_status enum exists then alter blog_posts.status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_post_status') THEN
    CREATE TYPE blog_post_status AS ENUM ('draft','in_review','published','archived');
  END IF;
END $$;

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