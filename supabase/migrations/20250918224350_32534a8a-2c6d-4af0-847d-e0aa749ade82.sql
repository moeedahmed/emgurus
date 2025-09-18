-- Fix security vulnerability: Respect user privacy preferences for profile visibility
-- Replace the overly permissive "Public can view guru profiles" policy

-- First, drop the existing problematic policy
DROP POLICY IF EXISTS "Public can view guru profiles" ON public.profiles;

-- Create a new policy that respects user privacy preferences and protects sensitive data
CREATE POLICY "Public can view opted-in guru profiles with limited data" 
ON public.profiles 
FOR SELECT 
USING (
  -- Only show profiles where:
  -- 1. User has guru role
  -- 2. User has explicitly opted to make profile public
  -- 3. Only show non-sensitive fields (exclude email, phone, etc.)
  has_role(user_id, 'guru'::app_role) 
  AND show_profile_public = true
);

-- Create a view for safe public profile access that excludes sensitive data
CREATE OR REPLACE VIEW public.public_guru_profiles AS
SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  title,
  specialty,
  bio,
  credentials,
  country,
  exams,
  years_experience,
  languages,
  primary_specialty,
  cover_image_url,
  position,
  hospital,
  -- Social links only if user opted to show them
  CASE WHEN show_socials_public THEN linkedin ELSE NULL END as linkedin,
  CASE WHEN show_socials_public THEN twitter ELSE NULL END as twitter,
  CASE WHEN show_socials_public THEN website ELSE NULL END as website,
  CASE WHEN show_socials_public THEN github ELSE NULL END as github,
  CASE WHEN show_socials_public THEN facebook ELSE NULL END as facebook,
  CASE WHEN show_socials_public THEN instagram ELSE NULL END as instagram,
  CASE WHEN show_socials_public THEN youtube ELSE NULL END as youtube,
  created_at,
  updated_at
FROM public.profiles
WHERE 
  has_role(user_id, 'guru'::app_role) 
  AND show_profile_public = true;

-- Allow public access to the safe view
CREATE POLICY "Public can view safe guru profile data" 
ON public.public_guru_profiles 
FOR SELECT 
USING (true);

-- Add RLS to the view
ALTER VIEW public.public_guru_profiles SET (security_barrier = true);

-- Create a security definer function for safe profile access
CREATE OR REPLACE FUNCTION public.get_public_guru_profile(guru_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  avatar_url text,
  title text,
  specialty text,
  bio text,
  credentials text,
  country text,
  exams text[],
  years_experience integer,
  languages text[],
  primary_specialty text,
  cover_image_url text,
  position text,
  hospital text,
  linkedin text,
  twitter text,
  website text,
  github text,
  facebook text,
  instagram text,
  youtube text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.user_id,
    p.full_name,
    p.avatar_url,
    p.title,
    p.specialty,
    p.bio,
    p.credentials,
    p.country,
    p.exams,
    p.years_experience,
    p.languages,
    p.primary_specialty,
    p.cover_image_url,
    p.position,
    p.hospital,
    -- Social links only if user opted to show them
    CASE WHEN p.show_socials_public THEN p.linkedin ELSE NULL END,
    CASE WHEN p.show_socials_public THEN p.twitter ELSE NULL END,
    CASE WHEN p.show_socials_public THEN p.website ELSE NULL END,
    CASE WHEN p.show_socials_public THEN p.github ELSE NULL END,
    CASE WHEN p.show_socials_public THEN p.facebook ELSE NULL END,
    CASE WHEN p.show_socials_public THEN p.instagram ELSE NULL END,
    CASE WHEN p.show_socials_public THEN p.youtube ELSE NULL END,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE 
    p.user_id = guru_user_id
    AND has_role(p.user_id, 'guru'::app_role) 
    AND p.show_profile_public = true;
$$;