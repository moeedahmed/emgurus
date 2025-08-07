-- Add RCEM-specific exam types and enhance question schema
ALTER TYPE public.exam_type ADD VALUE 'MRCEM_PRIMARY';
ALTER TYPE public.exam_type ADD VALUE 'MRCEM_SBA';
ALTER TYPE public.exam_type ADD VALUE 'FRCEM_SBA';

-- Create knowledge_base table for uploaded PDFs
CREATE TABLE public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_url TEXT,
  exam_type exam_type,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create SLOs (Student Learning Outcomes) table
CREATE TABLE public.slos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  exam_type exam_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add SLO reference to questions table
ALTER TABLE public.questions ADD COLUMN slo_id UUID REFERENCES public.slos(id);
ALTER TABLE public.questions ADD COLUMN syllabus_code TEXT;
ALTER TABLE public.questions ADD COLUMN rationale TEXT;

-- Enable RLS for new tables
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for knowledge_base
CREATE POLICY "Users can view knowledge base" ON public.knowledge_base
  FOR SELECT USING (true);

CREATE POLICY "Gurus can upload to knowledge base" ON public.knowledge_base
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'guru') OR public.has_role(auth.uid(), 'admin'));

-- Create RLS policies for SLOs
CREATE POLICY "Users can view SLOs" ON public.slos
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage SLOs" ON public.slos
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Insert some FRCEM SLOs
INSERT INTO public.slos (code, description, exam_type) VALUES
('FRCEM.1.1', 'Clinical Decision Making', 'FRCEM_SBA'),
('FRCEM.1.2', 'Patient Assessment', 'FRCEM_SBA'),
('FRCEM.1.3', 'Emergency Procedures', 'FRCEM_SBA'),
('FRCEM.2.1', 'Resuscitation', 'FRCEM_SBA'),
('FRCEM.2.2', 'Trauma Management', 'FRCEM_SBA'),
('MRCEM.1.1', 'Basic Sciences', 'MRCEM_PRIMARY'),
('MRCEM.1.2', 'Pathophysiology', 'MRCEM_PRIMARY'),
('MRCEM.2.1', 'Clinical Reasoning', 'MRCEM_SBA'),
('MRCEM.2.2', 'Emergency Medicine Principles', 'MRCEM_SBA');