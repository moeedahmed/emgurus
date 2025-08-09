-- Enable pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- AI content index for RAG
CREATE TABLE IF NOT EXISTS public.ai_content_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id text NOT NULL,
  source_type text NOT NULL,
  title text,
  slug text,
  url text,
  tags text[] DEFAULT '{}',
  text_chunk text NOT NULL,
  embedding vector(3072) NOT NULL,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_content_index ENABLE ROW LEVEL SECURITY;
-- Public may search only published content via RPC; direct selects restricted
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_content_index' AND policyname='Admins can read ai_content_index'
  ) THEN
    CREATE POLICY "Admins can read ai_content_index" ON public.ai_content_index
    FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Sessions, messages, feedback
CREATE TABLE IF NOT EXISTS public.ai_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  anon_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  page_first_seen text
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  content jsonb NOT NULL,
  tokens_in int DEFAULT 0,
  tokens_out int DEFAULT 0,
  tool_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  message_id uuid,
  rating smallint NOT NULL CHECK (rating IN (-1, 1)),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_messages ADD CONSTRAINT fk_ai_messages_session FOREIGN KEY (session_id) REFERENCES public.ai_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.ai_feedback ADD CONSTRAINT fk_ai_feedback_session FOREIGN KEY (session_id) REFERENCES public.ai_sessions(id) ON DELETE CASCADE;

ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

-- RLS: allow admins full, and owners (user_id) view; inserts via Edge (service role)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_sessions' AND policyname='Admins view sessions'
  ) THEN
    CREATE POLICY "Admins view sessions" ON public.ai_sessions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_sessions' AND policyname='Users view own sessions'
  ) THEN
    CREATE POLICY "Users view own sessions" ON public.ai_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_messages' AND policyname='Admins view messages'
  ) THEN
    CREATE POLICY "Admins view messages" ON public.ai_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ai_sessions s WHERE s.id = ai_messages.session_id AND has_role(auth.uid(), 'admin'::app_role)));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_messages' AND policyname='Users view own messages'
  ) THEN
    CREATE POLICY "Users view own messages" ON public.ai_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ai_sessions s WHERE s.id = ai_messages.session_id AND s.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_feedback' AND policyname='Admins view feedback'
  ) THEN
    CREATE POLICY "Admins view feedback" ON public.ai_feedback FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_feedback' AND policyname='Users view own feedback'
  ) THEN
    CREATE POLICY "Users view own feedback" ON public.ai_feedback FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ai_sessions s WHERE s.id = ai_feedback.session_id AND s.user_id = auth.uid()));
  END IF;
END $$;

-- Similarity search helper function for RAG (SECURITY DEFINER to bypass RLS selectively)
CREATE OR REPLACE FUNCTION public.ai_search_content(
  query_embedding vector(3072),
  match_count int DEFAULT 6,
  filter_source text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  url text,
  slug text,
  source_type text,
  tags text[],
  text_chunk text,
  similarity float4
) AS $$
  SELECT c.id, c.title, c.url, c.slug, c.source_type, c.tags, c.text_chunk,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.ai_content_index c
  WHERE c.published = true AND (filter_source IS NULL OR c.source_type = filter_source)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_content_source ON public.ai_content_index(source_type);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON public.ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON public.ai_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_session ON public.ai_feedback(session_id);
