-- Fix apply_guru_approval to qualify enum type with schema to avoid search_path issues
CREATE OR REPLACE FUNCTION public.apply_guru_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT NEW.user_id, 'guru'::public.app_role
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'guru'::public.app_role
    );
  END IF;
  RETURN NEW;
END; $function$;
