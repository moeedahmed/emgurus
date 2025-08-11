-- Migration: reviewed_exam_perf_indexes_v2 (column-robust)
-- Safe, idempotent performance indexes for reviewed_exam_questions

-- Enable trigram extension for fast ILIKE on stem
create extension if not exists pg_trgm;

-- Core partial index: prefer (exam_type, reviewed_at) when exam_type exists,
-- otherwise fall back to just reviewed_at for approved rows
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviewed_exam_questions' AND column_name = 'exam_type'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_revq_approved_examtype_reviewed
      ON public.reviewed_exam_questions (exam_type, reviewed_at DESC)
      WHERE status = 'approved';
  ELSE
    CREATE INDEX IF NOT EXISTS idx_revq_approved_reviewed_at
      ON public.reviewed_exam_questions (reviewed_at DESC)
      WHERE status = 'approved';
  END IF;
END$$;

-- Optional legacy 'exam' column support
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviewed_exam_questions' AND column_name = 'exam'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_revq_approved_exam_reviewed
      ON public.reviewed_exam_questions (exam, reviewed_at DESC)
      WHERE status = 'approved';
  END IF;
END $$;

-- Optional topic filter index if topic column is present
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviewed_exam_questions' AND column_name = 'topic'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_revq_approved_topic_reviewed
      ON public.reviewed_exam_questions (topic, reviewed_at DESC)
      WHERE status = 'approved';
  END IF;
END $$;

-- Trigram index for ILIKE searches on stem
CREATE INDEX IF NOT EXISTS idx_revq_stem_trgm
  ON public.reviewed_exam_questions USING gin (stem gin_trgm_ops);

-- Optional GIN on tags (array/jsonb) if present
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviewed_exam_questions' AND column_name = 'tags'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_revq_tags_gin
      ON public.reviewed_exam_questions USING gin (tags);
  END IF;
END $$;

-- Optional supporting indexes for SLO relations (if table exists)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'question_slos'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='question_slos' AND column_name='question_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_question_slos_question ON public.question_slos(question_id);
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='question_slos' AND column_name='slo_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_question_slos_slo ON public.question_slos(slo_id);
    END IF;
  END IF;
END $$;