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

function chunkText(text: string, chunkSize = 800, overlap = 120): string[] {
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
    throw new Error(`OpenAI embeddings failed: ${errTxt}`);
  }
  const json = await res.json();
  return (json?.data || []).map((d: any) => d.embedding as number[]);
}

async function paginate<T>(table: string, select: string, where: Record<string, any> | null, batch = 500): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += batch) {
    let q = supabase.from(table).select(select).range(from, from + batch - 1) as any;
    if (where) {
      for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
    }
    const { data, error } = await (q as any);
    if (error) throw error;
    const rows = (data as T[]) || [];
    out.push(...rows);
    if (rows.length < batch) break;
  }
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const started = Date.now();

    const docs: Array<{ doc_id: string; source_type: string; title: string | null; slug_url: string | null; tags: string[] | null; text: string; }> = [];

    // Blogs (published)
    const posts = await paginate<any>('blog_posts', 'id, title, slug, tags, content, status', { status: 'published' }, 500);
    posts.forEach((p) => {
      const content = (p.content || '').toString();
      if (!content) return;
      docs.push({ doc_id: `blog:${p.id}`, source_type: 'blog', title: p.title || null, slug_url: p.slug ? `/blogs/${p.slug}` : null, tags: p.tags || null, text: content });
    });

    // Help docs (if available)
    try {
      const helps = await paginate<any>('help_articles', 'id, title, slug, content, tags', null, 500);
      helps.forEach((h) => {
        const text = (h.content || '').toString();
        if (!text) return;
        docs.push({ doc_id: `help:${h.id}`, source_type: 'help', title: h.title || null, slug_url: h.slug ? `/help/${h.slug}` : null, tags: h.tags || null, text });
      });
    } catch { /* optional */ }

    // Forums
    const threads = await paginate<any>('forum_threads', 'id, title, content', null, 500);
    threads.forEach((t) => {
      const text = (t.content || '').toString();
      if (!text) return;
      docs.push({ doc_id: `forum:thread:${t.id}`, source_type: 'forum', title: t.title || null, slug_url: `/forums/thread/${t.id}`, tags: null, text });
    });

    // Reviewed exam questions (if available)
    try {
      const qs = await paginate<any>('reviewed_exam_questions', 'id, stem, explanation, topic, subtopic', null, 500);
      qs.forEach((row) => {
        const parts = [row.stem, row.explanation].filter(Boolean).join('\n\n');
        if (!parts) return;
        const tags = [row.topic, row.subtopic].filter(Boolean);
        docs.push({ doc_id: `exam:${row.id}`, source_type: 'exam_question', title: row.topic || 'Exam Question', slug_url: `/exams/questions/${row.id}` , tags: tags.length ? tags : null, text: parts });
      });
    } catch { /* optional */ }

    let docsEmbedded = 0;
    let chunksCreated = 0;

    for (const doc of docs) {
      const chunks = chunkText(doc.text, 800, 120);
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

      for (let i = 0; i < toInsert.length; i += 100) {
        const slice = toInsert.slice(i, i + 100);
        const { error } = await supabase.from('ai_content_index').insert(slice as any);
        if (error) throw error;
      }
      docsEmbedded += 1;
      chunksCreated += toInsert.length;
    }

    const durationMs = Date.now() - started;
    return new Response(JSON.stringify({ docs_embedded: docsEmbedded, chunks_created: chunksCreated, model_used: EMBEDDING_MODEL, dim: EMBEDDING_DIM, ms: durationMs }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err: any) {
    console.error('seed_ai_embeddings_once error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});