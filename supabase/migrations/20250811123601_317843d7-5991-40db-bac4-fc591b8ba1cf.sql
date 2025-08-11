-- Enums for the new features
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flag_status') THEN
    CREATE TYPE public.flag_status AS ENUM ('open','assigned','resolved','removed','archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE public.notification_type AS ENUM ('question_flagged','flag_assigned','flag_resolved','assignment_created','message','system');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'currency_code') THEN
    CREATE TYPE public.currency_code AS ENUM ('USD','GBP','PKR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_set_status') THEN
    CREATE TYPE public.question_set_status AS ENUM ('draft','published','archived');
  END IF;
END $$;

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS for notifications
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users view own notifications'
  ) THEN
    CREATE POLICY "Users view own notifications" ON public.notifications
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users update own notifications'
  ) THEN
    CREATE POLICY "Users update own notifications" ON public.notifications
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users insert own notifications or admin any'
  ) THEN
    CREATE POLICY "Users insert own notifications or admin any" ON public.notifications
      FOR INSERT WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Admins manage all notifications'
  ) THEN
    CREATE POLICY "Admins manage all notifications" ON public.notifications
      FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Exam question flags table
CREATE TABLE IF NOT EXISTS public.exam_question_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  question_source text NOT NULL DEFAULT 'reviewed', -- e.g., 'reviewed', 'ai', etc.
  flagged_by uuid NOT NULL,
  comment text,
  status public.flag_status NOT NULL DEFAULT 'open',
  assigned_to uuid,
  resolved_by uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_question_flags ENABLE ROW LEVEL SECURITY;

-- RLS for flags
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'exam_question_flags' AND policyname = 'Users insert own flags'
  ) THEN
    CREATE POLICY "Users insert own flags" ON public.exam_question_flags
      FOR INSERT WITH CHECK (flagged_by = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'exam_question_flags' AND policyname = 'Users view own flags'
  ) THEN
    CREATE POLICY "Users view own flags" ON public.exam_question_flags
      FOR SELECT USING (flagged_by = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'exam_question_flags' AND policyname = 'Admins view/manage all flags'
  ) THEN
    CREATE POLICY "Admins view/manage all flags" ON public.exam_question_flags
      FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'exam_question_flags' AND policyname = 'Gurus view assigned flags'
  ) THEN
    CREATE POLICY "Gurus view assigned flags" ON public.exam_question_flags
      FOR SELECT USING (assigned_to = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'exam_question_flags' AND policyname = 'Gurus update assigned flags'
  ) THEN
    CREATE POLICY "Gurus update assigned flags" ON public.exam_question_flags
      FOR UPDATE USING (assigned_to = auth.uid()) WITH CHECK (assigned_to = auth.uid());
  END IF;
END $$;

-- updated_at trigger for flags
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_exam_question_flags_updated'
  ) THEN
    CREATE TRIGGER trg_exam_question_flags_updated
      BEFORE UPDATE ON public.exam_question_flags
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Question sets for organizing and pricing reviewed questions
CREATE TABLE IF NOT EXISTS public.question_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  tags text[] NOT NULL DEFAULT '{}',
  currency public.currency_code NOT NULL DEFAULT 'USD',
  price_cents integer NOT NULL DEFAULT 0,
  status public.question_set_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.question_sets ENABLE ROW LEVEL SECURITY;

-- RLS for question_sets
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'question_sets' AND policyname = 'Admins manage question sets'
  ) THEN
    CREATE POLICY "Admins manage question sets" ON public.question_sets
      FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'question_sets' AND policyname = 'Public read published sets'
  ) THEN
    CREATE POLICY "Public read published sets" ON public.question_sets
      FOR SELECT USING (status = 'published');
  END IF;
END $$;

-- updated_at trigger for question_sets
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_question_sets_updated'
  ) THEN
    CREATE TRIGGER trg_question_sets_updated
      BEFORE UPDATE ON public.question_sets
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.question_set_items (
  set_id uuid NOT NULL REFERENCES public.question_sets(id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (set_id, question_id)
);

ALTER TABLE public.question_set_items ENABLE ROW LEVEL SECURITY;

-- RLS for items
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'question_set_items' AND policyname = 'Admins manage set items'
  ) THEN
    CREATE POLICY "Admins manage set items" ON public.question_set_items
      FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'question_set_items' AND policyname = 'Public read items from published sets'
  ) THEN
    CREATE POLICY "Public read items from published sets" ON public.question_set_items
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.question_sets s
          WHERE s.id = question_set_items.set_id AND s.status = 'published'
        )
      );
  END IF;
END $$;

-- Notification triggers for lifecycle events on flags
CREATE OR REPLACE FUNCTION public._notify_admins_on_flag()
RETURNS trigger AS $$
DECLARE
  admin_rec RECORD;
BEGIN
  FOR admin_rec IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      admin_rec.user_id,
      'question_flagged',
      'Question flagged for review',
      coalesce(NEW.comment,'(no comment)'),
      jsonb_build_object('flag_id', NEW.id, 'question_id', NEW.question_id, 'source', NEW.question_source)
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public._notify_on_flag_assignment()
RETURNS trigger AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.assigned_to,
      'flag_assigned',
      'New question assigned for review',
      coalesce(NEW.comment,'(no comment)'),
      jsonb_build_object('flag_id', NEW.id, 'question_id', NEW.question_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public._notify_on_flag_resolution()
RETURNS trigger AS $$
DECLARE
  admin_rec RECORD;
  msg text;
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status IN ('resolved','removed','archived') THEN
    msg := coalesce(NEW.resolution_note,'');
    -- Notify original flagger
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.flagged_by,
      'flag_resolved',
      'Your flagged question was processed',
      msg,
      jsonb_build_object('flag_id', NEW.id, 'question_id', NEW.question_id, 'status', NEW.status)
    );
    -- Notify admins
    FOR admin_rec IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        admin_rec.user_id,
        'flag_resolved',
        'Flag processed',
        msg,
        jsonb_build_object('flag_id', NEW.id, 'question_id', NEW.question_id, 'status', NEW.status)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_exam_flag_notify_admins'
  ) THEN
    CREATE TRIGGER trg_exam_flag_notify_admins
      AFTER INSERT ON public.exam_question_flags
      FOR EACH ROW EXECUTE FUNCTION public._notify_admins_on_flag();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_exam_flag_notify_assignment'
  ) THEN
    CREATE TRIGGER trg_exam_flag_notify_assignment
      AFTER UPDATE OF assigned_to ON public.exam_question_flags
      FOR EACH ROW EXECUTE FUNCTION public._notify_on_flag_assignment();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_exam_flag_notify_resolution'
  ) THEN
    CREATE TRIGGER trg_exam_flag_notify_resolution
      AFTER UPDATE OF status ON public.exam_question_flags
      FOR EACH ROW EXECUTE FUNCTION public._notify_on_flag_resolution();
  END IF;
END $$;
