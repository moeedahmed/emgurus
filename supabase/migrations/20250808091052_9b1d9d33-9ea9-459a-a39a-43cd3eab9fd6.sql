-- Create a unified taxonomy system usable across Blogs, Exams, Consultations, and Forums

-- 1) Enum for taxonomy kinds
DO $$ BEGIN
  CREATE TYPE public.taxonomy_type AS ENUM ('specialty','category','topic','exam','forum');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Taxonomy terms table
CREATE TABLE IF NOT EXISTS public.taxonomy_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  kind public.taxonomy_type NOT NULL,
  description text,
  parent_id uuid NULL REFERENCES public.taxonomy_terms(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.taxonomy_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view taxonomy terms" ON public.taxonomy_terms;
CREATE POLICY "Public can view taxonomy terms"
ON public.taxonomy_terms
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins manage taxonomy terms" ON public.taxonomy_terms;
CREATE POLICY "Admins manage taxonomy terms"
ON public.taxonomy_terms
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_update_taxonomy_terms_updated_at ON public.taxonomy_terms;
CREATE TRIGGER trg_update_taxonomy_terms_updated_at
BEFORE UPDATE ON public.taxonomy_terms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Mapping tables per content type
-- 3a) Blog posts ↔ taxonomy terms
CREATE TABLE IF NOT EXISTS public.taxonomy_post_terms (
  post_id uuid NOT NULL,
  term_id uuid NOT NULL REFERENCES public.taxonomy_terms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, term_id),
  CONSTRAINT fk_tpt_post FOREIGN KEY (post_id) REFERENCES public.blog_posts(id) ON DELETE CASCADE
);

ALTER TABLE public.taxonomy_post_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read post taxonomy" ON public.taxonomy_post_terms;
CREATE POLICY "Public read post taxonomy"
ON public.taxonomy_post_terms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authors/Reviewers/Admin manage post taxonomy" ON public.taxonomy_post_terms;
CREATE POLICY "Authors/Reviewers/Admin manage post taxonomy"
ON public.taxonomy_post_terms FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.blog_posts p
  WHERE p.id = taxonomy_post_terms.post_id
  AND (
    p.author_id = auth.uid()
    OR p.reviewer_id = auth.uid()
    OR p.reviewed_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
));

DROP POLICY IF EXISTS "Authors/Reviewers/Admin can delete post taxonomy" ON public.taxonomy_post_terms;
CREATE POLICY "Authors/Reviewers/Admin can delete post taxonomy"
ON public.taxonomy_post_terms FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.blog_posts p
  WHERE p.id = taxonomy_post_terms.post_id
  AND (
    p.author_id = auth.uid()
    OR p.reviewer_id = auth.uid()
    OR p.reviewed_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
));

-- 3b) Questions ↔ taxonomy terms
CREATE TABLE IF NOT EXISTS public.taxonomy_question_terms (
  question_id uuid NOT NULL,
  term_id uuid NOT NULL REFERENCES public.taxonomy_terms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, term_id),
  CONSTRAINT fk_tqt_question FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE
);

ALTER TABLE public.taxonomy_question_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read question taxonomy" ON public.taxonomy_question_terms;
CREATE POLICY "Public read question taxonomy"
ON public.taxonomy_question_terms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Creators/Reviewers/Admin manage question taxonomy" ON public.taxonomy_question_terms;
CREATE POLICY "Creators/Reviewers/Admin manage question taxonomy"
ON public.taxonomy_question_terms FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.questions q
  WHERE q.id = taxonomy_question_terms.question_id
  AND (
    q.created_by = auth.uid()
    OR q.reviewed_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
));

DROP POLICY IF EXISTS "Creators/Reviewers/Admin delete question taxonomy" ON public.taxonomy_question_terms;
CREATE POLICY "Creators/Reviewers/Admin delete question taxonomy"
ON public.taxonomy_question_terms FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.questions q
  WHERE q.id = taxonomy_question_terms.question_id
  AND (
    q.created_by = auth.uid()
    OR q.reviewed_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
));

