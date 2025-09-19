-- Database standardization: Convert all exam-related columns to use exam_type_enum consistently

-- Step 1: Add exam_type column to tables that only have 'exam' text column
ALTER TABLE reviewed_exam_questions ADD COLUMN exam_type exam_type_enum;
ALTER TABLE user_exam_sessions ADD COLUMN exam_type exam_type_enum;

-- Step 2: Create a mapping function to convert exam names to enum values
CREATE OR REPLACE FUNCTION map_exam_name_to_enum(_exam_name text)
RETURNS exam_type_enum
LANGUAGE plpgsql
IMMUTABLE
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

-- Step 3: Populate exam_type columns using the mapping function
UPDATE reviewed_exam_questions 
SET exam_type = map_exam_name_to_enum(exam)
WHERE exam_type IS NULL;

UPDATE user_exam_sessions 
SET exam_type = map_exam_name_to_enum(exam)
WHERE exam_type IS NULL;

-- Step 4: Create reverse mapping function for display purposes
CREATE OR REPLACE FUNCTION map_exam_enum_to_display(_exam_type exam_type_enum)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
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

-- Step 5: Update RLS policies that reference 'exam' column to use 'exam_type'
-- (This will be handled in the application code updates)

-- Step 6: Add NOT NULL constraints to exam_type columns after migration
-- (Will be done after verifying data migration)

-- Step 7: Create index on exam_type columns for better performance
CREATE INDEX IF NOT EXISTS idx_reviewed_exam_questions_exam_type ON reviewed_exam_questions(exam_type);
CREATE INDEX IF NOT EXISTS idx_user_exam_sessions_exam_type ON user_exam_sessions(exam_type);

-- Step 8: Create a view for backward compatibility during transition
CREATE OR REPLACE VIEW exam_questions_unified AS
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