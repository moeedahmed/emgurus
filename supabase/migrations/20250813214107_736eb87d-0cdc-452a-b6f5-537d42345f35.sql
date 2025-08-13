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

-- RLS: viewable by admins, the author, assigned gurus, and question creator
create policy if not exists "Admins view discussions"
  on public.exam_question_discussions
  for select
  using (public.has_role(auth.uid(), 'admin'));

create policy if not exists "Authors view own messages"
  on public.exam_question_discussions
  for select
  using (author_id = auth.uid());

create policy if not exists "Assigned gurus view discussions"
  on public.exam_question_discussions
  for select
  using (exists (
    select 1 from public.exam_review_assignments a
    where a.question_id = exam_question_discussions.question_id
      and (a.reviewer_id = auth.uid() or a.assigned_by = auth.uid())
  ));

create policy if not exists "Question creator views discussions"
  on public.exam_question_discussions
  for select
  using (exists (
    select 1 from public.exam_questions q where q.id = exam_question_discussions.question_id and q.created_by = auth.uid()
  ));

-- Insert policies
create policy if not exists "Admins insert discussions"
  on public.exam_question_discussions
  for insert
  with check (public.has_role(auth.uid(), 'admin'));

create policy if not exists "Assigned gurus insert discussions"
  on public.exam_question_discussions
  for insert
  with check (exists (
    select 1 from public.exam_review_assignments a
    where a.question_id = exam_question_discussions.question_id
      and (a.reviewer_id = auth.uid() or a.assigned_by = auth.uid())
  ));

create policy if not exists "Question creator insert discussions"
  on public.exam_question_discussions
  for insert
  with check (exists (
    select 1 from public.exam_questions q where q.id = exam_question_discussions.question_id and q.created_by = auth.uid()
  ));


-- 2) Ensure exam_review_assignments can be inserted/updated and unique assignment per guru
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.exam_review_assignments'::regclass
      and conname = 'exam_review_assignments_question_reviewer_key'
  ) then
    alter table public.exam_review_assignments
      add constraint exam_review_assignments_question_reviewer_key unique (question_id, reviewer_id);
  end if;
end $$;

-- Add RLS policies to allow admin manage and reviewers update their own row
create policy if not exists "Admins manage exam_review_assignments"
  on public.exam_review_assignments
  for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy if not exists "Reviewers update own assignment"
  on public.exam_review_assignments
  for update
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid());

-- Allow admins to insert assignment rows
create policy if not exists "Admins insert assignments"
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
