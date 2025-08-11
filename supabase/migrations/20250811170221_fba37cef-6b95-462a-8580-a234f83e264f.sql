-- Migration: harden RPC search_path for linter compliance
ALTER FUNCTION public.list_public_reviewed_questions(text, text, text, integer, integer)
  SET search_path = 'public';