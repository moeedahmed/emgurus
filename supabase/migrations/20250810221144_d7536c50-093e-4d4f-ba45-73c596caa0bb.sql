-- Migration: switch RPCs to SECURITY INVOKER to satisfy linter and rely on RLS

ALTER FUNCTION public.create_blog_draft(text, text, uuid, text[]) SECURITY INVOKER;
ALTER FUNCTION public.submit_blog_for_review(uuid) SECURITY INVOKER;
ALTER FUNCTION public.assign_reviewer(uuid, uuid, text) SECURITY INVOKER;
ALTER FUNCTION public.review_request_changes(uuid, text) SECURITY INVOKER;
ALTER FUNCTION public.review_approve_publish(uuid) SECURITY INVOKER;
ALTER FUNCTION public.list_my_drafts(int, int) SECURITY INVOKER;
ALTER FUNCTION public.list_my_submissions(int, int) SECURITY INVOKER;
ALTER FUNCTION public.list_reviewer_queue(int, int) SECURITY INVOKER;

ALTER FUNCTION public.create_exam_draft(text, jsonb, int, text, text[], public.exam_type_enum) SECURITY INVOKER;
ALTER FUNCTION public.submit_exam_for_review(uuid) SECURITY INVOKER;
ALTER FUNCTION public.exam_request_changes(uuid, text) SECURITY INVOKER;
ALTER FUNCTION public.exam_approve(uuid) SECURITY INVOKER;
ALTER FUNCTION public.exam_publish(uuid) SECURITY INVOKER;
ALTER FUNCTION public.list_exam_reviewer_queue(int, int) SECURITY INVOKER;
ALTER FUNCTION public.list_my_exam_drafts(int, int) SECURITY INVOKER;
ALTER FUNCTION public.list_my_exam_submissions(int, int) SECURITY INVOKER;