-- Create table for per-user reviewed question sessions
CREATE TABLE IF NOT EXISTS public.user_question_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  question_id UUID NOT NULL,
  exam TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INT NOT NULL DEFAULT 0,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  last_selected TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  time_spent_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_question_sessions ENABLE ROW LEVEL SECURITY;

-- Policies: users manage own rows
CREATE POLICY IF NOT EXISTS "Users manage own question sessions"
ON public.user_question_sessions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY IF NOT EXISTS "Admins can view all question sessions"
ON public.user_question_sessions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_user_question_sessions_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_user_question_sessions_updated_at
    BEFORE UPDATE ON public.user_question_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_uqs_user_question ON public.user_question_sessions (user_id, question_id);

-- Seed minimal EM SLOs if missing
INSERT INTO public.curriculum_slos (code, title)
SELECT v.code, v.title
FROM (VALUES
  ('SLO1','Resuscitation & Cardiac Arrest'),
  ('SLO2','Cardiovascular Emergencies'),
  ('SLO3','Breathlessness & Respiratory'),
  ('SLO4','Abdominal & GI'),
  ('SLO5','Injury & Trauma'),
  ('SLO6','Paediatrics'),
  ('SLO7','Toxicology & Envenomation'),
  ('SLO8','ECG & Arrhythmias'),
  ('SLO9','Imaging & Decision Rules'),
  ('SLO10','Ethics / Governance / Safety')
) AS v(code,title)
WHERE NOT EXISTS (
  SELECT 1 FROM public.curriculum_slos s WHERE s.code = v.code
);
