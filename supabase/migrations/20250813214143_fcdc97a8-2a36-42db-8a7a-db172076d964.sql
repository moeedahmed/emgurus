-- 1) Create discussion table for per-question chat
create table if not exists public.exam_question_discussions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  author_id uuid not null,
  message text not null,
  kind text not null default 'comment', -- comment | feedback | system
  created_at timestamptz not null default now()
);

alter table public.exam_question_discussions enable row level security;

-- Index for performance
create index if not exists idx_eqd_question_id on public.exam_question_discussions(question_id);

-- RLS policies (drop then create to avoid duplicates)
-- SELECT policies
drop policy if exists "Admins view discussions" on public.exam_question_discussions;
create policy "Admins view discussions"
  on public.exam_question_discussions
  for select
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Authors view own messages" on public.exam_question_discussions;
create policy "Authors view own messages"
  on public.exam_question_discussions
  for select
  using (author_id = auth.uid());

drop policy if exists "Assigned gurus view discussions" on public.exam_question_discussions;
create policy "Assigned gurus view discussions"
  on public.exam_question_discussions
  for select
  using (exists (
    select 1 from public.exam_review_assignments a
    where a.question_id = exam_question_discussions.question_id
      and (a.reviewer_id = auth.uid() or a.assigned_by = auth.uid())
  ));

drop policy if exists "Question creator views discussions" on public.exam_question_discussions;
create policy "Question creator views discussions"
  on public.exam_question_discussions
  for select
  using (exists (
    select 1 from public.exam_questions q where q.id = exam_question_discussions.question_id and q.created_by = auth.uid()
  ));

-- INSERT policies
drop policy if exists "Admins insert discussions" on public.exam_question_discussions;
create policy "Admins insert discussions"
  on public.exam_question_discussions
  for insert
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Assigned gurus insert discussions" on public.exam_question_discussions;
create policy "Assigned gurus insert discussions"
  on public.exam_question_discussions
  for insert
  with check (exists (
    select 1 from public.exam_review_assignments a
    where a.question_id = exam_question_discussions.question_id
      and (a.reviewer_id = auth.uid() or a.assigned_by = auth.uid())
  ));

drop policy if exists "Question creator insert discussions" on public.exam_question_discussions;
create policy "Question creator insert discussions"
  on public.exam_question_discussions
  for insert
  with check (exists (
    select 1 from public.exam_questions q where q.id = exam_question_discussions.question_id and q.created_by = auth.uid()
  ));


-- 2) Ensure exam_review_assignments can be inserted/updated and unique assignment per guru
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.exam_review_assignments'::regclass
      AND conname = 'exam_review_assignments_question_reviewer_key'
  ) THEN
    ALTER TABLE public.exam_review_assignments
      ADD CONSTRAINT exam_review_assignments_question_reviewer_key UNIQUE (question_id, reviewer_id);
  END IF;
END $$;

-- Policies for exam_review_assignments
drop policy if exists "Admins manage exam_review_assignments" on public.exam_review_assignments;
create policy "Admins manage exam_review_assignments"
  on public.exam_review_assignments
  for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- reviewers can update their own row
drop policy if exists "Reviewers update own assignment" on public.exam_review_assignments;
create policy "Reviewers update own assignment"
  on public.exam_review_assignments
  for update
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid());

-- admins insert
drop policy if exists "Admins insert assignments" on public.exam_review_assignments;
create policy "Admins insert assignments"
  on public.exam_review_assignments
  for insert
  with check (public.has_role(auth.uid(), 'admin'));


-- 3) Trigger: when a question is flagged, mirror the feedback into discussions
create or replace function public._log_flag_to_discussion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.exam_question_discussions(question_id, author_id, message, kind)
  values (NEW.question_id, NEW.flagged_by, coalesce(NEW.comment,'(no comment)'), 'feedback');
  return NEW;
end; $$;

-- Drop if exists to avoid duplicates, then recreate
DROP TRIGGER IF EXISTS trg_flag_to_discussion ON public.exam_question_flags;
create trigger trg_flag_to_discussion
after insert on public.exam_question_flags
for each row execute function public._log_flag_to_discussion();


-- 4) Enforce publish requires all assigned gurus approve
create or replace function public.exam_publish(p_question_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $$
declare v_uid uuid := public._require_auth(); v_is_admin boolean; v_pending int;
begin
  v_is_admin := public.has_role(v_uid,'admin');
  if not v_is_admin then raise exception 'Forbidden'; end if;

  select count(*) into v_pending
  from public.exam_review_assignments a
  where a.question_id = p_question_id
    and coalesce(lower(a.status), 'assigned') <> 'approved';

  -- If there are assignments, all must be approved
  if exists (select 1 from public.exam_review_assignments a where a.question_id = p_question_id) then
    if v_pending > 0 then
      raise exception 'All reviewers must approve before publishing';
    end if;
  end if;

  update public.review_exam_questions set status='published' where id = p_question_id;
  insert into public.review_publish_log(question_id, published_by) values (p_question_id, v_uid);
end $$;
