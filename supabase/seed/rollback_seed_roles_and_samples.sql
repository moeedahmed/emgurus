-- Rollback: Remove seeded demo rows safely
-- Deletes only rows with the "Demo:" prefix in titles/stems and related assignments/logs

-- 1) Blog: delete logs/assignments tied to demo posts, then posts
DO $$
DECLARE
  _ids uuid[];
BEGIN
  SELECT array_agg(id) INTO _ids FROM public.blog_posts WHERE title LIKE 'Demo:%';
  IF _ids IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='blog_review_logs'
    ) THEN
      DELETE FROM public.blog_review_logs WHERE post_id = ANY(_ids);
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='blog_review_assignments'
    ) THEN
      DELETE FROM public.blog_review_assignments WHERE post_id = ANY(_ids);
    END IF;
    DELETE FROM public.blog_posts WHERE id = ANY(_ids);
  END IF;
END $$;

-- 2) Exams: delete demo questions (if table available)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='exam_questions' AND column_name='stem'
  ) THEN
    DELETE FROM public.exam_questions WHERE stem LIKE 'Demo:%';
  END IF;
END $$;

-- 3) Roles: keep roles by default; uncomment to remove demo role links
-- delete from public.user_roles where user_id in ('__USER_ID_AUTHOR__','__USER_ID_GURU__','__USER_ID_ADMIN__') and role in ('user','guru','admin');
