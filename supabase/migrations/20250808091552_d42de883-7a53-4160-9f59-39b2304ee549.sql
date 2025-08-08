-- Fix seed insert by casting kind to taxonomy_type and make idempotent
INSERT INTO public.taxonomy_terms (slug, title, kind, description)
VALUES
  ('emergency-medicine','Emergency Medicine','specialty'::public.taxonomy_type,''),
  ('cardiology','Cardiology','specialty'::public.taxonomy_type,''),
  ('endocrinology','Endocrinology','specialty'::public.taxonomy_type,''),
  ('respiratory','Respiratory','specialty'::public.taxonomy_type,''),
  ('neurology','Neurology','specialty'::public.taxonomy_type,''),
  ('radiology','Radiology','specialty'::public.taxonomy_type,''),
  ('obstetrics-gynecology','Obstetrics & Gynecology','specialty'::public.taxonomy_type,''),
  ('pediatrics','Paediatrics','specialty'::public.taxonomy_type,''),
  ('internal-medicine','Internal Medicine','specialty'::public.taxonomy_type,''),
  ('surgery','Surgery','specialty'::public.taxonomy_type,''),
  ('clinical-skills','Clinical Skills','topic'::public.taxonomy_type,''),
  ('ethics','Ethics','topic'::public.taxonomy_type,''),
  ('global-health','Global Health','topic'::public.taxonomy_type,''),
  ('career-guidance','Career Guidance','topic'::public.taxonomy_type,'')
ON CONFLICT (slug) DO NOTHING;