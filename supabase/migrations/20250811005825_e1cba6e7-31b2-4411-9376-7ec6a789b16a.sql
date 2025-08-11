-- Fix previous failure: preserve uniqueness of cleaned stems using row_number() suffixes
-- 1) Ensure tags column exists on reviewed_exam_questions
ALTER TABLE IF EXISTS public.reviewed_exam_questions
  ADD COLUMN IF NOT EXISTS tags text[];

-- 2) Clean and de-duplicate stems on reviewed_exam_questions
WITH parsed AS (
  SELECT id,
         stem AS old_stem,
         CASE
           WHEN stem ~ '^[^•]+•\s*[^:—]+[:—]\s*' THEN ltrim(regexp_replace(stem, '^[^•]+•\s*[^:—]+[:—]\s*', ''))
           ELSE stem
         END AS new_stem,
         NULLIF(trim(regexp_replace(stem, '^[^•]+•\s*([^:—]+).*$','\1')), '') AS topic
  FROM public.reviewed_exam_questions
), dedup AS (
  SELECT p.*, ROW_NUMBER() OVER (PARTITION BY new_stem ORDER BY id) AS rn
  FROM parsed p
), final AS (
  SELECT id,
         CASE WHEN rn = 1 THEN new_stem ELSE new_stem || ' — ' || rn::text END AS unique_stem,
         topic
  FROM dedup
)
UPDATE public.reviewed_exam_questions req
SET
  stem = f.unique_stem,
  tags = (
    SELECT ARRAY(
      SELECT DISTINCT t
      FROM unnest(
        array_remove(
          array_cat(
            COALESCE(req.tags, '{}'::text[]),
            ARRAY[
              f.topic,
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
  )
FROM final f
WHERE req.id = f.id
  AND (req.stem <> f.unique_stem OR req.tags IS NULL OR NOT (req.tags @> ARRAY[f.topic]::text[]));

-- 3) Normalize exam_questions similarly (no uniqueness assumed on stem, but safe operation)
WITH parsed2 AS (
  SELECT id,
         stem AS old_stem,
         CASE
           WHEN stem ~ '^[^•]+•\s*[^:—]+[:—]\s*' THEN ltrim(regexp_replace(stem, '^[^•]+•\s*[^:—]+[:—]\s*', ''))
           ELSE stem
         END AS new_stem,
         NULLIF(trim(regexp_replace(stem, '^[^•]+•\s*([^:—]+).*$','\1')), '') AS topic
  FROM public.exam_questions
)
UPDATE public.exam_questions eq
SET
  stem = p.new_stem,
  tags = (
    SELECT ARRAY(
      SELECT DISTINCT t
      FROM unnest(
        array_remove(
          array_cat(
            COALESCE(eq.tags, '{}'::text[]),
            ARRAY[
              p.topic,
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
  )
FROM parsed2 p
WHERE eq.id = p.id
  AND (eq.stem <> p.new_stem OR eq.tags IS NULL OR NOT (eq.tags @> ARRAY[p.topic]::text[]));