-- Create blog_post_discussions table
CREATE TABLE public.blog_post_discussions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  message TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'comment',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for performance
CREATE INDEX idx_blog_post_discussions_post_created ON public.blog_post_discussions (post_id, created_at);

-- Enable RLS
ALTER TABLE public.blog_post_discussions ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- All authenticated users with access to the post can SELECT
CREATE POLICY "Users can view discussions for posts they can access" 
ON public.blog_post_discussions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.blog_posts bp 
    WHERE bp.id = post_id 
    AND (
      bp.status = 'published' 
      OR bp.author_id = auth.uid() 
      OR bp.reviewer_id = auth.uid() 
      OR bp.reviewed_by = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- INSERT allowed if role ∈ {admin,guru}
CREATE POLICY "Admins and gurus can insert discussions" 
ON public.blog_post_discussions 
FOR INSERT 
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role))
  AND auth.uid() = author_id
  AND EXISTS (
    SELECT 1 FROM public.blog_posts bp 
    WHERE bp.id = post_id 
    AND (
      bp.author_id = auth.uid() 
      OR bp.reviewer_id = auth.uid() 
      OR bp.reviewed_by = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- DELETE only if role='admin' or author is same user
CREATE POLICY "Admins can delete any discussion or users can delete their own" 
ON public.blog_post_discussions 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR auth.uid() = author_id
);