-- 3c) Forum threads ↔ taxonomy terms
CREATE TABLE IF NOT EXISTS public.taxonomy_thread_terms (
  thread_id uuid NOT NULL,
  term_id uuid NOT NULL REFERENCES public.taxonomy_terms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, term_id),
  CONSTRAINT fk_ttt_thread FOREIGN KEY (thread_id) REFERENCES public.forum_threads(id) ON DELETE CASCADE
);

ALTER TABLE public.taxonomy_thread_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read thread taxonomy" ON public.taxonomy_thread_terms;
CREATE POLICY "Public read thread taxonomy"
ON public.taxonomy_thread_terms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authors/Admin manage thread taxonomy" ON public.taxonomy_thread_terms;
CREATE POLICY "Authors/Admin manage thread taxonomy"
ON public.taxonomy_thread_terms FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.forum_threads t
  WHERE t.id = taxonomy_thread_terms.thread_id
  AND (
    t.author_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
));

DROP POLICY IF EXISTS "Authors/Admin delete thread taxonomy" ON public.taxonomy_thread_terms;
CREATE POLICY "Authors/Admin delete thread taxonomy"
ON public.taxonomy_thread_terms FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.forum_threads t
  WHERE t.id = taxonomy_thread_terms.thread_id
  AND (
    t.author_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
));

-- 3d) Profiles ↔ taxonomy terms (e.g., specialties on guru profiles)
CREATE TABLE IF NOT EXISTS public.taxonomy_profile_terms (
  profile_id uuid NOT NULL,
  term_id uuid NOT NULL REFERENCES public.taxonomy_terms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, term_id),
  CONSTRAINT fk_tpr_profile FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

ALTER TABLE public.taxonomy_profile_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read profile taxonomy" ON public.taxonomy_profile_terms;
CREATE POLICY "Public read profile taxonomy"
ON public.taxonomy_profile_terms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners/Admin manage profile taxonomy" ON public.taxonomy_profile_terms;
CREATE POLICY "Owners/Admin manage profile taxonomy"
ON public.taxonomy_profile_terms FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = taxonomy_profile_terms.profile_id
  AND (
    p.user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
));

DROP POLICY IF EXISTS "Owners/Admin delete profile taxonomy" ON public.taxonomy_profile_terms;
CREATE POLICY "Owners/Admin delete profile taxonomy"
ON public.taxonomy_profile_terms FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = taxonomy_profile_terms.profile_id
  AND (
    p.user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
));

-- 4) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_kind ON public.taxonomy_terms(kind);
CREATE INDEX IF NOT EXISTS idx_tpt_term ON public.taxonomy_post_terms(term_id);
CREATE INDEX IF NOT EXISTS idx_tqt_term ON public.taxonomy_question_terms(term_id);
CREATE INDEX IF NOT EXISTS idx_ttt_term ON public.taxonomy_thread_terms(term_id);
CREATE INDEX IF NOT EXISTS idx_tpr_term ON public.taxonomy_profile_terms(term_id);

-- 5) Seed initial standardized taxonomy (idempotent)
INSERT INTO public.taxonomy_terms (slug, title, kind, description)
SELECT x.slug, x.title, x.kind, x.description
FROM (VALUES
  ('emergency-medicine','Emergency Medicine','specialty',''),
  ('cardiology','Cardiology','specialty',''),
  ('endocrinology','Endocrinology','specialty',''),
  ('respiratory','Respiratory','specialty',''),
  ('neurology','Neurology','specialty',''),
  ('radiology','Radiology','specialty',''),
  ('obstetrics-gynecology','Obstetrics & Gynecology','specialty',''),
  ('pediatrics','Paediatrics','specialty',''),
  ('internal-medicine','Internal Medicine','specialty',''),
  ('surgery','Surgery','specialty',''),
  ('clinical-skills','Clinical Skills','topic',''),
  ('ethics','Ethics','topic',''),
  ('global-health','Global Health','topic',''),
  ('career-guidance','Career Guidance','topic','')
) AS x(slug,title,kind,description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.taxonomy_terms t WHERE t.slug = x.slug
);
