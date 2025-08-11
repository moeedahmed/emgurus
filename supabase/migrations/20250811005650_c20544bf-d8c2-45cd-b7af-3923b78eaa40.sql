-- 1) Ensure reviewed_exam_questions has a tags column for topic/exam tagging
ALTER TABLE IF EXISTS public.reviewed_exam_questions
  ADD COLUMN IF NOT EXISTS tags text[];

-- 2) Normalize reviewed_exam_questions:
-- - Remove leading "<Exam> • <Topic>:" or "<Exam> • <Topic> —" from stem
-- - Append Topic and human-friendly Exam label as tags (deduplicated, no NULLs)
UPDATE public.reviewed_exam_questions req
SET
  tags = (
    SELECT ARRAY(
      SELECT DISTINCT t
      FROM unnest(
        array_remove(
          array_cat(
            COALESCE(req.tags, '{}'::text[]),
            ARRAY[
              NULLIF(trim(regexp_replace(req.stem, '^[^•]+•\s*([^:—]+).*$','\1')), ''),
              CASE req.exam
                WHEN 'MRCEM_Primary' THEN 'MRCEM Primary'
                WHEN 'MRCEM_SBA' THEN 'MRCEM SBA'
                WHEN 'FRCEM_SBA' THEN 'FRCEM SBA'
                ELSE NULL
              END
            ]
          ),
          NULL
        )
      ) AS t
    )
  ),
  stem = CASE
    WHEN req.stem ~ '^[^•]+•\s*[^:—]+[:—]\s*'
      THEN ltrim(regexp_replace(req.stem, '^[^•]+•\s*[^:—]+[:—]\s*', ''))
    ELSE req.stem
  END
WHERE req.stem ~ '•';

-- 3) Normalize exam_questions similarly (this table already has tags)
UPDATE public.exam_questions eq
SET
  tags = (
    SELECT ARRAY(
      SELECT DISTINCT t
      FROM unnest(
        array_remove(
          array_cat(
            COALESCE(eq.tags, '{}'::text[]),
            ARRAY[
              NULLIF(trim(regexp_replace(eq.stem, '^[^•]+•\s*([^:—]+).*$','\1')), ''),
              CASE eq.exam_type::text
                WHEN 'MRCEM_PRIMARY' THEN 'MRCEM Primary'
                WHEN 'MRCEM_SBA' THEN 'MRCEM SBA'
                WHEN 'FRCEM_SBA' THEN 'FRCEM SBA'
                ELSE NULL
              END
            ]
          ),
          NULL
        )
      ) AS t
    )
  ),
  stem = CASE
    WHEN eq.stem ~ '^[^•]+•\s*[^:—]+[:—]\s*'
      THEN ltrim(regexp_replace(eq.stem, '^[^•]+•\s*[^:—]+[:—]\s*', ''))
    ELSE eq.stem
  END
WHERE eq.stem ~ '•';

-- Notes:
-- - Patterns look for the first bullet (•), capture the topic up to ':' or '—', and strip that prefix from stem
-- - Tags are deduplicated and NULL entries removed
-- - Safe to re-run (idempotent-ish) as the WHERE clause requires a bullet in the original stem