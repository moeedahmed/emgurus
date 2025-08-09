-- Fix seed: insert options as text[] instead of jsonb
-- Ensure table and columns already exist (from previous migration)

-- Insert/Upsert 3 demo approved questions with text[] options
DO $$ BEGIN
  -- Q1
  INSERT INTO public.reviewed_exam_questions
    (exam, slo_code, stem, options, correct_index, explanation, reviewer_id, approved, reviewed_at, status)
  VALUES
    ('MRCEM_Primary','SLO1',
     'A 24-year-old presents with sudden pleuritic chest pain and dyspnoea. Which initial investigation best confirms pneumothorax at bedside?',
     ARRAY['Peak flow','Bedside ultrasound','Peak inspiratory pressure','Serial ABGs']::text[],
     1,
     'Bedside lung ultrasound has high sensitivity for pneumothorax (lung point/absent sliding) and is rapid at the bedside.',
     '00000000-0000-0000-0000-000000000001', true, now(), 'approved')
  ON CONFLICT DO NOTHING;

  -- Q2
  INSERT INTO public.reviewed_exam_questions
    (exam, slo_code, stem, options, correct_index, explanation, reviewer_id, approved, reviewed_at, status)
  VALUES
    ('MRCEM_SBA','SLO3',
     'A 68-year-old with AF presents with syncope. ECG shows irregularly irregular rhythm, rate 150. BP 78/40. Next best step?',
     ARRAY['IV amiodarone','Synchronized DC cardioversion','Oral beta-blocker','Adenosine']::text[],
     1,
     'Unstable tachyarrhythmia → immediate synchronized DC cardioversion per ALS/RCEM guidance.',
     '00000000-0000-0000-0000-000000000001', true, now(), 'approved')
  ON CONFLICT DO NOTHING;

  -- Q3
  INSERT INTO public.reviewed_exam_questions
    (exam, slo_code, stem, options, correct_index, explanation, reviewer_id, approved, reviewed_at, status)
  VALUES
    ('FRCEM_SBA','SLO5',
     'During a major incident, which triage principle is prioritized?',
     ARRAY['Treat the sickest first','Maximize survivors with limited resources','First-come, first-served','Children first']::text[],
     1,
     'Major incident triage prioritizes the greatest good for the greatest number; allocate resources to maximize overall survival.',
     '00000000-0000-0000-0000-000000000001', true, now(), 'approved')
  ON CONFLICT DO NOTHING;
END $$;