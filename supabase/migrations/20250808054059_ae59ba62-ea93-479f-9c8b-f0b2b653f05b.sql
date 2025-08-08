-- 1) Extend profiles with additional optional fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS languages text[],
  ADD COLUMN IF NOT EXISTS linkedin text,
  ADD COLUMN IF NOT EXISTS twitter text,
  ADD COLUMN IF NOT EXISTS website text;

-- Ensure arrays default to empty when not provided
ALTER TABLE public.profiles
  ALTER COLUMN languages SET DEFAULT ARRAY[]::text[];

-- 2) Create public avatars storage bucket if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'avatars'
  ) THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
  END IF;
END $$;

-- 3) Storage policies for avatars
-- Public can view avatars
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatars are publicly readable'
  ) THEN
    CREATE POLICY "Avatars are publicly readable" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');
  END IF;
END $$;

-- Authenticated users can upload/update their own avatar in a folder named with their user_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can upload their own avatar'
  ) THEN
    CREATE POLICY "Users can upload their own avatar" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can update their own avatar'
  ) THEN
    CREATE POLICY "Users can update their own avatar" ON storage.objects
    FOR UPDATE USING (
      bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;
