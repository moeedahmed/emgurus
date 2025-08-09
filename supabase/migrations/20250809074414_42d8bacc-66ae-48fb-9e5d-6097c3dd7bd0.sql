-- A) Create SLO lookup table and seed minimal set
CREATE TABLE IF NOT EXISTS public.rcem_slos (
  code text PRIMARY KEY,
  label text NOT NULL,
  exam text NOT NULL CHECK (exam IN ('MRCEM_Primary','MRCEM_SBA','FRCEM_SBA'))
);

INSERT INTO public.rcem_slos (code, label, exam) VALUES
('SLO1','Initial Assessment & Management','MRCEM_Primary'),
('SLO2','Clinical Decision Making','MRCEM_Primary'),
('SLO3','Acute Presentations','MRCEM_SBA'),
('SLO4','Procedures & Patient Safety','MRCEM_SBA'),
('SLO5','Complex EM & Leadership','FRCEM_SBA')
ON CONFLICT (code) DO NOTHING;

-- B) Ensure a demo guru exists
INSERT INTO public.gurus (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Dr Test Guru')
ON CONFLICT (id) DO NOTHING;

-- C) Ensure reviewed_exam_questions has required columns
ALTER TABLE public.reviewed_exam_questions
  ADD COLUMN IF NOT EXISTS slo_code text,
  ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Backfill approved based on status if available
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reviewed_exam_questions' AND column_name='status'
  ) THEN
    UPDATE public.reviewed_exam_questions
    SET approved = (status = 'approved')
    WHERE approved IS DISTINCT FROM (status = 'approved');
  END IF;
END $$;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_revq_exam_slo_reviewed ON public.reviewed_exam_questions (exam, slo_code, reviewed_at);

-- D) RLS policy to allow public read of approved rows (keep existing policies too)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reviewed_exam_questions' AND policyname='public can read approved reviewed questions'
  ) THEN
    CREATE POLICY "public can read approved reviewed questions"
    ON public.reviewed_exam_questions
    FOR SELECT TO anon
    USING (approved = true);
  END IF;
END $$;

-- E) Insert a few APPROVED demo questions (match existing schema: options as jsonb array, correct_index integer)
INSERT INTO public.reviewed_exam_questions
  (exam, slo_code, stem, options, correct_index, explanation, reviewer_id, approved, reviewed_at, status)
VALUES
('MRCEM_Primary','SLO1',
 'A 24-year-old presents with sudden pleuritic chest pain and dyspnoea. Which initial investigation best confirms pneumothorax at bedside?',
 '["Peak flow","Bedside ultrasound","Peak inspiratory pressure","Serial ABGs"]'::jsonb,
 1,
 'Bedside lung ultrasound has high sensitivity for pneumothorax (lung point/absent sliding) and is rapid at the bedside.',
 '00000000-0000-0000-0000-000000000001', true, now(), 'approved')
ON CONFLICT DO NOTHING;

INSERT INTO public.reviewed_exam_questions
  (exam, slo_code, stem, options, correct_index, explanation, reviewer_id, approved, reviewed_at, status)
VALUES
('MRCEM_SBA','SLO3',
 'A 68-year-old with AF presents with syncope. ECG shows irregularly irregular rhythm, rate 150. BP 78/40. Next best step?',
 '["IV amiodarone","Synchronized DC cardioversion","Oral beta-blocker","Adenosine"]'::jsonb,
 1,
 'Unstable tachyarrhythmia → immediate synchronized DC cardioversion per ALS/RCEM guidance.',
 '00000000-0000-0000-0000-000000000001', true, now(), 'approved')
ON CONFLICT DO NOTHING;

INSERT INTO public.reviewed_exam_questions
  (exam, slo_code, stem, options, correct_index, explanation, reviewer_id, approved, reviewed_at, status)
VALUES
('FRCEM_SBA','SLO5',
 'During a major incident, which triage principle is prioritized?',
 '["Treat the sickest first","Maximize survivors with limited resources","First-come, first-served","Children first"]'::jsonb,
 1,
 'Major incident triage prioritizes the greatest good for the greatest number; allocate resources to maximize overall survival.',
 '00000000-0000-0000-0000-000000000001', true, now(), 'approved')
ON CONFLICT DO NOTHING;