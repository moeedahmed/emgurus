-- Ensure reviewed_exam_questions has required columns (no seeding in this step)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='reviewed_exam_questions'
  ) THEN
    BEGIN
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS difficulty text;
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS answer_key text;
      ALTER TABLE public.reviewed_exam_questions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
      -- touch trigger
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname='trg_reviewed_exam_questions_updated_at'
      ) THEN
        CREATE TRIGGER trg_reviewed_exam_questions_updated_at
        BEFORE UPDATE ON public.reviewed_exam_questions
        FOR EACH ROW EXECUTE FUNCTION public.trg_touch_updated_at();
      END IF;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
  END IF;
END $$;

-- Create unique index on stem if possible
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reviewed_exam_questions' AND column_name='stem'
  ) AND to_regclass('public.ux_reviewed_exam_questions_stem') IS NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX ux_reviewed_exam_questions_stem ON public.reviewed_exam_questions(stem)';
  END IF;
END $$;