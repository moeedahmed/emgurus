-- Add cover image URL to profiles for banner
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cover_image_url text;
