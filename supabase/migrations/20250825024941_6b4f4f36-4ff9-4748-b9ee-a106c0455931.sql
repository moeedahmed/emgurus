-- Create missing function for RLS user role checking
CREATE OR REPLACE FUNCTION public.get_user_role_flags(p_user_id uuid)
RETURNS TABLE(is_admin boolean, is_guru boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin') as is_admin,
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'guru') as is_guru;
END;
$$;