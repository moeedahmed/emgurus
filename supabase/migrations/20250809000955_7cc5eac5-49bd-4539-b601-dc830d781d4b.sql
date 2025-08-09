-- Create curriculum map table
CREATE TABLE IF NOT EXISTS public.curriculum_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_type exam_type NOT NULL,
  slo_number smallint NOT NULL,
  slo_title text NOT NULL,
  key_capability_number smallint NOT NULL,
  key_capability_title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.curriculum_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Public can read curriculum" ON public.curriculum_map
FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Admins manage curriculum" ON public.curriculum_map
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_curriculum_map_updated_at
BEFORE UPDATE ON public.curriculum_map
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mapping for reviewed questions
CREATE TABLE IF NOT EXISTS public.question_curriculum_map (
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  curriculum_id uuid NOT NULL REFERENCES public.curriculum_map(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, curriculum_id)
);

ALTER TABLE public.question_curriculum_map ENABLE ROW LEVEL SECURITY;

-- Public can view mappings; creators/reviewers/admin can insert/delete
CREATE POLICY IF NOT EXISTS "Public can view question-curriculum mapping" ON public.question_curriculum_map
FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Creators/Reviewers/Admin insert mapping" ON public.question_curriculum_map
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.questions q
    WHERE q.id = question_id AND (
      q.created_by = auth.uid() OR has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

CREATE POLICY IF NOT EXISTS "Creators/Reviewers/Admin delete mapping" ON public.question_curriculum_map
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.questions q
    WHERE q.id = question_id AND (
      q.created_by = auth.uid() OR has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- Mapping for AI questions
CREATE TABLE IF NOT EXISTS public.ai_exam_question_curriculum (
  question_id uuid NOT NULL REFERENCES public.ai_exam_questions(id) ON DELETE CASCADE,
  curriculum_id uuid NOT NULL REFERENCES public.curriculum_map(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, curriculum_id)
);

ALTER TABLE public.ai_exam_question_curriculum ENABLE ROW LEVEL SECURITY;

-- Only session owner or admin can view/insert
CREATE POLICY IF NOT EXISTS "Owner/Admin view AI question curriculum" ON public.ai_exam_question_curriculum
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.ai_exam_questions q
    JOIN public.ai_exam_sessions s ON s.id = q.session_id
    WHERE q.id = question_id AND (s.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY IF NOT EXISTS "Owner/Admin insert AI question curriculum" ON public.ai_exam_question_curriculum
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.ai_exam_questions q
    JOIN public.ai_exam_sessions s ON s.id = q.session_id
    WHERE q.id = question_id AND (s.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_curriculum_map_exam_slo_key ON public.curriculum_map (exam_type, slo_number, key_capability_number);
CREATE INDEX IF NOT EXISTS idx_qcm_question ON public.question_curriculum_map (question_id);
CREATE INDEX IF NOT EXISTS idx_qcm_curriculum ON public.question_curriculum_map (curriculum_id);
CREATE INDEX IF NOT EXISTS idx_ai_qcm_question ON public.ai_exam_question_curriculum (question_id);
CREATE INDEX IF NOT EXISTS idx_ai_qcm_curriculum ON public.ai_exam_question_curriculum (curriculum_id);
