-- Step 4–6 backend: blog review workflow tables, enums, policies

-- 1) Enum for assignment status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_assignment_status') THEN
    CREATE TYPE public.review_assignment_status AS ENUM ('pending','completed','cancelled');
  END IF;
END $$;

-- 2) Review assignments table
CREATE TABLE IF NOT EXISTS public.blog_review_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  assigned_by UUID NOT NULL,
  status public.review_assignment_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_review_assignments ENABLE ROW LEVEL SECURITY;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS set_updated_at_blog_review_assignments ON public.blog_review_assignments;
CREATE TRIGGER set_updated_at_blog_review_assignments
BEFORE UPDATE ON public.blog_review_assignments
FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- Policies for assignments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_review_assignments' AND policyname='Admins manage all assignments'
  ) THEN
    CREATE POLICY "Admins manage all assignments"
    ON public.blog_review_assignments
    FOR ALL
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_review_assignments' AND policyname='Reviewers can view their assignments'
  ) THEN
    CREATE POLICY "Reviewers can view their assignments"
    ON public.blog_review_assignments
    FOR SELECT
    USING (reviewer_id = auth.uid());
  END IF;
END $$;

-- 3) Review logs table
CREATE TABLE IF NOT EXISTS public.blog_review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_review_logs ENABLE ROW LEVEL SECURITY;

-- Policies for logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_review_logs' AND policyname='Admins manage all logs'
  ) THEN
    CREATE POLICY "Admins manage all logs"
    ON public.blog_review_logs
    FOR ALL
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_review_logs' AND policyname='Actors can insert their own logs'
  ) THEN
    CREATE POLICY "Actors can insert their own logs"
    ON public.blog_review_logs
    FOR INSERT
    WITH CHECK (actor_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_review_logs' AND policyname='Gurus can view logs'
  ) THEN
    CREATE POLICY "Gurus can view logs"
    ON public.blog_review_logs
    FOR SELECT
    USING (public.has_role(auth.uid(), 'guru') OR actor_id = auth.uid());
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_blog_review_assignments_post ON public.blog_review_assignments(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_review_assignments_reviewer ON public.blog_review_assignments(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_blog_review_logs_post ON public.blog_review_logs(post_id);

