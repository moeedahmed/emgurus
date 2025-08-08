-- Move btree_gist extension to extensions schema to satisfy linter
CREATE SCHEMA IF NOT EXISTS extensions;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'
  ) THEN
    EXECUTE 'ALTER EXTENSION btree_gist SET SCHEMA extensions';
  ELSE
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions';
  END IF;
END $$;