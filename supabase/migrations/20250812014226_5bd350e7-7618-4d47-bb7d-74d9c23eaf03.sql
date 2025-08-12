-- Add additional social link columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS github text,
  ADD COLUMN IF NOT EXISTS facebook text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS youtube text;

-- Optional: create simple indexes for faster lookups by social fields (non-unique)
CREATE INDEX IF NOT EXISTS idx_profiles_github ON public.profiles (github);
CREATE INDEX IF NOT EXISTS idx_profiles_facebook ON public.profiles (facebook);
CREATE INDEX IF NOT EXISTS idx_profiles_instagram ON public.profiles (instagram);
CREATE INDEX IF NOT EXISTS idx_profiles_youtube ON public.profiles (youtube);
