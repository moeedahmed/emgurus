-- Seed next 5 weekdays (UK time 09:00-12:00) for the specified Guru
-- Guru: 080c2b2d-2b51-4484-9027-a037216c3a7c
-- Dates chosen: 2025-08-11 to 2025-08-15 (Mon-Fri)

BEGIN;

-- Clean any existing date-specific availability for these days to avoid duplicates
DELETE FROM public.consult_availability
WHERE guru_id = '080c2b2d-2b51-4484-9027-a037216c3a7c'
  AND date IN ('2025-08-11', '2025-08-12', '2025-08-13', '2025-08-14', '2025-08-15');

-- Insert availability blocks (09:00-12:00) as date-specific entries
INSERT INTO public.consult_availability (guru_id, date, start_time, end_time, is_available, type)
VALUES
  ('080c2b2d-2b51-4484-9027-a037216c3a7c', '2025-08-11', '09:00', '12:00', true, 'exception'),
  ('080c2b2d-2b51-4484-9027-a037216c3a7c', '2025-08-12', '09:00', '12:00', true, 'exception'),
  ('080c2b2b-2b51-4484-9027-a037216c3a7c', '2025-08-13', '09:00', '12:00', true, 'exception'),
  ('080c2b2d-2b51-4484-9027-a037216c3a7c', '2025-08-14', '09:00', '12:00', true, 'exception'),
  ('080c2b2d-2b51-4484-9027-a037216c3a7c', '2025-08-15', '09:00', '12:00', true, 'exception');

COMMIT;
