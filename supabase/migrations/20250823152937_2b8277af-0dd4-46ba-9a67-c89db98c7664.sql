-- Force drop the reviewer_id column with CASCADE to remove all dependent policies
ALTER TABLE public.blog_posts DROP COLUMN reviewer_id CASCADE;

-- Recreate necessary policies that were dropped

-- Recreate taxonomy_post_terms policies without reviewer_id dependency
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

-- Recreate blog_post_discussions policies without reviewer_id dependency
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