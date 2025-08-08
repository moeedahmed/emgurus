-- Forums MVP schema, RLS, triggers, and seed data
-- 1) Tables

-- Categories
CREATE TABLE IF NOT EXISTS public.forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Threads
CREATE TABLE IF NOT EXISTS public.forum_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.forum_categories(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Replies
CREATE TABLE IF NOT EXISTS public.forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Likes (one like per user per reply)
CREATE TABLE IF NOT EXISTS public.forum_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reply_id uuid NOT NULL REFERENCES public.forum_replies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS forum_likes_user_reply_unique ON public.forum_likes(user_id, reply_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_forum_threads_category ON public.forum_threads(category_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_author ON public.forum_threads(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_thread ON public.forum_replies(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_author ON public.forum_replies(author_id);

-- 2) Enable RLS
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_likes ENABLE ROW LEVEL SECURITY;

-- 3) Policies
-- Categories: public can view; admins manage
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'forum_categories' AND policyname = 'Public can view forum categories'
  ) THEN
    CREATE POLICY "Public can view forum categories" ON public.forum_categories FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'forum_categories' AND policyname = 'Admins manage forum categories'
  ) THEN
    CREATE POLICY "Admins manage forum categories" ON public.forum_categories FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Threads: public view, authors create/update own, admins delete/manage
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'forum_threads' AND policyname = 'Public can view threads'
  ) THEN
    CREATE POLICY "Public can view threads" ON public.forum_threads FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'forum_threads' AND policyname = 'Users can create own threads'
  ) THEN
    CREATE POLICY "Users can create own threads" ON public.forum_threads FOR INSERT WITH CHECK (author_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'forum_threads' AND policyname = 'Authors can update own threads'
  ) THEN
    CREATE POLICY "Authors can update own threads" ON public.forum_threads FOR UPDATE USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'forum_threads' AND policyname = 'Admins can delete threads'
  ) THEN
    CREATE POLICY "Admins can delete threads" ON public.forum_threads FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Replies: public view, authors create/update own, admins delete
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'forum_replies' AND policyname = 'Public can view replies'
  ) THEN
    CREATE POLICY "Public can view replies" ON public.forum_replies FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'forum_replies' AND policyname = 'Users can create own replies'
  ) THEN
    CREATE POLICY "Users can create own replies" ON public.forum_replies FOR INSERT WITH CHECK (author_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'forum_replies' AND policyname = 'Authors can update own replies'
  ) THEN
    CREATE POLICY "Authors can update own replies" ON public.forum_replies FOR UPDATE USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'forum_replies' AND policyname = 'Admins can delete replies'
  ) THEN
    CREATE POLICY "Admins can delete replies" ON public.forum_replies FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Likes: public can view, users like/unlike their own
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'forum_likes' AND policyname = 'Public can view likes'
  ) THEN
    CREATE POLICY "Public can view likes" ON public.forum_likes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'forum_likes' AND policyname = 'Users can like'
  ) THEN
    CREATE POLICY "Users can like" ON public.forum_likes FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'forum_likes' AND policyname = 'Users can unlike own likes'
  ) THEN
    CREATE POLICY "Users can unlike own likes" ON public.forum_likes FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- 4) Triggers for updated_at and content validation
-- Reuse public.update_updated_at_column() if exists
DROP TRIGGER IF EXISTS trg_forum_threads_updated_at ON public.forum_threads;
CREATE TRIGGER trg_forum_threads_updated_at
BEFORE UPDATE ON public.forum_threads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_forum_categories_updated_at ON public.forum_categories;
CREATE TRIGGER trg_forum_categories_updated_at
BEFORE UPDATE ON public.forum_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_forum_replies_updated_at ON public.forum_replies;
CREATE TRIGGER trg_forum_replies_updated_at
BEFORE UPDATE ON public.forum_replies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validation functions
CREATE OR REPLACE FUNCTION public.validate_forum_thread()
RETURNS trigger AS $$
BEGIN
  IF char_length(coalesce(NEW.title, '')) < 5 THEN
    RAISE EXCEPTION 'Thread title must be at least 5 characters';
  END IF;
  IF char_length(coalesce(NEW.content, '')) < 10 THEN
    RAISE EXCEPTION 'Thread content must be at least 10 characters';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.validate_forum_reply()
RETURNS trigger AS $$
BEGIN
  IF char_length(coalesce(NEW.content, '')) < 10 THEN
    RAISE EXCEPTION 'Reply content must be at least 10 characters';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_validate_forum_thread_ins ON public.forum_threads;
