-- Clean up duplicate exam types and keep canonical slugs only
-- Remove Pakistan-specific duplicates and keep the canonical versions

DELETE FROM taxonomy_terms 
WHERE kind = 'exam' 
AND slug IN (
  'fcps-imm-pk',
  'fcps-part1-pk', 
  'fcps-part2-pk',
  'fcps-em-pk'
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE taxonomy_terms 
ADD CONSTRAINT unique_exam_slug 
UNIQUE (slug, kind);