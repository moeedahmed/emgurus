-- Create RCEM SLOs (baseline reference data)
CREATE TABLE IF NOT EXISTS public.rcem_slos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  exam exam_type_enum,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create knowledge base table
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  exam_type exam_type_enum NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create knowledge base to taxonomy terms pivot
CREATE TABLE IF NOT EXISTS public.knowledge_base_terms (
  kb_id UUID NOT NULL REFERENCES public.knowledge_base(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES public.taxonomy_terms(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (kb_id, term_id)
);

-- Create knowledge base to curriculum SLOs pivot
CREATE TABLE IF NOT EXISTS public.knowledge_base_slos (
  kb_id UUID NOT NULL REFERENCES public.knowledge_base(id) ON DELETE CASCADE,
  slo_id UUID NOT NULL REFERENCES public.curriculum_slos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (kb_id, slo_id)
);

-- Enable RLS
ALTER TABLE public.rcem_slos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_slos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rcem_slos (baseline read-only reference)
CREATE POLICY "Public can read RCEM SLOs" ON public.rcem_slos
  FOR SELECT USING (true);

CREATE POLICY "Admins manage RCEM SLOs" ON public.rcem_slos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for knowledge_base
CREATE POLICY "Public can read knowledge base" ON public.knowledge_base
  FOR SELECT USING (true);

CREATE POLICY "Admins manage knowledge base" ON public.knowledge_base
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gurus manage knowledge base" ON public.knowledge_base
  FOR ALL USING (has_role(auth.uid(), 'guru'::app_role))
  WITH CHECK (has_role(auth.uid(), 'guru'::app_role));

-- RLS Policies for KB pivot tables
CREATE POLICY "Public can read KB terms" ON public.knowledge_base_terms
  FOR SELECT USING (true);

CREATE POLICY "Admins/Gurus manage KB terms" ON public.knowledge_base_terms
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role));

CREATE POLICY "Public can read KB SLOs" ON public.knowledge_base_slos
  FOR SELECT USING (true);

CREATE POLICY "Admins/Gurus manage KB SLOs" ON public.knowledge_base_slos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_rcem_slos_updated_at
  BEFORE UPDATE ON public.rcem_slos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON public.knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();