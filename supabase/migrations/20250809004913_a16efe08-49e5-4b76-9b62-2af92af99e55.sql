-- Add hospital column to profiles for onboarding
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS hospital text;

-- No RLS change needed; existing policies remain valid as hospital is user-owned field.
