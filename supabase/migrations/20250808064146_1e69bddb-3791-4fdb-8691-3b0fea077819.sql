-- Fix policy creation for comments/reactions/ai summaries (no IF NOT EXISTS)

-- blog_comments policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_comments' AND policyname='Public can read blog comments') THEN
    CREATE POLICY "Public can read blog comments" ON public.blog_comments FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_comments' AND policyname='Users insert own comments') THEN
    CREATE POLICY "Users insert own comments" ON public.blog_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_comments' AND policyname='Users update own comments') THEN
    CREATE POLICY "Users update own comments" ON public.blog_comments FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_comments' AND policyname='Users/Admins delete own or admin') THEN
    CREATE POLICY "Users/Admins delete own or admin" ON public.blog_comments FOR DELETE USING (auth.uid() = author_id OR has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- blog_reactions policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_reactions' AND policyname='Public can read blog reactions') THEN
    CREATE POLICY "Public can read blog reactions" ON public.blog_reactions FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_reactions' AND policyname='Users add own reactions') THEN
    CREATE POLICY "Users add own reactions" ON public.blog_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_reactions' AND policyname='Users remove own reactions') THEN
    CREATE POLICY "Users remove own reactions" ON public.blog_reactions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- blog_comment_reactions policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_comment_reactions' AND policyname='Public can read blog comment reactions') THEN
    CREATE POLICY "Public can read blog comment reactions" ON public.blog_comment_reactions FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_comment_reactions' AND policyname='Users add own comment reactions') THEN
    CREATE POLICY "Users add own comment reactions" ON public.blog_comment_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_comment_reactions' AND policyname='Users remove own comment reactions') THEN
    CREATE POLICY "Users remove own comment reactions" ON public.blog_comment_reactions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- blog_ai_summaries policies
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
        has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_ai_summaries.post_id AND p.reviewer_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_ai_summaries' AND policyname='Reviewer/Admin can update AI summaries') THEN
    CREATE POLICY "Reviewer/Admin can update AI summaries" ON public.blog_ai_summaries
      FOR UPDATE USING (
        has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_ai_summaries.post_id AND p.reviewer_id = auth.uid())
      ) WITH CHECK (
        has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_ai_summaries.post_id AND p.reviewer_id = auth.uid())
      );
  END IF;
END $$;