-- Enums (create if not exists)
DO $$ BEGIN
  CREATE TYPE public.exam_type AS ENUM ('rcem_primary', 'mrcem', 'fellowship', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_answer_feedback AS ENUM ('none','too_easy','hallucinated','wrong','not_relevant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.review_question_status AS ENUM ('draft','under_review','published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Part A: AI Exam tables
CREATE TABLE IF NOT EXISTS public.ai_exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_type public.exam_type NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_exam_sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  source TEXT,
  topic TEXT,
  subtopic TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_exam_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.ai_exam_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  feedback public.ai_answer_feedback NOT NULL DEFAULT 'none',
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers for updated_at
DO $$ BEGIN
  CREATE TRIGGER trg_ai_exam_sessions_updated
  BEFORE UPDATE ON public.ai_exam_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_ai_exam_questions_updated
  BEFORE UPDATE ON public.ai_exam_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_ai_exam_answers_updated
  BEFORE UPDATE ON public.ai_exam_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable RLS
ALTER TABLE public.ai_exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_exam_answers ENABLE ROW LEVEL SECURITY;

-- Policies: ai_exam_sessions
DO $$ BEGIN
  CREATE POLICY "Users insert own AI sessions" ON public.ai_exam_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users view own AI sessions" ON public.ai_exam_sessions
  FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own AI sessions" ON public.ai_exam_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage AI sessions" ON public.ai_exam_sessions
  AS PERMISSIVE FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies: ai_exam_questions
DO $$ BEGIN
  CREATE POLICY "Session owner inserts questions" ON public.ai_exam_questions
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_exam_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  ) OR has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Session owner views questions" ON public.ai_exam_questions
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ai_exam_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  ) OR has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies: ai_exam_answers
DO $$ BEGIN
  CREATE POLICY "Users insert own AI answers" ON public.ai_exam_answers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users view own AI answers" ON public.ai_exam_answers
  FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage AI answers" ON public.ai_exam_answers
  AS PERMISSIVE FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Part B: Review workflow tables
CREATE TABLE IF NOT EXISTS public.review_exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  topic TEXT,
  exam_type public.exam_type NOT NULL,
  status public.review_question_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.review_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.review_exam_questions(id) ON DELETE CASCADE,
  guru_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.review_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.review_assignments(id) ON DELETE CASCADE,
  guru_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback TEXT,
  approved BOOLEAN,
  stars INT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.review_publish_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.review_exam_questions(id) ON DELETE CASCADE,
  published_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers for updated_at on review tables
DO $$ BEGIN
  CREATE TRIGGER trg_review_exam_questions_updated
  BEFORE UPDATE ON public.review_exam_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_review_assignments_updated
  BEFORE UPDATE ON public.review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_review_feedback_updated
  BEFORE UPDATE ON public.review_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable RLS on review tables
ALTER TABLE public.review_exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_publish_log ENABLE ROW LEVEL SECURITY;

-- Policies: review_exam_questions
DO $$ BEGIN
  CREATE POLICY "Admins manage review questions" ON public.review_exam_questions
  AS PERMISSIVE FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Gurus view assigned review questions" ON public.review_exam_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.review_assignments a
      WHERE a.question_id = review_exam_questions.id AND a.guru_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies: review_assignments
DO $$ BEGIN
  CREATE POLICY "Admins manage review assignments" ON public.review_assignments
  AS PERMISSIVE FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Gurus view own assignments" ON public.review_assignments
  FOR SELECT USING (guru_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies: review_feedback
DO $$ BEGIN
  CREATE POLICY "Admins view all feedback" ON public.review_feedback
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Gurus manage own feedback" ON public.review_feedback
  AS PERMISSIVE FOR ALL USING (guru_id = auth.uid()) WITH CHECK (guru_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies: review_publish_log
DO $$ BEGIN
  CREATE POLICY "Admins manage publish log" ON public.review_publish_log
  AS PERMISSIVE FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;