CREATE TRIGGER trg_validate_forum_thread_ins
BEFORE INSERT OR UPDATE ON public.forum_threads
FOR EACH ROW EXECUTE FUNCTION public.validate_forum_thread();

DROP TRIGGER IF EXISTS trg_validate_forum_reply_ins ON public.forum_replies;
CREATE TRIGGER trg_validate_forum_reply_ins
BEFORE INSERT OR UPDATE ON public.forum_replies
FOR EACH ROW EXECUTE FUNCTION public.validate_forum_reply();

-- Bump thread updated_at on new reply
CREATE OR REPLACE FUNCTION public.bump_thread_updated_at()
RETURNS trigger AS $$
BEGIN
  UPDATE public.forum_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_bump_thread_on_reply ON public.forum_replies;
CREATE TRIGGER trg_bump_thread_on_reply
AFTER INSERT ON public.forum_replies
FOR EACH ROW EXECUTE FUNCTION public.bump_thread_updated_at();

-- 5) Seed data (idempotent)
-- Insert categories
INSERT INTO public.forum_categories (title, description)
SELECT * FROM (VALUES
  ('Study Tips', 'Share and discuss strategies to retain concepts.'),
  ('EM Exams', 'Questions, discussions, and concerns around exams.'),
  ('Clinical Scenarios', 'Discuss real or theoretical EM clinical cases.')
) AS v(title, description)
WHERE NOT EXISTS (SELECT 1 FROM public.forum_categories);

-- Seed threads and replies only if no threads exist
DO $$
DECLARE
  author1 uuid;
  author2 uuid;
  cat_study uuid;
  cat_exams uuid;
  cat_clinical uuid;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid; t5 uuid; t6 uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.forum_threads) THEN
    SELECT user_id INTO author1 FROM public.profiles LIMIT 1;
    SELECT user_id INTO author2 FROM public.profiles OFFSET 1 LIMIT 1;
    IF author1 IS NULL THEN author1 := gen_random_uuid(); END IF;
    IF author2 IS NULL THEN author2 := author1; END IF;

    SELECT id INTO cat_study FROM public.forum_categories WHERE title = 'Study Tips' LIMIT 1;
    SELECT id INTO cat_exams FROM public.forum_categories WHERE title = 'EM Exams' LIMIT 1;
    SELECT id INTO cat_clinical FROM public.forum_categories WHERE title = 'Clinical Scenarios' LIMIT 1;

    INSERT INTO public.forum_threads (category_id, author_id, title, content)
    VALUES
      (cat_study, author1, 'Best way to remember toxidromes?', 'What are your go-to mnemonics or frameworks to remember common toxidromes during shifts and exams?'),
      (cat_study, author2, 'Flashcards vs Anki for revision?', 'Do you prefer traditional flashcards or Anki spaced repetition for EM revision and why?')
    RETURNING id INTO t1, t2;

    INSERT INTO public.forum_threads (category_id, author_id, title, content)
    VALUES
      (cat_exams, author1, 'MRCP vs MRCEM — which one first?', 'For someone interested in EM, what sequence makes the most sense and why?'),
      (cat_exams, author2, 'Time management during FRCEM SBA', 'What strategies helped you manage time effectively during the FRCEM SBA exam?')
    RETURNING id INTO t3, t4;

    INSERT INTO public.forum_threads (category_id, author_id, title, content)
    VALUES
      (cat_clinical, author1, 'Confused elderly with UTI — what to prioritise?', 'In a 78-year-old with delirium and suspected UTI, what are your first steps and pitfalls to avoid?'),
      (cat_clinical, author2, 'Major trauma ABCDE sequence confusion', 'I sometimes get stuck during the ABCDE assessment in major trauma. Any practical tips?')
    RETURNING id INTO t5, t6;

    -- Replies
    INSERT INTO public.forum_replies (thread_id, author_id, content) VALUES
      (t1, author2, 'TOXBASE summaries + a simple table of agent–antidote helped me a lot.'),
      (t1, author1, 'I use smell/visual cues and a toxidrome flowchart. Practice cases really help.'),
      (t2, author1, 'Anki for spaced repetition. Keep cards concise and test daily.'),
      (t2, author2, 'Flashcards if you like tactile learning, but Anki wins for long-term memory.'),
      (t3, author2, 'MRCEM first if you are certain about EM as a career.'),
      (t4, author1, 'Practice timed blocks. Skip and return to long stems.'),
      (t5, author2, 'ABCDE as a ritual. Treat hypoxia and hypoglycaemia early.'),
      (t6, author1, 'Verbalise each step. Use a checklist during simulations.');
  END IF;
END $$;