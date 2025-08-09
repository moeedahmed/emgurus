-- Ensure pgvector is available
CREATE EXTENSION IF NOT EXISTS vector;

-- Align ai_content_index schema to requested structure
-- Add missing columns
ALTER TABLE public.ai_content_index
  ADD COLUMN IF NOT EXISTS slug_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill slug_url from existing fields
UPDATE public.ai_content_index
SET slug_url = COALESCE(slug, url)
WHERE slug_url IS NULL;

-- Recreate embedding column with 1536 dimensions (ada-002 / text-embedding-3-small compatible)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_content_index' AND column_name='embedding'
  ) THEN
    ALTER TABLE public.ai_content_index DROP COLUMN embedding;
  END IF;
END $$;
ALTER TABLE public.ai_content_index ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_content_index_source_type ON public.ai_content_index(source_type);
CREATE INDEX IF NOT EXISTS idx_ai_content_index_doc_id ON public.ai_content_index(doc_id);
DROP INDEX IF EXISTS ivfflat_ai_content_index_embedding;
CREATE INDEX ivfflat_ai_content_index_embedding ON public.ai_content_index USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Keep updated_at fresh on updates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ai_content_index_updated_at'
  ) THEN
    CREATE TRIGGER trg_ai_content_index_updated_at
    BEFORE UPDATE ON public.ai_content_index
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_update_timestamp();
  END IF;
END $$;

-- Update RAG helper to 1536-dim and expose slug_url
CREATE OR REPLACE FUNCTION public.ai_search_content(
  query_embedding vector(1536),
  match_count int DEFAULT 6,
  filter_source text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  slug_url text,
  source_type text,
  tags text[],
  text_chunk text,
  similarity float4
) AS $$
  SELECT c.id,
         c.title,
         COALESCE(c.slug_url, c.url, c.slug) AS slug_url,
         c.source_type,
         c.tags,
         c.text_chunk,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.ai_content_index c
  WHERE (filter_source IS NULL OR c.source_type = filter_source)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;