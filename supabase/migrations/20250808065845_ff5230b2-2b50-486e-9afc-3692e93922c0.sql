-- Ensure blog_tags and blog_post_tags exist with RLS and policies, then seed tags
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

INSERT INTO public.blog_tags (slug, title) VALUES
 ('mrcem','MRCEM'), ('frcem','FRCEM'), ('osce','OSCE'), ('ultrasound','Ultrasound'),
 ('airway','Airway'), ('trauma','Trauma'), ('resus','Resus'), ('ecg','ECG'),
 ('pediatrics','Pediatrics'), ('toxicology','Toxicology'), ('sepsis','Sepsis'), ('procedures','Procedures')
ON CONFLICT (slug) DO NOTHING;