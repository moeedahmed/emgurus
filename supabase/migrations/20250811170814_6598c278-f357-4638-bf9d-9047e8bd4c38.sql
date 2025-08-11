-- Migration: move_pg_trgm_to_extensions_schema
-- Purpose: Resolve linter warning by installing pg_trgm in the extensions schema

-- Ensure the extensions schema exists
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    -- Move existing pg_trgm into the extensions schema
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  ELSE
    -- Fresh install into the extensions schema (idempotent)
    CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
  END IF;
END $$;