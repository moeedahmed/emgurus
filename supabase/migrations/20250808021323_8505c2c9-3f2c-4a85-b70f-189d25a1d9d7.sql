-- Seed/normalize minimal guru profile values and availability for existing guru accounts
DO $$
BEGIN
  -- Ensure at least one guru has baseline profile fields filled
  UPDATE public.profiles p
  SET 
    specialty = COALESCE(p.specialty, 'Emergency Medicine'),
    country = COALESCE(p.country, 'UK'),
    exams = COALESCE(p.exams, ARRAY['MRCEM SBA']::text[]),
    price_per_30min = COALESCE(p.price_per_30min, 30),
    timezone = COALESCE(p.timezone, 'Europe/London'),
    bio = COALESCE(p.bio, 'Demo guru available for consultations.')
  FROM public.user_roles ur
  WHERE ur.user_id = p.user_id
    AND ur.role = 'guru'::app_role;

  -- Insert default weekday availability (Mon–Fri 09:00–12:00) for gurus that have none for a given day
  INSERT INTO public.consult_availability (guru_id, type, day_of_week, start_time, end_time, is_available)
  SELECT g.user_id, 'default'::availability_type, d::smallint, TIME '09:00', TIME '12:00', true
  FROM (
    SELECT DISTINCT p.user_id
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'guru'::app_role
  ) AS g
  CROSS JOIN generate_series(1,5) AS day(d)
  LEFT JOIN public.consult_availability ca 
    ON ca.guru_id = g.user_id AND ca.type = 'default'::availability_type AND ca.day_of_week = day.d
  WHERE ca.id IS NULL;
END $$;