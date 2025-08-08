-- Voting and Reactions schema for Forums (and extensible)

-- Enum for reaction targets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reaction_target') THEN
    CREATE TYPE public.reaction_target AS ENUM ('forum_thread','forum_reply','blog_post','blog_comment','exam_question','exam_answer');
  END IF;
END $$;

-- Thread votes
CREATE TABLE IF NOT EXISTS public.forum_thread_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, thread_id)
);

-- Reply votes
CREATE TABLE IF NOT EXISTS public.forum_reply_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id uuid NOT NULL REFERENCES public.forum_replies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reply_id)
);

-- Reactions (generic)
CREATE TABLE IF NOT EXISTS public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target reaction_target NOT NULL,
  content_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target, content_id, emoji)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forum_thread_votes_thread ON public.forum_thread_votes(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_reply_votes_reply ON public.forum_reply_votes(reply_id);
CREATE INDEX IF NOT EXISTS idx_reactions_target_content ON public.reactions(target, content_id);

-- Enable RLS
ALTER TABLE public.forum_thread_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_reply_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Policies: public can view aggregates; users manage their rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='forum_thread_votes' AND policyname='Public can view thread votes') THEN
    CREATE POLICY "Public can view thread votes" ON public.forum_thread_votes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='forum_thread_votes' AND policyname='Users manage own thread votes') THEN
    CREATE POLICY "Users manage own thread votes" ON public.forum_thread_votes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='forum_reply_votes' AND policyname='Public can view reply votes') THEN
    CREATE POLICY "Public can view reply votes" ON public.forum_reply_votes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='forum_reply_votes' AND policyname='Users manage own reply votes') THEN
    CREATE POLICY "Users manage own reply votes" ON public.forum_reply_votes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reactions' AND policyname='Public can view reactions') THEN
    CREATE POLICY "Public can view reactions" ON public.reactions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reactions' AND policyname='Users manage own reactions') THEN
    CREATE POLICY "Users manage own reactions" ON public.reactions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_forum_thread_votes_updated_at ON public.forum_thread_votes;
CREATE TRIGGER trg_forum_thread_votes_updated_at BEFORE UPDATE ON public.forum_thread_votes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_forum_reply_votes_updated_at ON public.forum_reply_votes;
CREATE TRIGGER trg_forum_reply_votes_updated_at BEFORE UPDATE ON public.forum_reply_votes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_reactions_updated_at ON public.reactions;
CREATE TRIGGER trg_reactions_updated_at BEFORE UPDATE ON public.reactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();