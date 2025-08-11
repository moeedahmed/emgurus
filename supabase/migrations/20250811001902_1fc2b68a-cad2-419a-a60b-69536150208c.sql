-- Create table for exam review assignments
create table if not exists public.exam_review_assignments (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  reviewer_id uuid not null,
  assigned_by uuid not null,
  status text not null default 'assigned',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ex_assign_question on public.exam_review_assignments(question_id);
create index if not exists idx_ex_assign_reviewer on public.exam_review_assignments(reviewer_id);

alter table public.exam_review_assignments enable row level security;

-- RLS (reads only; writes go via Edge Functions with service role)
create policy ex_assign_admin_read on public.exam_review_assignments
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'::app_role
  ));

create policy ex_assign_guru_read on public.exam_review_assignments
  for select to authenticated
  using (reviewer_id = auth.uid());