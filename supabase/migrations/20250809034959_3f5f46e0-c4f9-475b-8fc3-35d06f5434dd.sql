-- 1) Ensure pgvector and lock to 1536-dim + ANN index
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop any existing embedding indexes (various possible names)
DROP INDEX IF EXISTS public.idx_ai_content_index_embedding;
DROP INDEX IF EXISTS public.ivfflat_ai_content_index_embedding;
DROP INDEX IF EXISTS public.ai_content_index_embedding_idx;

-- Ensure 1536-dim embedding column
ALTER TABLE public.ai_content_index
  ALTER COLUMN embedding TYPE vector(1536);

-- Add model tracking columns for re-embed if missing
ALTER TABLE public.ai_content_index
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS last_embedded_at timestamptz;

-- Recreate IVFFLAT index (fast ANN)
CREATE INDEX idx_ai_content_index_embedding
  ON public.ai_content_index USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 2) Keep ai_search_content dimension-agnostic
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

-- 3) Analyze table for planner stats (VACUUM not allowed in transaction)
ANALYZE public.ai_content_index;