-- Migration: harden function search_path

CREATE OR REPLACE FUNCTION public._map_exam_type_to_enum(_val text)
RETURNS public.exam_type_enum
LANGUAGE plpgsql IMMUTABLE
SET search_path TO public
AS $$
BEGIN
  IF _val IS NULL THEN RETURN 'OTHER'; END IF;
  CASE lower(_val)
    WHEN 'rcem_primary', 'mrcem_primary' THEN RETURN 'MRCEM_PRIMARY';
    WHEN 'mrcem', 'mrcem_sba', 'sba' THEN RETURN 'MRCEM_SBA';
    WHEN 'fellowship', 'frcem', 'frcem_sba' THEN RETURN 'FRCEM_SBA';
    ELSE RETURN 'OTHER';
  END CASE;
END; $$;

CREATE OR REPLACE FUNCTION public._require_auth() RETURNS uuid
LANGUAGE plpgsql STABLE
SET search_path TO public
AS $$
DECLARE v_uid uuid; BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '28000'; END IF;
  RETURN v_uid;
END $$;