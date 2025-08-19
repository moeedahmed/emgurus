-- Add FCPS exam types to exam_type_enum
DO $$ BEGIN
  -- Add FCPS_PART1 if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'exam_type_enum' AND e.enumlabel = 'FCPS_PART1'
  ) THEN ALTER TYPE public.exam_type_enum ADD VALUE 'FCPS_PART1'; END IF;

  -- Add FCPS_IMM if it doesn't exist  
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'exam_type_enum' AND e.enumlabel = 'FCPS_IMM'
  ) THEN ALTER TYPE public.exam_type_enum ADD VALUE 'FCPS_IMM'; END IF;

  -- Add FCPS_PART2 if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'exam_type_enum' AND e.enumlabel = 'FCPS_PART2'
  ) THEN ALTER TYPE public.exam_type_enum ADD VALUE 'FCPS_PART2'; END IF;
END $$;

-- Update the mapping function to include FCPS exam types
CREATE OR REPLACE FUNCTION public._map_exam_type_to_enum(_val text)
RETURNS public.exam_type_enum
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF _val IS NULL THEN RETURN 'OTHER'; END IF;
  CASE lower(_val)
    WHEN 'rcem_primary', 'mrcem_primary' THEN RETURN 'MRCEM_PRIMARY';
    WHEN 'mrcem', 'mrcem_sba', 'sba' THEN RETURN 'MRCEM_SBA';
    WHEN 'fellowship', 'frcem', 'frcem_sba' THEN RETURN 'FRCEM_SBA';
    WHEN 'fcps-part1-pk', 'fcps_part1' THEN RETURN 'FCPS_PART1';
    WHEN 'fcps-imm-pk', 'fcps_imm' THEN RETURN 'FCPS_IMM';
    WHEN 'fcps-part2-pk', 'fcps_part2' THEN RETURN 'FCPS_PART2';
    ELSE RETURN 'OTHER';
  END CASE;
END; $$;