-- Create billing webhook events table for idempotency
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_type ON public.billing_webhook_events(type);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_received_at ON public.billing_webhook_events(received_at);

-- Ensure subscriptions table has unique constraints for safe UPSERTS
ALTER TABLE public.subscriptions ADD CONSTRAINT IF NOT EXISTS unique_stripe_customer_id UNIQUE (stripe_customer_id);
ALTER TABLE public.subscriptions ADD CONSTRAINT IF NOT EXISTS unique_stripe_subscription_id UNIQUE (stripe_subscription_id);