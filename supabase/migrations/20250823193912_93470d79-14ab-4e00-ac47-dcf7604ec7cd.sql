-- Create blog_shares table for tracking social media shares
CREATE TABLE IF NOT EXISTS public.blog_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  platform text NOT NULL,
  shared_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_shares_post_id ON public.blog_shares(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_shares_user_id ON public.blog_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_shares_platform ON public.blog_shares(platform);
CREATE INDEX IF NOT EXISTS idx_blog_shares_shared_at ON public.blog_shares(shared_at);

-- Enable RLS
ALTER TABLE public.blog_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blog_shares
CREATE POLICY "Public can read blog shares" 
  ON public.blog_shares 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can track their own shares" 
  ON public.blog_shares 
  FOR INSERT 
  WITH CHECK (true); -- Allow anonymous sharing

CREATE POLICY "Admins can manage all shares" 
  ON public.blog_shares 
  FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));