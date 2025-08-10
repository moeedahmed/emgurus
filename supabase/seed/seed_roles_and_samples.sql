-- Seed: Roles and Sample Content for QA
-- NOTE: Replace placeholders before running in Supabase SQL Editor
-- __USER_ID_AUTHOR__  : UUID of a regular user (author)
-- __USER_ID_GURU__    : UUID of a user with guru role
-- __USER_ID_ADMIN__   : UUID of an admin user

-- 1) Roles (idempotent)
insert into public.user_roles (user_id, role)
values
  ('__USER_ID_AUTHOR__', 'user'),
  ('__USER_ID_GURU__',   'guru'),
  ('__USER_ID_ADMIN__',  'admin')
on conflict (user_id, role) do nothing;

-- 2) Demo Blog Posts
-- Draft owned by author
insert into public.blog_posts (title, slug, description, author_id, status)
values ('Demo: Draft Sample', 'demo-draft-sample', 'Seeded demo draft', '__USER_ID_AUTHOR__', 'draft')
returning id;

-- In review owned by author
insert into public.blog_posts (title, slug, description, author_id, status, submitted_at)
values ('Demo: Review Pending', 'demo-review-pending', 'Seeded demo in-review', '__USER_ID_AUTHOR__', 'in_review', now())
returning id;

-- 3) Optional: assign reviewer for the in_review post (if table exists)
-- Will safely no-op if table missing
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='blog_review_assignments'
  ) then
    insert into public.blog_review_assignments (post_id, reviewer_id, assigned_by, notes)
    select p.id, '__USER_ID_GURU__', '__USER_ID_ADMIN__', 'DEMO assignment'
    from public.blog_posts p
    where p.slug = 'demo-review-pending'
    on conflict do nothing;

    insert into public.blog_review_logs (post_id, actor_id, action, note)
    select p.id, '__USER_ID_ADMIN__', 'assign', 'DEMO assign via seed'
    from public.blog_posts p
    where p.slug = 'demo-review-pending';
  end if;
end $$;

-- 4) Demo Exam Questions (optional; structure may vary by branch)
-- Create a draft question (skip if table not present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='exam_questions' AND column_name='stem'
  ) THEN
    INSERT INTO public.exam_questions (stem, choices, correct_index, explanation, tags, exam_type, status, created_by)
    VALUES ('Demo: Draft Question', '["A","B","C","D"]'::jsonb, 0, 'Demo explanation', ARRAY['demo'], 'OTHER', 'draft', '__USER_ID_AUTHOR__');
  END IF;
END $$;

-- Create an in-review question (skip if table not present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='exam_questions' AND column_name='stem'
  ) THEN
    INSERT INTO public.exam_questions (stem, choices, correct_index, explanation, tags, exam_type, status, created_by)
    VALUES ('Demo: In Review Question', '["A","B","C","D"]'::jsonb, 1, 'Demo explanation', ARRAY['demo'], 'OTHER', 'in_review', '__USER_ID_AUTHOR__');
  END IF;
END $$;

-- Optional exam review assignment (commented; enable if your table/columns match)
-- insert into public.review_assignments (question_id, guru_id, status)
-- values ('<DEMO_QUESTION_ID>', '__USER_ID_GURU__', 'pending');
