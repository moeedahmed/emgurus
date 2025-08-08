-- Add new enum value for reminder_type if missing, and set default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'reminder_type' AND e.enumlabel = 'one_hour_before'
  ) THEN
    ALTER TYPE public.reminder_type ADD VALUE 'one_hour_before';
  END IF;
END $$;

-- Set default to one_hour_before for future inserts
ALTER TABLE public.consult_reminders
  ALTER COLUMN reminder_type SET DEFAULT 'one_hour_before';