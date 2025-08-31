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

-- Check if constraints exist before adding them
DO $$
BEGIN
    -- Add unique constraint for stripe_customer_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_stripe_customer_id') THEN
        ALTER TABLE public.subscriptions ADD CONSTRAINT unique_stripe_customer_id UNIQUE (stripe_customer_id);
    END IF;
    
    -- Add unique constraint for stripe_subscription_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_stripe_subscription_id') THEN
        ALTER TABLE public.subscriptions ADD CONSTRAINT unique_stripe_subscription_id UNIQUE (stripe_subscription_id);
    END IF;
END $$;