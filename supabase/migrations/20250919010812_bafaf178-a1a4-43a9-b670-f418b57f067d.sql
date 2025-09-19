-- Fix security issues from previous migration

-- Fix function search_path issues
CREATE OR REPLACE FUNCTION map_exam_name_to_enum(_exam_name text)
RETURNS exam_type_enum
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _exam_name IS NULL THEN 
    RETURN 'OTHER'; 
  END IF;
  
  CASE TRIM(LOWER(_exam_name))
    WHEN 'mrcem primary' THEN RETURN 'MRCEM_PRIMARY';
    WHEN 'mrcem intermediate sba' THEN RETURN 'MRCEM_SBA';
    WHEN 'frcem sba' THEN RETURN 'FRCEM_SBA';
    WHEN 'fcps part 1 – pakistan', 'fcps part 1 - pakistan' THEN RETURN 'FCPS_PART1';
    WHEN 'fcps imm – pakistan', 'fcps imm - pakistan' THEN RETURN 'FCPS_IMM';
    WHEN 'fcps part 2 – pakistan', 'fcps part 2 - pakistan' THEN RETURN 'FCPS_PART2';
    ELSE RETURN 'OTHER';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION map_exam_enum_to_display(_exam_type exam_type_enum)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _exam_type IS NULL THEN 
    RETURN 'Other'; 
  END IF;
  
  CASE _exam_type
    WHEN 'MRCEM_PRIMARY' THEN RETURN 'MRCEM Primary';
    WHEN 'MRCEM_SBA' THEN RETURN 'MRCEM Intermediate SBA';
    WHEN 'FRCEM_SBA' THEN RETURN 'FRCEM SBA';
    WHEN 'FCPS_PART1' THEN RETURN 'FCPS Part 1 – Pakistan';
    WHEN 'FCPS_IMM' THEN RETURN 'FCPS IMM – Pakistan';
    WHEN 'FCPS_PART2' THEN RETURN 'FCPS Part 2 – Pakistan';
    ELSE RETURN 'Other';
  END CASE;
END;
$$;

-- Remove the security definer view and replace with a regular view
DROP VIEW IF EXISTS exam_questions_unified;

CREATE VIEW exam_questions_unified AS
SELECT 
  id,
  stem,
  options,
  explanation,
  status,
  exam_type,
  map_exam_enum_to_display(exam_type) as exam_display,
  exam,
  topic,
  subtopic,
  tags,
  reviewer_id,
  reviewed_at,
  created_at,
  updated_at
FROM reviewed_exam_questions;