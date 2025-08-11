-- Migration: reviewed_exam_perf_indexes
-- Safe, idempotent performance indexes for reviewed_exam_questions

-- Enable trigram extension for fast ILIKE on stem
create extension if not exists pg_trgm;

-- Core partial index: fast seek by exam_type and reviewed_at for approved rows
create index if not exists idx_revq_approved_examtype_reviewed
  on public.reviewed_exam_questions (exam_type, reviewed_at desc)
  where status = 'approved';

-- Optional legacy 'exam' column support
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reviewed_exam_questions' and column_name = 'exam'
  ) then
    create index if not exists idx_revq_approved_exam_reviewed
      on public.reviewed_exam_questions (exam, reviewed_at desc)
      where status = 'approved';
  end if;
end $$;

-- Optional topic filter index if topic column is present
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reviewed_exam_questions' and column_name = 'topic'
  ) then
    create index if not exists idx_revq_approved_topic_reviewed
      on public.reviewed_exam_questions (topic, reviewed_at desc)
      where status = 'approved';
  end if;
end $$;

-- Trigram index for ILIKE searches on stem
create index if not exists idx_revq_stem_trgm
  on public.reviewed_exam_questions using gin (stem gin_trgm_ops);

-- Optional GIN on tags (array/jsonb) if present
-- Works for text[] or jsonb[]-like columns; harmless if column absent
-- We just guard on existence

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reviewed_exam_questions' and column_name = 'tags'
  ) then
    create index if not exists idx_revq_tags_gin
      on public.reviewed_exam_questions using gin (tags);
  end if;
end $$;

-- Optional supporting indexes for SLO relations (if table exists)
do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'question_slos'
  ) then
    -- Guard columns too
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='question_slos' and column_name='question_id'
    ) then
      create index if not exists idx_question_slos_question on public.question_slos(question_id);
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='question_slos' and column_name='slo_id'
    ) then
      create index if not exists idx_question_slos_slo on public.question_slos(slo_id);
    end if;
  end if;
end $$;