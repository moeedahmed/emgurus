-- Option 2 (retry): Drop unique constraint on reviewed_exam_questions.stem and remove suffixes

-- 1) Drop by known name if present
ALTER TABLE IF EXISTS public.reviewed_exam_questions DROP CONSTRAINT IF EXISTS ux_reviewed_exam_questions_stem;

-- 2) Also drop any single-column UNIQUE constraint on column "stem" defensively
DO $$
DECLARE v_conname text;
BEGIN
  SELECT c.conname
  INTO v_conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace ns ON ns.oid = t.relnamespace
  WHERE c.contype = 'u'
    AND ns.nspname = 'public'
    AND t.relname = 'reviewed_exam_questions'
    AND array_length(c.conkey,1) = 1
    AND EXISTS (
      SELECT 1 FROM unnest(c.conkey) AS attnum
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = attnum
      WHERE a.attname = 'stem'
    )
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.reviewed_exam_questions DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

-- 3) Clean trailing " — N" from relevant columns
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