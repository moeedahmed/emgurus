-- Remove trailing " — N" suffix appended during de-dup
DO $$
BEGIN
  -- Clean review_exam_questions.question
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='review_exam_questions' AND column_name='question'
  ) THEN
    UPDATE public.review_exam_questions
    SET question = regexp_replace(question, '\s+—\s+\d+$', '')
    WHERE question ~ '\s+—\s+\d+$';
  END IF;

  -- Clean reviewed_exam_questions.question if present
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reviewed_exam_questions' AND column_name='question'
  ) THEN
    UPDATE public.reviewed_exam_questions
    SET question = regexp_replace(question, '\s+—\s+\d+$', '')
    WHERE question ~ '\s+—\s+\d+$';
  END IF;

  -- Clean reviewed_exam_questions.stem if that's the column used
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reviewed_exam_questions' AND column_name='stem'
  ) THEN
    UPDATE public.reviewed_exam_questions
    SET stem = regexp_replace(stem, '\s+—\s+\d+$', '')
    WHERE stem ~ '\s+—\s+\d+$';
  END IF;
END $$;