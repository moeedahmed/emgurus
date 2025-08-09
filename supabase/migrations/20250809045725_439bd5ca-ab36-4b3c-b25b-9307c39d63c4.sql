-- User progress tracking schema
-- 1) Create user_exam_sessions
CREATE TABLE IF NOT EXISTS public.user_exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exam text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  total integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keep one rolling session per user+exam for simplicity
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_exam_sessions_user_exam_key'
  ) THEN
    ALTER TABLE public.user_exam_sessions
    ADD CONSTRAINT user_exam_sessions_user_exam_key UNIQUE (user_id, exam);
  END IF;
END $$;

-- 2) Create user_question_events
CREATE TABLE IF NOT EXISTS public.user_question_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.user_exam_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question_id uuid NOT NULL REFERENCES public.reviewed_exam_questions(id) ON DELETE RESTRICT,
  outcome text NOT NULL,
  time_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Outcome constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_question_events_outcome_chk'
  ) THEN
    ALTER TABLE public.user_question_events
    ADD CONSTRAINT user_question_events_outcome_chk CHECK (outcome IN ('correct','incorrect','skipped'));
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_exam_sessions_user_exam ON public.user_exam_sessions(user_id, exam);
CREATE INDEX IF NOT EXISTS idx_user_exam_sessions_updated_at ON public.user_exam_sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_question_events_user_created ON public.user_question_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_question_events_session ON public.user_question_events(session_id);
CREATE INDEX IF NOT EXISTS idx_user_question_events_question ON public.user_question_events(question_id);

-- RLS
ALTER TABLE public.user_exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_question_events ENABLE ROW LEVEL SECURITY;

-- Policies for user_exam_sessions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_exam_sessions' AND policyname = 'Users select own sessions'
  ) THEN
    CREATE POLICY "Users select own sessions"
    ON public.user_exam_sessions
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_exam_sessions' AND policyname = 'Users insert own sessions'
  ) THEN
    CREATE POLICY "Users insert own sessions"
    ON public.user_exam_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_exam_sessions' AND policyname = 'Users update own sessions'
  ) THEN
    CREATE POLICY "Users update own sessions"
    ON public.user_exam_sessions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Policies for user_question_events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_question_events' AND policyname = 'Users select own events'
  ) THEN
    CREATE POLICY "Users select own events"
    ON public.user_question_events
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_question_events' AND policyname = 'Users insert own events'
  ) THEN
    CREATE POLICY "Users insert own events"
    ON public.user_question_events
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Updated_at trigger for sessions
CREATE OR REPLACE FUNCTION public.touch_user_exam_sessions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_touch_user_exam_sessions_updated_at ON public.user_exam_sessions;
CREATE TRIGGER trg_touch_user_exam_sessions_updated_at
BEFORE UPDATE ON public.user_exam_sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_user_exam_sessions_updated_at();