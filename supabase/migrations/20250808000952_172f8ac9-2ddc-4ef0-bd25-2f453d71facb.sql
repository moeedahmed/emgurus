-- 1) Extend profiles with public guru fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS credentials text;

-- Allow public to view guru profiles only
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Public can view guru profiles" ON public.profiles;
CREATE POLICY "Public can view guru profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(user_id, 'guru'::app_role));

-- Keep existing insert/update policies as-is (already present)

-- 2) Guru applications
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'guru_application_status') THEN
    CREATE TYPE public.guru_application_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.guru_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  specialty text,
  bio text,
  credentials text,
  status public.guru_application_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guru_applications ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Admins manage guru applications" ON public.guru_applications;
CREATE POLICY "Admins manage guru applications"
ON public.guru_applications
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can create their guru application" ON public.guru_applications;
CREATE POLICY "Users can create their guru application"
ON public.guru_applications
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their guru applications" ON public.guru_applications;
CREATE POLICY "Users can view their guru applications"
ON public.guru_applications
FOR SELECT
USING (user_id = auth.uid());

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.trg_update_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_guru_app_updated_at ON public.guru_applications;
CREATE TRIGGER set_guru_app_updated_at
BEFORE UPDATE ON public.guru_applications
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

-- On approval, grant 'guru' role if not already
CREATE OR REPLACE FUNCTION public.apply_guru_approval()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT NEW.user_id, 'guru'::app_role
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'guru'::app_role
    );
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_guru_approval ON public.guru_applications;
CREATE TRIGGER trg_guru_approval
AFTER UPDATE ON public.guru_applications
FOR EACH ROW EXECUTE FUNCTION public.apply_guru_approval();