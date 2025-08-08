-- Harden function search_path for security
CREATE OR REPLACE FUNCTION public.trg_update_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.apply_guru_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT NEW.user_id, 'guru'::app_role
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'guru'::app_role
    );
  END IF;
  RETURN NEW;
END; $$;