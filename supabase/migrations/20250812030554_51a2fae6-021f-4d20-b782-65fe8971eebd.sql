-- Add required enum for forum flags if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'forum_flag_status') THEN
    CREATE TYPE forum_flag_status AS ENUM ('open','in_review','resolved','dismissed');
  END IF;
END $$;

-- Helper function to keep updated_at in sync (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1) Guru consultations pricing table
CREATE TABLE IF NOT EXISTS public.consult_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id UUID NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  base_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  session_durations SMALLINT[] NOT NULL DEFAULT '{30}',
  is_public BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT consult_pricing_one_per_guru UNIQUE (guru_id)
);

ALTER TABLE public.consult_pricing ENABLE ROW LEVEL SECURITY;

-- Selection policies
CREATE POLICY IF NOT EXISTS "Public can view public pricing"
ON public.consult_pricing
FOR SELECT
USING (is_public = true);

CREATE POLICY IF NOT EXISTS "Gurus view own pricing"
ON public.consult_pricing
FOR SELECT
USING (auth.uid() = guru_id);

CREATE POLICY IF NOT EXISTS "Admins view all pricing"
ON public.consult_pricing
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert/Update policies
CREATE POLICY IF NOT EXISTS "Gurus manage own pricing"
ON public.consult_pricing
FOR INSERT
WITH CHECK (auth.uid() = guru_id AND has_role(auth.uid(), 'guru'::app_role));

CREATE POLICY IF NOT EXISTS "Gurus update own pricing"
ON public.consult_pricing
FOR UPDATE
USING (auth.uid() = guru_id AND has_role(auth.uid(), 'guru'::app_role))
WITH CHECK (auth.uid() = guru_id AND has_role(auth.uid(), 'guru'::app_role));

CREATE POLICY IF NOT EXISTS "Admins manage all pricing"
ON public.consult_pricing
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_consult_pricing_updated_at ON public.consult_pricing;
CREATE TRIGGER trg_consult_pricing_updated_at
BEFORE UPDATE ON public.consult_pricing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Forums moderation flags table
CREATE TABLE IF NOT EXISTS public.forum_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NULL,
  reply_id UUID NULL,
  reason TEXT NOT NULL,
  status forum_flag_status NOT NULL DEFAULT 'open',
  flagged_by UUID NOT NULL,
  assigned_to UUID NULL,
  resolution_note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.forum_flags ENABLE ROW LEVEL SECURITY;

-- Indexes to support moderation queues
CREATE INDEX IF NOT EXISTS idx_forum_flags_status ON public.forum_flags (status);
CREATE INDEX IF NOT EXISTS idx_forum_flags_assigned_to ON public.forum_flags (assigned_to);
CREATE INDEX IF NOT EXISTS idx_forum_flags_flagged_by ON public.forum_flags (flagged_by);

-- Policies
CREATE POLICY IF NOT EXISTS "Users insert own forum flags"
ON public.forum_flags
FOR INSERT
WITH CHECK (flagged_by = auth.uid());

CREATE POLICY IF NOT EXISTS "Users view own forum flags"
ON public.forum_flags
FOR SELECT
USING (flagged_by = auth.uid());

CREATE POLICY IF NOT EXISTS "Moderators view all forum flags"
ON public.forum_flags
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role));

CREATE POLICY IF NOT EXISTS "Moderators update forum flags"
ON public.forum_flags
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role));

CREATE POLICY IF NOT EXISTS "Admins delete forum flags"
ON public.forum_flags
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_forum_flags_updated_at ON public.forum_flags;
CREATE TRIGGER trg_forum_flags_updated_at
BEFORE UPDATE ON public.forum_flags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();