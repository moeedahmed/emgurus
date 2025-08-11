-- Drop unique index enforcing uniqueness on stem, then clean suffixes
DROP INDEX IF EXISTS public.ux_reviewed_exam_questions_stem;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reviewed_exam_questions' AND column_name='stem'
  ) THEN
    UPDATE public.reviewed_exam_questions
    SET stem = regexp_replace(stem, '\s+—\s+\d+$', '')
    WHERE stem ~ '\s+—\s+\d+$';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reviewed_exam_questions' AND column_name='question'
  ) THEN
    UPDATE public.reviewed_exam_questions
    SET question = regexp_replace(question, '\s+—\s+\d+$', '')
    WHERE question ~ '\s+—\s+\d+$';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='review_exam_questions' AND column_name='question'
  ) THEN
    UPDATE public.review_exam_questions
    SET question = regexp_replace(question, '\s+—\s+\d+$', '')
    WHERE question ~ '\s+—\s+\d+$';
  END IF;
END $$;