-- Fix seeding ambiguity by renaming variables
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
  v_opt jsonb; v_ans text; v_expl text;
BEGIN
  SELECT id INTO reviewer FROM public.gurus WHERE name='Dr Test Guru' LIMIT 1;
  FOREACH e IN ARRAY exams LOOP
    FOR i IN 1..array_length(topics,1) LOOP
      t := topics[i];
      v_topic_main := split_part(t, ':', 1);
      v_subtopic := btrim(split_part(t, ':', 2));
      d := diffs[(i % array_length(diffs,1)) + 1];
      v_stem := format('%s • %s — Initial management and key consideration?', e, t);
      v_ans := chr(64 + ((i % 5) + 1));
      v_opt := jsonb_build_array(
        jsonb_build_object('key','A','text','Give oxygen and assess ABCs'),
        jsonb_build_object('key','B','text','Immediate ECG and cardiac monitoring'),
        jsonb_build_object('key','C','text','Administer appropriate antidote or therapy'),
        jsonb_build_object('key','D','text','Urgent imaging and consult as indicated'),
        jsonb_build_object('key','E','text','Reassess response and escalate care')
      );
      v_expl := 'Follow EM best practices: prioritize ABCs, targeted diagnostics, timely therapy, and reassessment.';
      INSERT INTO public.reviewed_exam_questions (exam, topic, subtopic, difficulty, stem, options, answer_key, explanation, reviewer_id, status)
      SELECT e, v_topic_main, v_subtopic, d, v_stem, v_opt, v_ans, v_expl, reviewer, 'approved'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.reviewed_exam_questions q WHERE q.stem = v_stem
      );
    END LOOP;
  END LOOP;
END $$;
