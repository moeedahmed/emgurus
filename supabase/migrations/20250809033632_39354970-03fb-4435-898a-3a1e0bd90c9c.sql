-- Drop old function signature to allow return type change
DROP FUNCTION IF EXISTS public.ai_search_content(vector, integer, text);

-- Recreate with 1536-dim and slug_url
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