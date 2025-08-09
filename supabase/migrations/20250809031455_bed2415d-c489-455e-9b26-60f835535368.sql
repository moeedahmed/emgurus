-- Add onboarding fields and visibility toggles to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS primary_specialty text,
  ADD COLUMN IF NOT EXISTS exam_interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS show_profile_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_socials_public boolean NOT NULL DEFAULT true;

-- Backfill new fields from existing ones when present
UPDATE public.profiles
SET primary_specialty = COALESCE(primary_specialty, specialty),
    exam_interests   = CASE WHEN (exam_interests IS NULL OR array_length(exam_interests,1) IS NULL) THEN COALESCE(exams, '{}') ELSE exam_interests END;

-- Do not block existing users created before this migration
UPDATE public.profiles SET onboarding_required = false WHERE created_at < now();

-- Create table for social account linking
CREATE TABLE IF NOT EXISTS public.user_social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  external_user_id text,
  handle text,
  profile_url text,
  avatar_url text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE public.user_social_accounts ENABLE ROW LEVEL SECURITY;

-- Policies: owners manage their own; admins full access; public can view when profile is public
DO $$ BEGIN
  -- Owner manage
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_social_accounts' AND policyname = 'Users manage own social accounts'
  ) THEN
    CREATE POLICY "Users manage own social accounts" ON public.user_social_accounts
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Admins can view all
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_social_accounts' AND policyname = 'Admins view all social accounts'
  ) THEN
    CREATE POLICY "Admins view all social accounts" ON public.user_social_accounts
    FOR SELECT TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;

  -- Public can view when socials are public
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_social_accounts' AND policyname = 'Public can view public socials'
  ) THEN
    CREATE POLICY "Public can view public socials" ON public.user_social_accounts
    FOR SELECT TO anon
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_social_accounts.user_id AND p.show_socials_public = true
    ));
  END IF;
END $$;

-- Create review_invitations table used for post-onboarding review emails
CREATE TABLE IF NOT EXISTS public.review_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  trustpilot_invite_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, source)
);

ALTER TABLE public.review_invitations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Admins can view all invitations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'review_invitations' AND policyname = 'Admins can view all review invites'
  ) THEN
    CREATE POLICY "Admins can view all review invites" ON public.review_invitations
    FOR SELECT TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;

  -- Users can view their own invitations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'review_invitations' AND policyname = 'Users can view their own review invites'
  ) THEN
    CREATE POLICY "Users can view their own review invites" ON public.review_invitations
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_user_social_accounts_user ON public.user_social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_review_invitations_user ON public.review_invitations(user_id);
