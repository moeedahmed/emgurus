-- Create gurus table if missing
CREATE TABLE IF NOT EXISTS public.gurus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialty text,
  exams text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create reviewed_exam_questions table if missing
CREATE TABLE IF NOT EXISTS public.reviewed_exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam text NOT NULL,
  topic text,
  subtopic text,
  stem text NOT NULL,
  options text[] NULL,
  correct_index integer NULL,
  explanation text,
  reviewer_id uuid NULL,
  reviewed_at timestamptz NULL,
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK if not existing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviewed_exam_questions_reviewer_id_fkey'
  ) THEN
    ALTER TABLE public.reviewed_exam_questions
    ADD CONSTRAINT reviewed_exam_questions_reviewer_id_fkey
    FOREIGN KEY (reviewer_id) REFERENCES public.gurus(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.gurus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewed_exam_questions ENABLE ROW LEVEL SECURITY;

-- Policies for gurus
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gurus' AND policyname = 'Public can view gurus'
  ) THEN
    CREATE POLICY "Public can view gurus"
    ON public.gurus
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gurus' AND policyname = 'Admins manage gurus'
  ) THEN
    CREATE POLICY "Admins manage gurus"
    ON public.gurus
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Policies for reviewed_exam_questions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reviewed_exam_questions' AND policyname = 'Public view approved reviewed questions'
  ) THEN
    CREATE POLICY "Public view approved reviewed questions"
    ON public.reviewed_exam_questions
    FOR SELECT
    USING (status = 'approved');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reviewed_exam_questions' AND policyname = 'Admins manage reviewed questions'
  ) THEN
    CREATE POLICY "Admins manage reviewed questions"
    ON public.reviewed_exam_questions
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Seed demo guru (idempotent)
INSERT INTO public.gurus (id, name, specialty, exams)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Dr Test Guru', 'EM', ARRAY['MRCEM_Primary'])
ON CONFLICT (id) DO NOTHING;

-- Seed 25 demo reviewed questions if table is empty
DO $$
DECLARE
  cnt int;
  i int;
  topics text[] := ARRAY['Airway','Breathing','Circulation','Sepsis','Trauma'];
  subs text[] := ARRAY['Basics','Advanced','Pediatrics','Elderly','Pregnancy'];
  opt text[];
BEGIN
  SELECT count(*) INTO cnt FROM public.reviewed_exam_questions;
  IF cnt = 0 THEN
    FOR i IN 1..25 LOOP
      opt := ARRAY['Option A','Option B','Option C','Option D'];
      INSERT INTO public.reviewed_exam_questions
        (exam, topic, subtopic, stem, options, correct_index, explanation, reviewer_id, reviewed_at, status)
      VALUES
        ('MRCEM_Primary',
         topics[(i % array_length(topics,1)) + 1],
         subs[(i % array_length(subs,1)) + 1],
         'Demo reviewed MCQ #'||i||' — early recognition and management principles.',
         opt,
         (i % 4),
         'Reviewed explanation for demo question #'||i||'.',
         '00000000-0000-0000-0000-000000000001'::uuid,
         now(),
         'approved');
    END LOOP;
  END IF;
END $$;