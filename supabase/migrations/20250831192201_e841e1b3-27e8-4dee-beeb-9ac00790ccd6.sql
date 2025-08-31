-- Enable RLS on billing_webhook_events table
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage webhook events
CREATE POLICY "Admins manage webhook events" ON public.billing_webhook_events
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));