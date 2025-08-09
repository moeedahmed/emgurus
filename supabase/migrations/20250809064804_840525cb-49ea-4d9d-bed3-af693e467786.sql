-- 1) Schema: gurus (add columns if missing), curriculum_slos, reviewed_exam_questions, question_slos
-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Gurus table may already exist; add missing columns for this feature
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='gurus'
  ) THEN
    BEGIN
      ALTER TABLE public.gurus ADD COLUMN IF NOT EXISTS title text;
      ALTER TABLE public.gurus ADD COLUMN IF NOT EXISTS avatar_url text;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
  ELSE
    CREATE TABLE IF NOT EXISTS public.gurus (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      title text,
      avatar_url text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- curriculum_slos
CREATE TABLE IF NOT EXISTS public.curriculum_slos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_slos_code ON public.curriculum_slos(code);

-- reviewed_exam_questions
CREATE TABLE IF NOT EXISTS public.reviewed_exam_questions (
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

-- Touch trigger for updated_at
CREATE OR REPLACE FUNCTION public.trg_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='trg_reviewed_exam_questions_updated_at'
  ) THEN
    CREATE TRIGGER trg_reviewed_exam_questions_updated_at
    BEFORE UPDATE ON public.reviewed_exam_questions
    FOR EACH ROW EXECUTE FUNCTION public.trg_touch_updated_at();
  END IF;
END $$;

-- Uniqueness on stem for idempotent seeding
CREATE UNIQUE INDEX IF NOT EXISTS ux_reviewed_exam_questions_stem ON public.reviewed_exam_questions(stem);

-- question_slos junction
CREATE TABLE IF NOT EXISTS public.question_slos (
  question_id uuid REFERENCES public.reviewed_exam_questions(id) ON DELETE CASCADE,
  slo_id uuid REFERENCES public.curriculum_slos(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, slo_id)
);

-- 1b) RLS
ALTER TABLE public.reviewed_exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_slos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_slos ENABLE ROW LEVEL SECURITY;

-- reviewed_exam_questions policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reviewed_exam_questions' AND policyname='Public can view approved reviewed questions'
  ) THEN
    CREATE POLICY "Public can view approved reviewed questions"
    ON public.reviewed_exam_questions
    FOR SELECT
    USING (status = 'approved');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reviewed_exam_questions' AND policyname='Admins manage reviewed questions'
  ) THEN
    CREATE POLICY "Admins manage reviewed questions"
    ON public.reviewed_exam_questions
    FOR ALL
    USING (has_role(auth.uid(), 'admin'))
    WITH CHECK (has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- curriculum_slos policies: public read, admins manage
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='curriculum_slos' AND policyname='Public can view SLOs'
  ) THEN
    CREATE POLICY "Public can view SLOs"
    ON public.curriculum_slos
    FOR SELECT
    USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='curriculum_slos' AND policyname='Admins manage SLOs'
  ) THEN
    CREATE POLICY "Admins manage SLOs"
    ON public.curriculum_slos
    FOR ALL
    USING (has_role(auth.uid(), 'admin'))
    WITH CHECK (has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- question_slos policies: public read, admins manage
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='question_slos' AND policyname='Public can view question SLOs'
  ) THEN
    CREATE POLICY "Public can view question SLOs"
    ON public.question_slos
    FOR SELECT
    USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='question_slos' AND policyname='Admins manage question SLOs'
  ) THEN
    CREATE POLICY "Admins manage question SLOs"
    ON public.question_slos
    FOR ALL
    USING (has_role(auth.uid(), 'admin'))
    WITH CHECK (has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 2) Seed data (idempotent)
-- Guru
INSERT INTO public.gurus (id, name, title, avatar_url)
SELECT gen_random_uuid(), 'Dr Test Guru', 'Emergency Medicine Consultant', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.gurus WHERE name = 'Dr Test Guru'
);

-- SLOs
WITH slos(code, title) AS (
  VALUES
    ('SLO1','Resuscitation & Cardiac Arrest'),
    ('SLO2','Cardiovascular Emergencies'),
    ('SLO3','Breathlessness & Respiratory'),
    ('SLO4','Abdominal & GI'),
    ('SLO5','Injury & Trauma'),
    ('SLO6','Paediatrics'),
    ('SLO7','Toxicology & Envenomation'),
    ('SLO8','ECG & Arrhythmias'),
    ('SLO9','Imaging & Clinical Decision Rules'),
    ('SLO10','Ethics / Governance / Safety')
)
INSERT INTO public.curriculum_slos (id, code, title)
SELECT gen_random_uuid(), s.code, s.title
FROM slos s
WHERE NOT EXISTS (
  SELECT 1 FROM public.curriculum_slos c WHERE c.code = s.code
);

-- 36 reviewed questions (12 per exam) via PL/pgSQL loop; deterministic stems to keep idempotency
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
      -- Simple 5-option set with one correct answer (varies by i)
      ans := chr(64 + ((i % 5) + 1)); -- cycles A..E
      opt := jsonb_build_array(
        jsonb_build_object('key','A','text','Give oxygen and assess ABCs'),
        jsonb_build_object('key','B','text','Immediate ECG and cardiac monitoring'),
        jsonb_build_object('key','C','text','Administer appropriate antidote or therapy'),
        jsonb_build_object('key','D','text','Urgent imaging and consult as indicated'),
        jsonb_build_object('key','E','text','Reassess response and escalate care')
      );
      expl := 'Follow EM best practices: prioritize ABCs, targeted diagnostics, timely therapy, and reassessment.';
      -- Insert if stem not present
      INSERT INTO public.reviewed_exam_questions (exam, topic, subtopic, difficulty, stem, options, answer_key, explanation, reviewer_id, status)
      SELECT e, topic_main, subtopic, d, stem, opt, ans, expl, reviewer, 'approved'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.reviewed_exam_questions q WHERE q.stem = stem
      );
    END LOOP;
  END LOOP;
END $$;

-- Map questions to SLOs based on topic families (1-2 SLOs each) and avoid duplicates
WITH slo_ids AS (
  SELECT code, id FROM public.curriculum_slos
), q AS (
  SELECT id, topic, stem FROM public.reviewed_exam_questions
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

-- Add a second SLO for some topics (e.g., ACS links to ECG as well)
WITH slo_ids AS (
  SELECT code, id FROM public.curriculum_slos
), q AS (
  SELECT id, topic FROM public.reviewed_exam_questions WHERE topic IN ('Cardiology','Respiratory')
)
INSERT INTO public.question_slos (question_id, slo_id)
SELECT q.id,
       CASE
         WHEN q.topic = 'Cardiology' THEN (SELECT id FROM slo_ids WHERE code='SLO8') -- ECG linkage
         WHEN q.topic = 'Respiratory' THEN (SELECT id FROM slo_ids WHERE code='SLO9') -- Imaging/Rules
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
