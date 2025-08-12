-- Minimal additive changes for Settings v1
-- 1) Optional phone number for SMS readiness
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

-- 2) Notification preferences storage (JSON)
-- Defaults are handled in the app; storing NULL is fine
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_settings jsonb;