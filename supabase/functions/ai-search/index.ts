import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const EMBEDDING_MODEL = Deno.env.get("EMBEDDING_MODEL") || "text-embedding-3-small";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function embed(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text })
  });
  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`OpenAI embeddings failed: ${res.status} ${errTxt}`);
  }
  const json = await res.json();
  return (json?.data?.[0]?.embedding || []) as number[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const query: string = body?.query || '';
    const match_count: number = body?.match_count ?? 3;
    const filter_source: string | null = body?.filter_source ?? null;

    if (!query) throw new Error('Missing query');

    const vector = await embed(query);

    // Use the SQL function via RPC
    const { data, error } = await supabase.rpc('ai_search_content', {
      query_embedding: vector as any,
      match_count,
      filter_source,
    });
    if (error) throw error;

    const results = (data || []).map((r: any) => ({
      title: r.title,
      slug_url: r.slug_url,
      source_type: r.source_type,
      similarity: r.similarity,
    }));

    return new Response(JSON.stringify({ results, model_used: EMBEDDING_MODEL }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 200,
    });
  } catch (err: any) {
    console.error('ai-search error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});