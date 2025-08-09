-- Create question_slos if missing
CREATE TABLE IF NOT EXISTS public.question_slos (
  question_id uuid REFERENCES public.reviewed_exam_questions(id) ON DELETE CASCADE,
  slo_id uuid REFERENCES public.curriculum_slos(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, slo_id)
);
ALTER TABLE public.question_slos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='question_slos' AND policyname='Public can view question SLOs'
  ) THEN
    CREATE POLICY "Public can view question SLOs" ON public.question_slos FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='question_slos' AND policyname='Admins manage question SLOs'
  ) THEN
    CREATE POLICY "Admins manage question SLOs" ON public.question_slos FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
  END IF;
END $$;