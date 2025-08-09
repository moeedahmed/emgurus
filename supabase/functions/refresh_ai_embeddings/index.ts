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
const EMBEDDING_DIM = Number(Deno.env.get("EMBEDDING_DIM") || "1536");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function chunkText(text: string, chunkSize = 3000, overlap = 500): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end));
    if (end === text.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}

async function embedBatch(inputs: string[]): Promise<number[][]> {
  if (!inputs.length) return [];
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs })
  });
  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`OpenAI embeddings failed: ${res.status} ${errTxt}`);
  }
  const json = await res.json();
  return (json?.data || []).map((d: any) => d.embedding as number[]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const started = Date.now();
    const body = await req.json().catch(() => ({}));
    const limit: number | undefined = body?.limit;

    // For simplicity, refresh by re-sourcing all docs (idempotent delete+insert per doc_id)
    const docs: Array<{
      doc_id: string;
      source_type: string;
      title: string | null;
      slug_url: string | null;
      tags: string[] | null;
      text: string;
    }> = [];

    // Blogs (published)
    {
      const { data: posts } = await supabase
        .from('blog_posts')
        .select('id, title, slug, tags, content, status')
        .eq('status', 'published')
        .limit(limit || 5000);
      (posts || []).forEach((p: any) => {
        const content = (p.content || '').toString();
        if (!content) return;
        docs.push({
          doc_id: `blog:${p.id}`,
          source_type: 'blog',
          title: p.title || null,
          slug_url: p.slug ? `/blog/${p.slug}` : null,
          tags: p.tags || null,
          text: content,
        });
      });
    }

    // Forums
    {
      const { data: threads } = await supabase
        .from('forum_threads')
        .select('id, title, content')
        .limit(limit || 5000);
      (threads || []).forEach((t: any) => {
        const content = (t.content || '').toString();
        if (!content) return;
        docs.push({
          doc_id: `forum:thread:${t.id}`,
          source_type: 'forum',
          title: t.title || null,
          slug_url: `/forums/thread/${t.id}`,
          tags: null,
          text: content,
        });
      });
    }

    // Exam questions if available
    try {
      const { data: q } = await supabase
        .from('reviewed_exam_questions')
        .select('id, stem, explanation, topic, subtopic')
        .limit(limit || 5000);
      (q || []).forEach((row: any) => {
        const parts = [row.stem, row.explanation].filter(Boolean).join('\n\n');
        if (!parts) return;
        const tags = [row.topic, row.subtopic].filter(Boolean);
        docs.push({
          doc_id: `exam:${row.id}`,
          source_type: 'exam_question',
          title: row.topic || 'Exam Question',
          slug_url: `/exams/questions/${row.id}`,
          tags: tags.length ? tags : null,
          text: parts,
        });
      });
    } catch (_) { /* skip if missing */ }

    let docsEmbedded = 0;
    let chunksCreated = 0;

    for (const doc of docs) {
      const chunks = chunkText(doc.text, 3000, 500);
      if (!chunks.length) continue;

      await supabase.from('ai_content_index').delete().eq('doc_id', doc.doc_id);

      const toInsert: any[] = [];
      for (let i = 0; i < chunks.length; i += 100) {
        const batch = chunks.slice(i, i + 100);
        const embeddings = await embedBatch(batch);
        embeddings.forEach((emb, j) => {
          toInsert.push({
            doc_id: doc.doc_id,
            source_type: doc.source_type,
            title: doc.title,
            slug_url: doc.slug_url,
            tags: doc.tags,
            text_chunk: batch[j],
            embedding: emb,
            model: EMBEDDING_MODEL,
            last_embedded_at: new Date().toISOString(),
          });
        });
      }

      if (toInsert.length) {
        for (let i = 0; i < toInsert.length; i += 100) {
          const slice = toInsert.slice(i, i + 100);
          const { error } = await supabase.from('ai_content_index').insert(slice as any);
          if (error) throw error;
        }
        docsEmbedded += 1;
        chunksCreated += toInsert.length;
      }
    }

    const durationMs = Date.now() - started;
    const summary = { refreshed_docs: docsEmbedded, chunks_written: chunksCreated, model_used: EMBEDDING_MODEL, dim: EMBEDDING_DIM, ms: durationMs };
    return new Response(JSON.stringify(summary), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err: any) {
    console.error('refresh_ai_embeddings error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});