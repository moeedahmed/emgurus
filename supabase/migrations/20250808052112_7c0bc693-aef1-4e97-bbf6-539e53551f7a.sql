-- Step 2: Set default to one_hour_before for future inserts
ALTER TABLE public.consult_reminders
  ALTER COLUMN reminder_type SET DEFAULT 'one_hour_before';