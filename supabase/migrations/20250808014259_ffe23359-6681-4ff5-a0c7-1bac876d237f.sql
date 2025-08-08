-- Enums for consultations feature
CREATE TYPE public.availability_type AS ENUM ('default', 'exception');
CREATE TYPE public.booking_status AS ENUM ('pending_payment', 'confirmed', 'cancelled', 'completed');
CREATE TYPE public.booking_payment_status AS ENUM ('unpaid', 'paid', 'refunded');
CREATE TYPE public.payment_method AS ENUM ('stripe', 'paypal', 'free');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'refunded', 'failed');
CREATE TYPE public.communication_method AS ENUM ('zoom', 'google_meet', 'phone');
CREATE TYPE public.reminder_type AS ENUM ('email', 'sms', 'whatsapp');

-- Extend profiles for guru discovery
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS exams TEXT[]; -- array of exam keywords
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS price_per_30min NUMERIC(10,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT; -- IANA tz
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS calendar_sync_token TEXT;

-- Availability table
CREATE TABLE public.consult_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type availability_type NOT NULL DEFAULT 'default',
  day_of_week SMALLINT,
  date DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consult_availability ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_consult_availability_updated_at
BEFORE UPDATE ON public.consult_availability
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bookings table
CREATE TABLE public.consult_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending_payment',
  price NUMERIC(10,2) NOT NULL,
  payment_status booking_payment_status NOT NULL DEFAULT 'unpaid',
  meeting_link TEXT,
  communication_method communication_method,
  notes TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consult_bookings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_consult_bookings_updated_at
BEFORE UPDATE ON public.consult_bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Prevent double booking with exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.consult_bookings
  ADD CONSTRAINT no_overlapping_bookings EXCLUDE USING gist (
    guru_id WITH =,
    tstzrange(start_datetime, end_datetime, '[)') WITH &&
  ) WHERE (status <> 'cancelled');

-- Payments table
CREATE TABLE public.consult_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.consult_bookings(id) ON DELETE CASCADE,
  transaction_id TEXT,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  payment_method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consult_payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_consult_payments_updated_at
BEFORE UPDATE ON public.consult_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reminders table
CREATE TABLE public.consult_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.consult_bookings(id) ON DELETE CASCADE,
  reminder_type reminder_type NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  sent_status BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consult_reminders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_consult_reminders_updated_at
BEFORE UPDATE ON public.consult_reminders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
-- Availability: public can read, gurus manage their own
CREATE POLICY "Public can view availability" ON public.consult_availability
FOR SELECT TO public USING (true);

CREATE POLICY "Gurus manage own availability" ON public.consult_availability
FOR ALL TO authenticated
USING (auth.uid() = guru_id AND public.has_role(auth.uid(), 'guru'))
WITH CHECK (auth.uid() = guru_id AND public.has_role(auth.uid(), 'guru'));

-- Bookings
CREATE POLICY "Users can create own bookings" ON public.consult_bookings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own bookings" ON public.consult_bookings
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Gurus can view their bookings" ON public.consult_bookings
FOR SELECT TO authenticated
USING (auth.uid() = guru_id AND public.has_role(auth.uid(), 'guru'));

CREATE POLICY "Gurus can update their bookings" ON public.consult_bookings
FOR UPDATE TO authenticated
USING (auth.uid() = guru_id AND public.has_role(auth.uid(), 'guru'))
WITH CHECK (auth.uid() = guru_id AND public.has_role(auth.uid(), 'guru'));

CREATE POLICY "Admins manage all bookings" ON public.consult_bookings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Payments
CREATE POLICY "View related payments" ON public.consult_payments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.consult_bookings b
    WHERE b.id = consult_payments.booking_id
      AND (b.user_id = auth.uid() OR b.guru_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Insert payments for own booking" ON public.consult_payments
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.consult_bookings b
    WHERE b.id = booking_id
      AND (b.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Admins update payments" ON public.consult_payments
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reminders
CREATE POLICY "Admins manage reminders" ON public.consult_reminders
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gurus view own reminders" ON public.consult_reminders
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.consult_bookings b
    WHERE b.id = consult_reminders.booking_id
      AND b.guru_id = auth.uid()
  )
);
