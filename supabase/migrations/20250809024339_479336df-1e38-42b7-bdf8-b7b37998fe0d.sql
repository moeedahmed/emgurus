-- Email tracking and review invitation tables

-- Create email_events table
CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  email text NOT NULL,
  type text NOT NULL CHECK (type IN ('welcome','review_invite')),
  provider_message_id text NULL,
  event text NOT NULL CHECK (event IN ('sent','delivered','opened','clicked','bounced','complained','failed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Admins can view all email events
CREATE POLICY "Admins can view email events"
ON public.email_events
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Unique idempotency for sent events per user/type
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_events_user_type_sent
ON public.email_events (user_id, type)
WHERE event = 'sent';

CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON public.email_events (created_at);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON public.email_events (type);
CREATE INDEX IF NOT EXISTS idx_email_events_email ON public.email_events (email);

-- Create review_invitations table
CREATE TABLE IF NOT EXISTS public.review_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  source text NOT NULL, -- e.g., 'post_onboarding_5d'
  status text NOT NULL DEFAULT 'sent',
  trustpilot_invite_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.review_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view all review invitations
CREATE POLICY "Admins can view review invitations"
ON public.review_invitations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Idempotency per user per source
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_invites_user_source
ON public.review_invitations (user_id, source);

CREATE INDEX IF NOT EXISTS idx_review_invites_created_at ON public.review_invitations (created_at);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.trg_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER trg_review_invites_updated
BEFORE UPDATE ON public.review_invitations
FOR EACH ROW EXECUTE FUNCTION public.trg_touch_updated_at();