-- Recreate AI summaries policies using reviewed_by instead of reviewer_id to avoid missing column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_ai_summaries' AND policyname='Public can read AI summaries') THEN
    CREATE POLICY "Public can read AI summaries" ON public.blog_ai_summaries FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_ai_summaries' AND policyname='Reviewer/Admin can write AI summaries') THEN
    CREATE POLICY "Reviewer/Admin can write AI summaries" ON public.blog_ai_summaries
      FOR INSERT WITH CHECK (
        has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_ai_summaries.post_id AND p.reviewed_by = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_ai_summaries' AND policyname='Reviewer/Admin can update AI summaries') THEN
    CREATE POLICY "Reviewer/Admin can update AI summaries" ON public.blog_ai_summaries
      FOR UPDATE USING (
        has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_ai_summaries.post_id AND p.reviewed_by = auth.uid())
      ) WITH CHECK (
        has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_ai_summaries.post_id AND p.reviewed_by = auth.uid())
      );
  END IF;
END $$;