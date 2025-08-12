-- Create detailed per-question attempt items for reviewed practice/exam sessions
CREATE TABLE IF NOT EXISTS public.exam_attempt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL,
  user_id uuid NOT NULL,
  question_id uuid NOT NULL,
  selected_key text,
  correct_key text,
  topic text,
  position integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_attempt_items_attempt_fk FOREIGN KEY (attempt_id)
    REFERENCES public.exam_attempts(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.exam_attempt_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins manage exam_attempt_items" ON public.exam_attempt_items
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own exam_attempt_items" ON public.exam_attempt_items
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own exam_attempt_items" ON public.exam_attempt_items
FOR SELECT USING (auth.uid() = user_id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS exam_attempt_items_attempt_idx ON public.exam_attempt_items(attempt_id);
CREATE INDEX IF NOT EXISTS exam_attempt_items_user_idx ON public.exam_attempt_items(user_id);
