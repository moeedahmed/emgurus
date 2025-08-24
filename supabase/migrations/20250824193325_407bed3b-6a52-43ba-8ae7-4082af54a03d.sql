-- Add audit trail fields to review_exam_questions if they don't exist
DO $$ 
BEGIN
    -- Check and add submitted_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'review_exam_questions' 
                   AND column_name = 'submitted_at') THEN
        ALTER TABLE public.review_exam_questions ADD COLUMN submitted_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Check and add assigned_to column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'review_exam_questions' 
                   AND column_name = 'assigned_to') THEN
        ALTER TABLE public.review_exam_questions ADD COLUMN assigned_to UUID;
    END IF;
    
    -- Check and add assigned_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'review_exam_questions' 
                   AND column_name = 'assigned_by') THEN
        ALTER TABLE public.review_exam_questions ADD COLUMN assigned_by UUID;
    END IF;
    
    -- Check and add reviewed_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'review_exam_questions' 
                   AND column_name = 'reviewed_by') THEN
        ALTER TABLE public.review_exam_questions ADD COLUMN reviewed_by UUID;
    END IF;
    
    -- Check and add reviewed_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'review_exam_questions' 
                   AND column_name = 'reviewed_at') THEN
        ALTER TABLE public.review_exam_questions ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Check and add published_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'review_exam_questions' 
                   AND column_name = 'published_at') THEN
        ALTER TABLE public.review_exam_questions ADD COLUMN published_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create exam_review_assignments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.exam_review_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id UUID NOT NULL,
    reviewer_id UUID NOT NULL,
    assigned_by UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review',
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on exam_review_assignments
ALTER TABLE public.exam_review_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for exam_review_assignments
CREATE POLICY "Admins manage exam_review_assignments" ON public.exam_review_assignments
    FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Assigned reviewers view their assignments" ON public.exam_review_assignments
    FOR SELECT USING (reviewer_id = auth.uid());

CREATE POLICY "Assigners view their assignments" ON public.exam_review_assignments
    FOR SELECT USING (assigned_by = auth.uid());

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER update_exam_review_assignments_updated_at
    BEFORE UPDATE ON public.exam_review_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_review_assignments_reviewer_id ON public.exam_review_assignments(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_exam_review_assignments_question_id ON public.exam_review_assignments(question_id);
CREATE INDEX IF NOT EXISTS idx_exam_review_assignments_status ON public.exam_review_assignments(status);