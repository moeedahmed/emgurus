-- Fix linter ERROR 0010_security_definer_view by making views run with caller privileges
-- This ensures RLS and privileges of the querying user apply when selecting from the view

-- Safeguard: only apply if the view exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('v','m') AND n.nspname = 'public' AND c.relname = 'exam_questions'
  ) THEN
    EXECUTE 'ALTER VIEW public.exam_questions SET (security_invoker = true)';
  END IF;
END $$;