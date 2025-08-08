-- Set two guru profiles to free for testing
WITH free_gurus AS (
  SELECT p.user_id
  FROM public.profiles p
  JOIN public.user_roles ur 
    ON ur.user_id = p.user_id 
   AND ur.role = 'guru'::app_role
  -- Prefer gurus that already have a price set to avoid nulls
  WHERE p.price_per_30min IS NOT NULL
  ORDER BY p.created_at ASC
  LIMIT 2
)
UPDATE public.profiles p
SET price_per_30min = 0
FROM free_gurus fg
WHERE p.user_id = fg.user_id;