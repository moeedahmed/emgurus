-- Exam attempts logging table
CREATE TABLE public.exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source TEXT NOT NULL DEFAULT 'reviewed',
  mode TEXT NOT NULL CHECK (mode IN ('practice','exam')),
  question_ids UUID[] NOT NULL,
  correct_count INTEGER NOT NULL DEFAULT 0,
  total_attempted INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  breakdown JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for dashboards
CREATE INDEX idx_exam_attempts_user_created ON public.exam_attempts (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users insert their own attempts"
ON public.exam_attempts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view their own attempts"
ON public.exam_attempts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all attempts"
ON public.exam_attempts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update attempts"
ON public.exam_attempts
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER trg_exam_attempts_updated_at
BEFORE UPDATE ON public.exam_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();