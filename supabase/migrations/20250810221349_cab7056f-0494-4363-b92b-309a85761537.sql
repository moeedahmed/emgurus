-- Migration: resolve security-definer error by switching ai_search_content to SECURITY INVOKER
-- and adding a safe public SELECT policy for published content

-- 1) Switch function to SECURITY INVOKER and pin search_path
ALTER FUNCTION public.ai_search_content(query_embedding vector, match_count integer, filter_source text)
  SECURITY INVOKER;

-- 2) Add public read policy for published content (keeps existing admin policy)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_content_index' AND policyname='Public can read published ai_content_index'
  ) THEN
    ALTER TABLE public.ai_content_index ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Public can read published ai_content_index"
      ON public.ai_content_index
      FOR SELECT
      USING (published = true);
  END IF;
END $$;