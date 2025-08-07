-- Tighten RLS on subscriptions table
-- Remove overly permissive policy if it exists
DROP POLICY IF EXISTS "System can manage all subscriptions" ON public.subscriptions;

-- Ensure users can only view their own subscriptions
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions
FOR SELECT
USING (user_id = auth.uid());

-- Allow admins to manage all subscriptions
DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.subscriptions;
CREATE POLICY "Admins manage subscriptions"
ON public.subscriptions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));