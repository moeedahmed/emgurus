-- Update blog_review_assignments table to support multi-reviewer workflow
ALTER TABLE public.blog_review_assignments ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.blog_review_assignments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Update exam_review_assignments table to support multi-reviewer workflow  
ALTER TABLE public.exam_review_assignments ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.exam_review_assignments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Add audit trail fields to blog_posts
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id);

-- Add audit trail fields to review_exam_questions (not exam_questions which is a view)
ALTER TABLE public.review_exam_questions ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.review_exam_questions ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id);

-- Add enum value for pending_review status if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid 
                   WHERE t.typname = 'review_assignment_status' AND e.enumlabel = 'pending_review') THEN
        ALTER TYPE review_assignment_status ADD VALUE 'pending_review';
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Type might not exist, ignore
    NULL;
END $$;

-- Update blog review assignment trigger to populate assigned_at
CREATE OR REPLACE FUNCTION public.touch_blog_assignment_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.assigned_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS blog_review_assignments_assigned_at ON public.blog_review_assignments;
CREATE TRIGGER blog_review_assignments_assigned_at
  BEFORE INSERT ON public.blog_review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_blog_assignment_assigned_at();

-- Update exam review assignment trigger to populate assigned_at
CREATE OR REPLACE FUNCTION public.touch_exam_assignment_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.assigned_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exam_review_assignments_assigned_at ON public.exam_review_assignments;
CREATE TRIGGER exam_review_assignments_assigned_at
  BEFORE INSERT ON public.exam_review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_exam_assignment_assigned_at();