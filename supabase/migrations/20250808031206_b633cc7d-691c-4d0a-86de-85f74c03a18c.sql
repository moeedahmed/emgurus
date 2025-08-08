-- Seed 5 sample Guru profiles, roles, and default weekly availability (Mon-Fri 10:00-14:00 local time)
-- Note: This migration inserts data only. It creates 5 guru profiles visible to the public consultations listing.

-- 1) Declare fixed UUIDs for deterministic references
-- Using explicit literals to reference across tables
-- Emily Carter (UK), Jason Miller (USA), Leila Al Mansoori (UAE), Arjun Mehta (India), Sophie Nguyen (Australia)

-- Upsert roles for gurus
WITH guru_ids(user_id, full_name) AS (
  VALUES
    ('6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340001'::uuid, 'Dr. Emily Carter'),
    ('6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340002'::uuid, 'Dr. Jason Miller'),
    ('6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340003'::uuid, 'Dr. Leila Al Mansoori'),
    ('6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340004'::uuid, 'Dr. Arjun Mehta'),
    ('6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340005'::uuid, 'Dr. Sophie Nguyen')
)
INSERT INTO public.user_roles (user_id, role)
SELECT g.user_id, 'guru'::public.app_role
FROM guru_ids g
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = g.user_id AND ur.role = 'guru'::public.app_role
);

-- 2) Insert profiles if missing
WITH profiles_data AS (
  SELECT * FROM (
    VALUES
      (
        '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340001'::uuid,
        'emily.carter@example.com',
        'Dr. Emily Carter',
        'Emergency Medicine',
        'United Kingdom',
        ARRAY['MRCEM SBA','FRCEM SBA']::text[],
        60::numeric,
        'UK-based EM physician and exam mentor.',
        'Europe/London'
      ),
      (
        '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340002'::uuid,
        'jason.miller@example.com',
        'Dr. Jason Miller',
        'Pediatrics',
        'United States',
        ARRAY['USMLE','PALS']::text[],
        70::numeric,
        'Pediatric specialist focused on USMLE prep.',
        'America/New_York'
      ),
      (
        '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340003'::uuid,
        'leila.almansoori@example.com',
        'Dr. Leila Al Mansoori',
        'Emergency Medicine',
        'United Arab Emirates',
        ARRAY['Arab Board','ACLS']::text[],
        55::numeric,
        'UAE-based consultant with Arab Board expertise.',
        'Asia/Dubai'
      ),
      (
        '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340004'::uuid,
        'arjun.mehta@example.com',
        'Dr. Arjun Mehta',
        'Internal Medicine',
        'India',
        ARRAY['MRCP Part 1','ACLS']::text[],
        40::numeric,
        'Indian internal medicine mentor and examiner.',
        'Asia/Kolkata'
      ),
      (
        '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340005'::uuid,
        'sophie.nguyen@example.com',
        'Dr. Sophie Nguyen',
        'Anesthesiology',
        'Australia',
        ARRAY['ANZCA Part 1','BLS']::text[],
        50::numeric,
        'Australia-based anesthesiologist guiding ANZCA prep.',
        'Australia/Sydney'
      )
  ) AS v(user_id, email, full_name, specialty, country, exams, price_per_30min, bio, timezone)
)
INSERT INTO public.profiles (user_id, email, full_name, specialty, country, exams, price_per_30min, bio, timezone)
SELECT v.user_id, v.email, v.full_name, v.specialty, v.country, v.exams, v.price_per_30min, v.bio, v.timezone
FROM profiles_data v
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = v.user_id
);

-- 3) Seed default weekly availability (Mon-Fri = 1..5) 10:00-14:00 local time
-- Note: Availability times are stored as naive times; timezone is read from profile when computing slots in the API.

-- Helper CTE for days of week
WITH days AS (
  SELECT unnest(ARRAY[1,2,3,4,5]) AS dow
)
-- Emily Carter
INSERT INTO public.consult_availability (guru_id, type, day_of_week, start_time, end_time, is_available)
SELECT '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340001'::uuid, 'default'::public.availability_type, d.dow, '10:00'::time, '14:00'::time, true
FROM days d
WHERE NOT EXISTS (
  SELECT 1 FROM public.consult_availability ca
  WHERE ca.guru_id = '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340001'::uuid
    AND ca.type = 'default'::public.availability_type
    AND ca.day_of_week = d.dow
);

WITH days AS (
  SELECT unnest(ARRAY[1,2,3,4,5]) AS dow
)
-- Jason Miller
INSERT INTO public.consult_availability (guru_id, type, day_of_week, start_time, end_time, is_available)
SELECT '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340002'::uuid, 'default'::public.availability_type, d.dow, '10:00'::time, '14:00'::time, true
FROM days d
WHERE NOT EXISTS (
  SELECT 1 FROM public.consult_availability ca
  WHERE ca.guru_id = '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340002'::uuid
    AND ca.type = 'default'::public.availability_type
    AND ca.day_of_week = d.dow
);

WITH days AS (
  SELECT unnest(ARRAY[1,2,3,4,5]) AS dow
)
-- Leila Al Mansoori
INSERT INTO public.consult_availability (guru_id, type, day_of_week, start_time, end_time, is_available)
SELECT '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340003'::uuid, 'default'::public.availability_type, d.dow, '10:00'::time, '14:00'::time, true
FROM days d
WHERE NOT EXISTS (
  SELECT 1 FROM public.consult_availability ca
  WHERE ca.guru_id = '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340003'::uuid
    AND ca.type = 'default'::public.availability_type
    AND ca.day_of_week = d.dow
);

WITH days AS (
  SELECT unnest(ARRAY[1,2,3,4,5]) AS dow
)
-- Arjun Mehta
INSERT INTO public.consult_availability (guru_id, type, day_of_week, start_time, end_time, is_available)
SELECT '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340004'::uuid, 'default'::public.availability_type, d.dow, '10:00'::time, '14:00'::time, true
FROM days d
WHERE NOT EXISTS (
  SELECT 1 FROM public.consult_availability ca
  WHERE ca.guru_id = '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340004'::uuid
    AND ca.type = 'default'::public.availability_type
    AND ca.day_of_week = d.dow
);

WITH days AS (
  SELECT unnest(ARRAY[1,2,3,4,5]) AS dow
)
-- Sophie Nguyen
INSERT INTO public.consult_availability (guru_id, type, day_of_week, start_time, end_time, is_available)
SELECT '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340005'::uuid, 'default'::public.availability_type, d.dow, '10:00'::time, '14:00'::time, true
FROM days d
WHERE NOT EXISTS (
  SELECT 1 FROM public.consult_availability ca
  WHERE ca.guru_id = '6b1f1c1a-2fa5-4a6a-9d2b-5d6a12340005'::uuid
    AND ca.type = 'default'::public.availability_type
    AND ca.day_of_week = d.dow
);
