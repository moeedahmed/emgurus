-- Option 2: Remove de-dup suffixes by dropping uniqueness on stem and cleaning data
-- 1) Drop the unique constraint on reviewed_exam_questions.stem (by known name and defensively by lookup)
DO $$
BEGIN
  -- Try by known name first
  BEGIN
    EXECUTE 'ALTER TABLE public.reviewed_exam_questions DROP CONSTRAINT IF EXISTS ux_reviewed_exam_questions_stem';
  EXCEPTION WHEN others THEN
    -- ignore
  END;

  -- Find any unique constraint that only targets column "stem" and drop it
  PERFORM 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
  WHERE c.contype = 'u' AND ns.nspname='public' AND t.relname='reviewed_exam_questions'
    AND array_length(c.conkey,1) = 1
    AND EXISTS (
      SELECT 1 FROM unnest(c.conkey) AS attnum
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = attnum
      WHERE a.attname = 'stem'
    );
  IF FOUND THEN
    PERFORM EXECUTE (
      SELECT format('ALTER TABLE public.reviewed_exam_questions DROP CONSTRAINT %I', c.conname)
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = t.relnamespace
      WHERE c.contype='u' AND ns.nspname='public' AND t.relname='reviewed_exam_questions'
        AND array_length(c.conkey,1)=1
        AND EXISTS (
          SELECT 1 FROM unnest(c.conkey) AS attnum
          JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=attnum
          WHERE a.attname='stem'
        )
      LIMIT 1
    );
  END IF;
END $$;

-- 2) Clean trailing " — N" suffix added during previous de-dup across relevant columns
DO $$
BEGIN
  -- reviewed_exam_questions.stem
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reviewed_exam_questions' AND column_name='stem'
  ) THEN
    UPDATE public.reviewed_exam_questions
    SET stem = regexp_replace(stem, '\s+—\s+\d+$', '')
    WHERE stem ~ '\s+—\s+\d+$';
  END IF;

  -- reviewed_exam_questions.question (if present)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reviewed_exam_questions' AND column_name='question'
  ) THEN
    UPDATE public.reviewed_exam_questions
    SET question = regexp_replace(question, '\s+—\s+\d+$', '')
    WHERE question ~ '\s+—\s+\d+$';
  END IF;

  -- review_exam_questions.question (authoring table)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='review_exam_questions' AND column_name='question'
  ) THEN
    UPDATE public.review_exam_questions
    SET question = regexp_replace(question, '\s+—\s+\d+$', '')
    WHERE question ~ '\s+—\s+\d+$';
  END IF;
END $$;