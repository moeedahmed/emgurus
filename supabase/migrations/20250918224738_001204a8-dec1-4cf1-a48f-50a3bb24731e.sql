-- Update the secure function to include missing fields
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
  user_position text,
  hospital text,
  timezone text,
  price_per_30min numeric,
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
    p."position" as user_position,
    p.hospital,
    p.timezone,
    p.price_per_30min,
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