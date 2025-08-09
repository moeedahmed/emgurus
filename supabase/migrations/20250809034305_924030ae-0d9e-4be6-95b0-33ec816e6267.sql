-- 1) Ensure pgvector and migrate to 3072 dims
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop old embedding indexes if present
DROP INDEX IF EXISTS idx_ai_content_index_embedding;
DROP INDEX IF EXISTS ivfflat_ai_content_index_embedding;

-- Alter column to 3072-dim
ALTER TABLE public.ai_content_index
  ALTER COLUMN embedding TYPE vector(3072);

-- Recreate ANN index
CREATE INDEX idx_ai_content_index_embedding
  ON public.ai_content_index USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 2) RPC: dimension-agnostic signature
DROP FUNCTION IF EXISTS public.ai_search_content(vector, integer, text);
CREATE OR REPLACE FUNCTION public.ai_search_content(
  query_embedding vector,
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