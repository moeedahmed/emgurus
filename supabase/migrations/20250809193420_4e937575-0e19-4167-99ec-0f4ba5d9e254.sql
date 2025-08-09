-- Create lightweight observability table for AI Practice generations
CREATE TABLE IF NOT EXISTS public.ai_gen_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  source text NOT NULL,
  exam text,
  slo text,
  count integer,
  model_used text,
  success boolean NOT NULL,
  error_code text
);

-- Enable RLS
ALTER TABLE public.ai_gen_logs ENABLE ROW LEVEL SECURITY;

-- Policies: users can insert and read their own logs
CREATE POLICY "ai_gen_logs_insert_own"
ON public.ai_gen_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_gen_logs_select_own"
ON public.ai_gen_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
