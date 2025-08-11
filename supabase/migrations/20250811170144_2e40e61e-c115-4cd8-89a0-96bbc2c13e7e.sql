-- Migration: rpc_list_public_reviewed_questions (dynamic column-safe)
-- Optional RPC for fast, filtered public list using dynamic SQL to handle schema variations

create or replace function public.list_public_reviewed_questions(
  p_exam text default null,
  p_topic text default null,
  p_q text default null,
  p_limit int default 24,
  p_offset int default 0
)
returns table (
  id uuid,
  stem text,
  exam_type text,
  reviewed_at timestamptz
)
language plpgsql
stable
as $$
declare
  has_exam_type boolean;
  has_exam boolean;
  has_topic boolean;
  has_tags boolean;
  sql text;
  base_sql text;
  conds text := ' where r.status = ''approved'' ';
  _p_limit int := greatest(1, least(coalesce(p_limit,24), 50));
  _p_offset int := greatest(0, coalesce(p_offset,0));
begin
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='reviewed_exam_questions' and column_name='exam_type') into has_exam_type;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='reviewed_exam_questions' and column_name='exam') into has_exam;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='reviewed_exam_questions' and column_name='topic') into has_topic;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='reviewed_exam_questions' and column_name='tags') into has_tags;

  base_sql := 'select r.id, r.stem, ' || (case when has_exam_type then 'r.exam_type' when has_exam then 'r.exam' else 'null' end) || ' as exam_type, coalesce(r.reviewed_at, r.created_at) as reviewed_at from public.reviewed_exam_questions r';

  if p_exam is not null then
    if has_exam_type then
      conds := conds || ' and r.exam_type = ' || quote_literal(p_exam);
    elsif has_exam then
      conds := conds || ' and r.exam = ' || quote_literal(p_exam);
    end if;
  end if;

  if p_topic is not null then
    if has_tags then
      conds := conds || ' and r.tags @> array[' || quote_literal(p_topic) || ']::text[]';
    elsif has_topic then
      conds := conds || ' and r.topic = ' || quote_literal(p_topic);
    end if;
  end if;

  if p_q is not null then
    conds := conds || ' and r.stem ilike ' || quote_literal('%' || p_q || '%');
  end if;

  sql := base_sql || conds || ' order by reviewed_at desc, r.id desc limit ' || _p_limit || ' offset ' || _p_offset;

  return query execute sql;
end;
$$;

-- Note: GRANT EXECUTE is optional and depends on your RLS; keeping defaults intact for compatibility.