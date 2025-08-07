-- Create enums for blog post status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_status') THEN
    CREATE TYPE public.post_status AS ENUM ('draft','submitted','approved','rejected','published');
  END IF;
END $$;

-- Categories table
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blog posts table
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  content TEXT,
  cover_image_url TEXT,
  category_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  tags TEXT[],
  status public.post_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Policies for categories
CREATE POLICY IF NOT EXISTS "Public can view categories"
ON public.blog_categories FOR SELECT
USING (true);

CREATE POLICY IF NOT EXISTS "Admins manage categories"
ON public.blog_categories FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policies for posts
CREATE POLICY IF NOT EXISTS "Public can view published posts"
ON public.blog_posts FOR SELECT
USING (status = 'published');

CREATE POLICY IF NOT EXISTS "Authors can view own posts"
ON public.blog_posts FOR SELECT
USING (author_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Gurus and admins can view all posts"
ON public.blog_posts FOR SELECT
USING (public.has_role(auth.uid(), 'guru') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY IF NOT EXISTS "Authenticated users can create posts"
ON public.blog_posts FOR INSERT
WITH CHECK (author_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Authors can update own drafts or submitted"
ON public.blog_posts FOR UPDATE
USING (author_id = auth.uid() AND status IN ('draft','submitted'))
WITH CHECK (author_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Gurus and admins can update all posts"
ON public.blog_posts FOR UPDATE
USING (public.has_role(auth.uid(), 'guru') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'guru') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY IF NOT EXISTS "Authors can delete own drafts"
ON public.blog_posts FOR DELETE
USING (author_id = auth.uid() AND status = 'draft');

CREATE POLICY IF NOT EXISTS "Admins can delete all posts"
ON public.blog_posts FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS update_blog_categories_updated_at ON public.blog_categories;
CREATE TRIGGER update_blog_categories_updated_at
BEFORE UPDATE ON public.blog_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER update_blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_created_at ON public.blog_posts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts (category_id);
