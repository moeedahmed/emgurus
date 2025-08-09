-- Create curriculum_slos if missing and seed demo SLOs
CREATE TABLE IF NOT EXISTS public.curriculum_slos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_slos_code ON public.curriculum_slos(code);

ALTER TABLE public.curriculum_slos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='curriculum_slos' AND policyname='Public can view SLOs'
  ) THEN
    CREATE POLICY "Public can view SLOs" ON public.curriculum_slos FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='curriculum_slos' AND policyname='Admins manage SLOs'
  ) THEN
    CREATE POLICY "Admins manage SLOs" ON public.curriculum_slos FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
  END IF;
END $$;

WITH slos(code, title) AS (
  VALUES
    ('SLO1','Resuscitation & Cardiac Arrest'),
    ('SLO2','Cardiovascular Emergencies'),
    ('SLO3','Breathlessness & Respiratory'),
    ('SLO4','Abdominal & GI'),
    ('SLO5','Injury & Trauma'),
    ('SLO6','Paediatrics'),
    ('SLO7','Toxicology & Envenomation'),
    ('SLO8','ECG & Arrhythmias'),
    ('SLO9','Imaging & Clinical Decision Rules'),
    ('SLO10','Ethics / Governance / Safety')
)
INSERT INTO public.curriculum_slos (id, code, title)
SELECT gen_random_uuid(), s.code, s.title
FROM slos s
WHERE NOT EXISTS (
  SELECT 1 FROM public.curriculum_slos c WHERE c.code = s.code
);