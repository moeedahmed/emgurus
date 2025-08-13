-- Allow admins to delete discussion messages in the question chat
CREATE POLICY IF NOT EXISTS "Admins can delete discussions"
ON public.exam_question_discussions
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));