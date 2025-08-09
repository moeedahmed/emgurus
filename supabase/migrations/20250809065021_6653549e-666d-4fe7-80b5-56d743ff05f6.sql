-- Patch existing reviewed_exam_questions to required schema if it already exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='reviewed_exam_questions'
  ) THEN
    BEGIN
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS exam text;
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS topic text;
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS subtopic text;
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS difficulty text;
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS stem text;
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS options jsonb;
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS answer_key text;
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS explanation text;
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS reviewer_id uuid REFERENCES public.gurus(id) ON DELETE SET NULL;
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS reviewed_at timestamptz DEFAULT now();
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    EXCEPTION WHEN duplicate_column THEN NULL; END;
  ELSE
    -- Create fresh if missing altogether
    CREATE TABLE public.reviewed_exam_questions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      exam text NOT NULL CHECK (exam IN ('MRCEM_Primary','MRCEM_SBA','FRCEM_SBA')),
      topic text NOT NULL,
      subtopic text,
      difficulty text,
      stem text NOT NULL,
      options jsonb NOT NULL,
      answer_key text NOT NULL CHECK (answer_key IN ('A','B','C','D','E')),
      explanation text,
      reviewer_id uuid REFERENCES public.gurus(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'approved',
      reviewed_at timestamptz DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Ensure unique index on stem exists only if stem column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reviewed_exam_questions' AND column_name='stem'
  ) AND to_regclass('public.ux_reviewed_exam_questions_stem') IS NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX ux_reviewed_exam_questions_stem ON public.reviewed_exam_questions(stem)';
  END IF;
END $$;

-- Re-run seed block now that columns exist
DO $$
DECLARE
  exams text[] := ARRAY['MRCEM_Primary','MRCEM_SBA','FRCEM_SBA'];
  topics text[] := ARRAY[
    'Cardiology: ACS','ECG: AF with RVR','Respiratory: Asthma','Respiratory: PE',
    'Abdominal: Appendicitis','Abdominal: GI bleed','Trauma: Head injury','Trauma: Cervical spine',
    'Paediatrics: Fever','Paediatrics: Bronchiolitis','Toxicology: Paracetamol','Toxicology: TCA overdose'
  ];
  diffs text[] := ARRAY['Easy','Medium','Hard'];
  reviewer uuid;
  i int; e text; t text; d text; stem text; subtopic text; topic_main text;
  opt jsonb; ans text; expl text;
BEGIN
  SELECT id INTO reviewer FROM public.gurus WHERE name='Dr Test Guru' LIMIT 1;
  FOREACH e IN ARRAY exams LOOP
    FOR i IN 1..array_length(topics,1) LOOP
      t := topics[i];
      topic_main := split_part(t, ':', 1);
      subtopic := btrim(split_part(t, ':', 2));
      d := diffs[(i % array_length(diffs,1)) + 1];
      stem := format('%s • %s — Initial management and key consideration?', e, t);
      ans := chr(64 + ((i % 5) + 1));
      opt := jsonb_build_array(
        jsonb_build_object('key','A','text','Give oxygen and assess ABCs'),
        jsonb_build_object('key','B','text','Immediate ECG and cardiac monitoring'),
        jsonb_build_object('key','C','text','Administer appropriate antidote or therapy'),
        jsonb_build_object('key','D','text','Urgent imaging and consult as indicated'),
        jsonb_build_object('key','E','text','Reassess response and escalate care')
      );
      expl := 'Follow EM best practices: prioritize ABCs, targeted diagnostics, timely therapy, and reassessment.';
      INSERT INTO public.reviewed_exam_questions (exam, topic, subtopic, difficulty, stem, options, answer_key, explanation, reviewer_id, status)
      SELECT e, topic_main, subtopic, d, stem, opt, ans, expl, reviewer, 'approved'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.reviewed_exam_questions q WHERE q.stem = stem
      );
    END LOOP;
  END LOOP;
END $$;

-- Ensure SLO mappings are present (same logic as before, idempotent)
WITH slo_ids AS (
  SELECT code, id FROM public.curriculum_slos
), q AS (
  SELECT id, topic FROM public.reviewed_exam_questions
)
INSERT INTO public.question_slos (question_id, slo_id)
SELECT q.id,
       CASE
         WHEN q.topic = 'Cardiology' THEN (SELECT id FROM slo_ids WHERE code='SLO2')
         WHEN q.topic = 'ECG' THEN (SELECT id FROM slo_ids WHERE code='SLO8')
         WHEN q.topic = 'Respiratory' THEN (SELECT id FROM slo_ids WHERE code='SLO3')
         WHEN q.topic = 'Abdominal' THEN (SELECT id FROM slo_ids WHERE code='SLO4')
         WHEN q.topic = 'Trauma' THEN (SELECT id FROM slo_ids WHERE code='SLO5')
         WHEN q.topic = 'Paediatrics' THEN (SELECT id FROM slo_ids WHERE code='SLO6')
         WHEN q.topic = 'Toxicology' THEN (SELECT id FROM slo_ids WHERE code='SLO7')
         ELSE NULL
       END AS slo_id
FROM q
WHERE (
  (q.topic IN ('Cardiology','ECG','Respiratory','Abdominal','Trauma','Paediatrics','Toxicology'))
)
AND NOT EXISTS (
  SELECT 1 FROM public.question_slos qs WHERE qs.question_id = q.id AND qs.slo_id = (
    CASE
      WHEN q.topic = 'Cardiology' THEN (SELECT id FROM slo_ids WHERE code='SLO2')
      WHEN q.topic = 'ECG' THEN (SELECT id FROM slo_ids WHERE code='SLO8')
      WHEN q.topic = 'Respiratory' THEN (SELECT id FROM slo_ids WHERE code='SLO3')
      WHEN q.topic = 'Abdominal' THEN (SELECT id FROM slo_ids WHERE code='SLO4')
      WHEN q.topic = 'Trauma' THEN (SELECT id FROM slo_ids WHERE code='SLO5')
      WHEN q.topic = 'Paediatrics' THEN (SELECT id FROM slo_ids WHERE code='SLO6')
      WHEN q.topic = 'Toxicology' THEN (SELECT id FROM slo_ids WHERE code='SLO7')
      ELSE NULL
    END
  )
);

WITH slo_ids AS (
  SELECT code, id FROM public.curriculum_slos
), q AS (
  SELECT id, topic FROM public.reviewed_exam_questions WHERE topic IN ('Cardiology','Respiratory')
)
INSERT INTO public.question_slos (question_id, slo_id)
SELECT q.id,
       CASE
         WHEN q.topic = 'Cardiology' THEN (SELECT id FROM slo_ids WHERE code='SLO8')
         WHEN q.topic = 'Respiratory' THEN (SELECT id FROM slo_ids WHERE code='SLO9')
       END
FROM q
WHERE NOT EXISTS (
  SELECT 1 FROM public.question_slos qs WHERE qs.question_id = q.id AND qs.slo_id = (
    CASE
      WHEN q.topic = 'Cardiology' THEN (SELECT id FROM slo_ids WHERE code='SLO8')
      WHEN q.topic = 'Respiratory' THEN (SELECT id FROM slo_ids WHERE code='SLO9')
    END
  )
);
