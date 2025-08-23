-- Add is_featured column to blog_posts table
ALTER TABLE public.blog_posts 
ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;

-- Create index for better performance when filtering featured posts
CREATE INDEX idx_blog_posts_is_featured ON public.blog_posts(is_featured) WHERE is_featured = true;

-- Update RLS policies to allow admins to manage featured status
CREATE POLICY "Admins can update featured status" 
ON public.blog_posts 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));