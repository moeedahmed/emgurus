-- Create blog_post_feedback table for blog feedback system
CREATE TABLE IF NOT EXISTS public.blog_post_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'resolved', 'archived')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by uuid,
  resolution_note text
);

-- Enable RLS
ALTER TABLE public.blog_post_feedback ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_blog_post_feedback_post_id_created_at ON public.blog_post_feedback(post_id, created_at);
CREATE INDEX idx_blog_post_feedback_user_id_created_at ON public.blog_post_feedback(user_id, created_at);
CREATE INDEX idx_blog_post_feedback_status ON public.blog_post_feedback(status);

-- RLS Policies
CREATE POLICY "Users can submit feedback for published posts" 
ON public.blog_post_feedback 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.blog_posts 
    WHERE id = blog_post_feedback.post_id 
    AND status = 'published'
  )
);

CREATE POLICY "Users can view their own feedback" 
ON public.blog_post_feedback 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins and gurus can view all feedback" 
ON public.blog_post_feedback 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'guru')
);

CREATE POLICY "Admins and gurus can update feedback" 
ON public.blog_post_feedback 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'guru')
);