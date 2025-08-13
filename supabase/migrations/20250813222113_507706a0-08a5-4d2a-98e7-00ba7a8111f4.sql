-- Allow admins to delete discussion messages in the question chat
CREATE POLICY "Admins can delete discussions"
ON public.exam_question_discussions
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));