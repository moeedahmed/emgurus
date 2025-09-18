-- COMPREHENSIVE SECURITY FIXES
-- Phase 1: Critical Database Security Improvements

-- 1. Create security audit log table for tracking sensitive operations
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  table_name text NOT NULL,
  operation text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins view audit logs" ON public.security_audit_log
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Create rate limiting log table
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  ip_address inet NOT NULL,
  endpoint text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on rate limit log
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view rate limit logs
CREATE POLICY "Admins view rate limit logs" ON public.rate_limit_log
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Create security configuration table
CREATE TABLE IF NOT EXISTS public.security_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS - only admins manage security config
ALTER TABLE public.security_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage security config" ON public.security_config
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default security configuration
INSERT INTO public.security_config (key, value, description) VALUES
('rate_limit_requests_per_minute', '60', 'Maximum requests per minute per IP'),
('rate_limit_auth_attempts', '5', 'Maximum authentication attempts per IP per hour'),
('data_retention_days', '365', 'Days to retain audit logs'),
('session_timeout_minutes', '480', 'Session timeout in minutes'),
('password_min_length', '8', 'Minimum password length requirement')
ON CONFLICT (key) DO NOTHING;

-- 4. Fix all database functions to use secure search_path
-- Update existing functions that don't have proper search_path

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', NEW.email)
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 5. Create audit trigger function for sensitive tables
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log the operation
  INSERT INTO public.security_audit_log (
    user_id,
    table_name,
    operation,
    record_id,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 6. Add audit triggers to sensitive tables
CREATE TRIGGER profiles_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER subscriptions_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER consult_bookings_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.consult_bookings
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 7. Strengthen subscriptions table security
-- Drop existing policies and create more restrictive ones
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.subscriptions;

-- More restrictive subscription policies
CREATE POLICY "Users view own active subscriptions only" ON public.subscriptions
FOR SELECT USING (
  user_id = auth.uid() 
  AND status IN ('active', 'trialing', 'past_due')
);

CREATE POLICY "Admins manage all subscriptions" ON public.subscriptions
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- System can insert subscriptions (for webhook processing)
CREATE POLICY "System insert subscriptions" ON public.subscriptions
FOR INSERT WITH CHECK (auth.uid() IS NULL OR user_id = auth.uid());

-- 8. Enhance consult_bookings privacy and security
-- Add data minimization function for bookings
CREATE OR REPLACE FUNCTION public.get_booking_summary(booking_id uuid)
RETURNS TABLE (
  id uuid,
  start_datetime timestamptz,
  end_datetime timestamptz,
  status booking_status,
  communication_method communication_method,
  meeting_link text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    b.id,
    b.start_datetime,
    b.end_datetime,
    b.status,
    b.communication_method,
    CASE 
      WHEN b.status = 'confirmed' AND b.start_datetime > now() 
      THEN b.meeting_link 
      ELSE NULL 
    END as meeting_link
  FROM public.consult_bookings b
  WHERE b.id = booking_id
    AND (b.user_id = auth.uid() OR b.guru_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
$$;

-- 9. Add updated_at triggers where missing
-- Check and add updated_at triggers for tables that don't have them

-- Add updated_at trigger to security_config
CREATE TRIGGER security_config_updated_at
  BEFORE UPDATE ON public.security_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger to security_audit_log (for any updates)
CREATE TRIGGER security_audit_log_updated_at
  BEFORE UPDATE ON public.security_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Create function to check and enforce rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  endpoint_name text,
  max_requests_per_minute integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_requests integer;
  user_ip inet;
BEGIN
  -- Get current request count in the last minute
  SELECT COUNT(*) INTO current_requests
  FROM public.rate_limit_log
  WHERE endpoint = endpoint_name
    AND (user_id = auth.uid() OR ip_address = inet_client_addr())
    AND created_at > now() - interval '1 minute';

  -- If over limit, return false
  IF current_requests >= max_requests_per_minute THEN
    -- Log the blocked attempt
    INSERT INTO public.rate_limit_log (user_id, ip_address, endpoint, blocked)
    VALUES (auth.uid(), inet_client_addr(), endpoint_name, true);
    
    RETURN false;
  END IF;

  -- Log the successful request
  INSERT INTO public.rate_limit_log (user_id, ip_address, endpoint)
  VALUES (auth.uid(), inet_client_addr(), endpoint_name);

  RETURN true;
END;
$$;

-- 11. Create function for secure data export (GDPR compliance)
CREATE OR REPLACE FUNCTION public.export_user_data(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_data jsonb := '{}'::jsonb;
BEGIN
  -- Only allow users to export their own data or admins to export any
  IF target_user_id != auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized data export attempt';
  END IF;

  -- Compile user data (excluding sensitive fields)
  SELECT jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', p.email,
      'country', p.country,
      'timezone', p.timezone,
      'created_at', p.created_at
    ),
    'exam_attempts', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', ea.id,
        'started_at', ea.started_at,
        'finished_at', ea.finished_at,
        'correct_count', ea.correct_count,
        'total_questions', ea.total_questions
      ))
      FROM public.exam_attempts ea
      WHERE ea.user_id = target_user_id
    )
  ) INTO user_data
  FROM public.profiles p
  WHERE p.user_id = target_user_id;

  -- Log the data export
  INSERT INTO public.security_audit_log (user_id, table_name, operation, new_data)
  VALUES (auth.uid(), 'data_export', 'EXPORT', jsonb_build_object('exported_user', target_user_id));

  RETURN user_data;
END;
$$;

-- 12. Add indexes for security-related queries
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON public.security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON public.security_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_ip_endpoint ON public.rate_limit_log(ip_address, endpoint, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_user_endpoint ON public.rate_limit_log(user_id, endpoint, created_at);

-- 13. Create cleanup function for old audit logs
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  retention_days integer;
BEGIN
  -- Get retention period from security config
  SELECT (value::text)::integer INTO retention_days
  FROM public.security_config
  WHERE key = 'data_retention_days';

  -- Default to 365 days if not configured
  retention_days := COALESCE(retention_days, 365);

  -- Delete old audit logs
  DELETE FROM public.security_audit_log
  WHERE created_at < now() - (retention_days || ' days')::interval;

  -- Delete old rate limit logs (keep only 30 days)
  DELETE FROM public.rate_limit_log
  WHERE created_at < now() - interval '30 days';
END;
$$;