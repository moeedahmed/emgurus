-- Normalize review_exam_questions only (avoid touching views like exam_questions)
-- 1) Ensure tags column exists on review_exam_questions
ALTER TABLE IF EXISTS public.review_exam_questions
  ADD COLUMN IF NOT EXISTS tags text[];

-- 2) Clean and de-duplicate question text by stripping leading "System • Topic —" prefixes
WITH parsed AS (
  SELECT id,
         question AS old_question,
         CASE
           WHEN question ~ '^[^•]+•\s*[^:—]+[:—]\s*' THEN ltrim(regexp_replace(question, '^[^•]+•\s*[^:—]+[:—]\s*', ''))
           ELSE question
         END AS new_question,
         NULLIF(trim(regexp_replace(question, '^[^•]+•\s*([^:—]+).*$','\1')), '') AS topic
  FROM public.review_exam_questions
), dedup AS (
  SELECT p.*, ROW_NUMBER() OVER (PARTITION BY new_question ORDER BY id) AS rn
  FROM parsed p
), final AS (
  SELECT id,
         CASE WHEN rn = 1 THEN new_question ELSE new_question || ' — ' || rn::text END AS unique_question,
         topic
  FROM dedup
)
UPDATE public.review_exam_questions req
SET
  question = f.unique_question,
  tags = (
    SELECT ARRAY(
      SELECT DISTINCT t
      FROM unnest(
        array_remove(
          array_cat(
            COALESCE(req.tags, '{}'::text[]),
            ARRAY[
              f.topic,
              CASE req.exam_type::text
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
FROM final f
WHERE req.id = f.id
  AND (req.question <> f.unique_question OR req.tags IS NULL OR (f.topic IS NOT NULL AND NOT (req.tags @> ARRAY[f.topic]::text[])));
