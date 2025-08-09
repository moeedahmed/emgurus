-- Re-run question seed now that SLOs exist
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
  i int; e text; t text; d text; v_stem text; v_subtopic text; v_topic_main text;
  v_ans text; v_expl text; v_opts text[];
  corr_idx int;
BEGIN
  SELECT id INTO reviewer FROM public.gurus WHERE name='Dr Test Guru' LIMIT 1;
  FOREACH e IN ARRAY exams LOOP
    FOR i IN 1..array_length(topics,1) LOOP
      t := topics[i];
      v_topic_main := split_part(t, ':', 1);
      v_subtopic := btrim(split_part(t, ':', 2));
      d := diffs[(i % array_length(diffs,1)) + 1];
      v_stem := format('%s • %s — Initial management and key consideration?', e, t);
      v_ans := chr(64 + ((i % 5) + 1)); -- A..E
      corr_idx := (i % 5); -- 0-based index into options array
      v_opts := ARRAY[
        'Give oxygen and assess ABCs',
        'Immediate ECG and cardiac monitoring',
        'Administer appropriate antidote or therapy',
        'Urgent imaging and consult as indicated',
        'Reassess response and escalate care'
      ];
      v_expl := 'Follow EM best practices: prioritize ABCs, targeted diagnostics, timely therapy, and reassessment.';
      IF NOT EXISTS (SELECT 1 FROM public.reviewed_exam_questions q WHERE q.stem = v_stem) THEN
        INSERT INTO public.reviewed_exam_questions (
          exam, topic, subtopic, stem, options, correct_index, explanation, reviewer_id, status, reviewed_at, difficulty, answer_key
        ) VALUES (
          e, v_topic_main, v_subtopic, v_stem, v_opts, corr_idx, v_expl, reviewer, 'approved', now(), d, v_ans
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Map to SLOs
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
       END
FROM q
WHERE q.topic IN ('Cardiology','ECG','Respiratory','Abdominal','Trauma','Paediatrics','Toxicology')
ON CONFLICT DO NOTHING;

WITH slo_ids AS (
  SELECT code, id FROM public.curriculum_slos
), q AS (
  SELECT id, topic FROM public.reviewed_exam_questions WHERE topic IN ('Cardiology','Respiratory')
)
INSERT INTO public.question_slos (question_id, slo_id)
SELECT q.id,
       CASE WHEN q.topic = 'Cardiology' THEN (SELECT id FROM slo_ids WHERE code='SLO8')
            WHEN q.topic = 'Respiratory' THEN (SELECT id FROM slo_ids WHERE code='SLO9') END
FROM q
ON CONFLICT DO NOTHING;