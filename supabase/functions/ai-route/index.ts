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
interface MessageIn { role: 'user'|'assistant'|'system'; content: string }

function withTimeout<T>(p: Promise<T>, ms: number, label = 'request'): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(`${label} timeout after ${ms} ms`), ms);
  // Note: we can't actually pass ctrl.signal to supabase client calls, but we use it for OpenAI fetches below
  return new Promise<T>((resolve, reject) => {
    p.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const sessionId: string | null = body.session_id || null;
    const anonId: string | null = body.anon_id || null;
    const pageContext: any = body.page_context || {};
    const messages: MessageIn[] = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const now = new Date().toISOString();

    let dbSessionId = sessionId;
    if (!dbSessionId) {
      const { data: s } = await supabase.from('ai_sessions').insert({ anon_id: anonId || crypto.randomUUID(), page_first_seen: pageContext?.page_type || null }).select('id').single();
      dbSessionId = s?.id ?? null;
    } else {
      await supabase.from('ai_sessions').update({ last_active_at: now }).eq('id', dbSessionId);
    }

    // Retrieval (best-effort)
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    let retrieved: any[] = [];
    try {
      if (lastUser?.content) {
        const embCtrl = new AbortController();
        const embRes = await Promise.race([
          fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: EMBEDDING_MODEL, input: lastUser.content }),
            signal: embCtrl.signal,
          }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('embeddings timeout')), 20000))
        ]);
        if (!('ok' in embRes) || !(embRes as Response).ok) throw new Error(`Embeddings failed`);
        const embJson = await (embRes as Response).json();
        const embedding: number[] = embJson?.data?.[0]?.embedding || [];
        if (embedding.length) {
          const { data } = await supabase.rpc('ai_search_content', { query_embedding: embedding as any, match_count: 6, filter_source: null as any });
          retrieved = data || [];
        }
      }
    } catch (retrErr) {
      // Ignore retrieval failure silently; main chat can still proceed
    }

    const systemPrompt = `You are AI Guru, a helpful assistant for EM Gurus. Provide concise, friendly answers using EM Gurus content first. Never give medical advice; include a short disclaimer when medical questions arise. Current page context: ${JSON.stringify(pageContext)}. If you cite content, link with markdown and keep bullets short.`;

    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      retrieved.length ? { role: 'system', content: `Relevant content:\n${retrieved.map((r: any, i: number) => `#${i+1} [${r.title}](${r.slug_url || r.url || r.slug || ''})\n${(r.text_chunk||'').slice(0,800)}`).join('\n\n')}` } : null,
    ].filter(Boolean) as Array<{ role: string; content: string }>;

    // Chat completion with quick failure on OpenAI errors/timeouts
    try {
      const ctrl = new AbortController();
      const completionRes = await Promise.race([
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4.1-2025-04-14', messages: openaiMessages, temperature: 0.3 }),
          signal: ctrl.signal,
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('completion timeout')), 25000))
      ]);
      if (!('ok' in completionRes) || !(completionRes as Response).ok) {
        const errTxt = await (completionRes as Response).text().catch(() => 'Unknown error');
        return new Response(JSON.stringify({ error: `OpenAI error: ${errTxt}` }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const completion = await (completionRes as Response).json();
      const reply = completion?.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

      if (dbSessionId) {
        const userMsg = lastUser ? [{ session_id: dbSessionId, role: 'user', content: { text: lastUser.content } }] : [];
        const asstMsg = [{ session_id: dbSessionId, role: 'assistant', content: { text: reply, retrieved: (retrieved||[]).slice(0,3) } }];
        if (userMsg.length) await supabase.from('ai_messages').insert(userMsg as any);
        await supabase.from('ai_messages').insert(asstMsg as any);
      }

      return new Response(JSON.stringify({ session_id: dbSessionId, reply }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    } catch (openaiErr: any) {
      // Quick failure path
      return new Response(JSON.stringify({ error: openaiErr?.message || 'AI completion failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
  } catch (err: any) {
    console.error('ai-route error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});