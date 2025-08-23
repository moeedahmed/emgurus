-- Update all policies that depend on reviewer_id before dropping the column

-- 1. Update taxonomy_post_terms policies
DROP POLICY IF EXISTS "Authors/Reviewers/Admin manage post taxonomy" ON public.taxonomy_post_terms;
DROP POLICY IF EXISTS "Authors/Reviewers/Admin can delete post taxonomy" ON public.taxonomy_post_terms;

CREATE POLICY "Authors/Assigned Reviewers/Admin manage post taxonomy" ON public.taxonomy_post_terms
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  EXISTS (
    SELECT 1 FROM public.blog_posts bp 
    WHERE bp.id = taxonomy_post_terms.post_id 
    AND (
      bp.author_id = auth.uid() OR 
      bp.reviewed_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.blog_review_assignments bra
        WHERE bra.post_id = bp.id 
        AND bra.reviewer_id = auth.uid() 
        AND bra.status = 'pending'
      )
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  EXISTS (
    SELECT 1 FROM public.blog_posts bp 
    WHERE bp.id = taxonomy_post_terms.post_id 
    AND (
      bp.author_id = auth.uid() OR 
      bp.reviewed_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.blog_review_assignments bra
        WHERE bra.post_id = bp.id 
        AND bra.reviewer_id = auth.uid() 
        AND bra.status = 'pending'
      )
    )
  )
);

-- 2. Update blog_post_discussions policies  
DROP POLICY IF EXISTS "Users can view discussions for posts they can access" ON public.blog_post_discussions;
DROP POLICY IF EXISTS "Admins and gurus can insert discussions" ON public.blog_post_discussions;

CREATE POLICY "Users can view discussions for accessible posts" ON public.blog_post_discussions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.blog_posts bp
    WHERE bp.id = blog_post_discussions.post_id 
    AND (
      bp.status = 'published'::blog_post_status OR 
      bp.author_id = auth.uid() OR 
      bp.reviewed_by = auth.uid() OR 
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.blog_review_assignments bra
        WHERE bra.post_id = bp.id 
        AND bra.reviewer_id = auth.uid() 
        AND bra.status = 'pending'
      )
    )
  )
);

CREATE POLICY "Admins and assigned gurus can insert discussions" ON public.blog_post_discussions
FOR INSERT WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role)) 
  AND (auth.uid() = author_id) 
  AND EXISTS (
    SELECT 1 FROM public.blog_posts bp
    WHERE bp.id = blog_post_discussions.post_id 
    AND (
      bp.author_id = auth.uid() OR 
      bp.reviewed_by = auth.uid() OR 
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.blog_review_assignments bra
        WHERE bra.post_id = bp.id 
        AND bra.reviewer_id = auth.uid() 
        AND bra.status = 'pending'
      )
    )
  )
);

-- Now it should be safe to drop the reviewer_id column
ALTER TABLE public.blog_posts DROP COLUMN IF EXISTS reviewer_id;