import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Dynamic CORS with allowlist
const allowOrigin = (origin: string | null) => {
  const o = origin || '';
  if (o.includes('localhost')) return o;
  if (o.endsWith('.lovable.app')) return o;
  if (o.endsWith('.lovableproject.com')) return o;
  return '';
};

const baseCors = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
} as const;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const EMBEDDING_MODEL = Deno.env.get("EMBEDDING_MODEL") || "text-embedding-3-small";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface MessageIn { role: 'user'|'assistant'|'system'; content: string }

function sseEncode(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function getEmbedding(input: string) {
  const ctrl = new AbortController();
  const res = await Promise.race([
    fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
      signal: ctrl.signal,
    }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('embeddings timeout')), 30000))
  ]);
  if (!('ok' in res) || !(res as Response).ok) throw new Error(`Embeddings failed`);
  const json = await (res as Response).json();
  return json?.data?.[0]?.embedding as number[];
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const allowed = allowOrigin(origin);

  // Preflight
  if (req.method === 'OPTIONS') {
    if (!allowed) return new Response(null, { status: 403, headers: { ...baseCors } });
    return new Response(null, { headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed } });
  }

  if (!allowed) return new Response('Forbidden', { status: 403, headers: { ...baseCors } });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed } });

  try {
    const body = await req.json().catch(() => ({}));
    const allow_browsing: boolean = !!body.allow_browsing;
    const sessionId: string | null = body.session_id || null;
    const anonId: string | null = body.anon_id || null;
    const pageContext: any = body.page_context || {};
    const messages: MessageIn[] = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const purpose: string = typeof body.purpose === 'string' ? body.purpose : 'chatbot';
    const model: string = purpose === 'exam-generation' ? 'gpt-5.0-pro' : 'gpt-5.0-nano';

    const now = new Date().toISOString();
    let dbSessionId = sessionId;
    if (!dbSessionId) {
      const { data: s } = await supabase.from('ai_sessions').insert({ anon_id: anonId || crypto.randomUUID(), page_first_seen: pageContext?.page_type || null }).select('id').single();
      dbSessionId = s?.id ?? null;
    } else {
      await supabase.from('ai_sessions').update({ last_active_at: now }).eq('id', dbSessionId);
    }

    // Build retrieval context if browsing allowed
    let retrieved: any[] = [];
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (allow_browsing && lastUser?.content) {
      try {
        const embedding = await getEmbedding(lastUser.content);
        if (embedding?.length) {
          const { data } = await supabase.rpc('ai_search_content', { query_embedding: embedding as any, match_count: 8, filter_source: null as any });
          const seen = new Set<string>();
          for (const r of (data || [])) {
            const key = r.slug_url || r.url || r.slug || '';
            if (key && !seen.has(key)) { seen.add(key); retrieved.push(r); }
          }
        }
      } catch (_) {
        // retrieval fail is fine; will continue
      }
    }

    const systemPrompt = `You are AI Guru, a helpful assistant for EM Gurus. Provide concise, friendly answers using EM Gurus content first. Never give medical advice; include a short disclaimer when medical questions arise. Current page context: ${JSON.stringify(pageContext)}.`;

    // Prepare OpenAI payload
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ] as Array<{ role: string; content: string }>;

    if (retrieved.length) {
      const ctx = retrieved.map((r: any, i: number) => `#${i+1} [${r.title}](${r.slug_url || r.url || r.slug || ''})\n${(r.text_chunk||'').slice(0,800)}`).join('\n\n');
      openaiMessages.push({ role: 'system', content: `Relevant EM Gurus content:\n${ctx}` });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        const send = (d: unknown) => controller.enqueue(encoder.encode(sseEncode(d)));

        async function run(withTools: boolean) {
          const ctrl = new AbortController();
          try {
            const res = await Promise.race([
              fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: model,
                  temperature: 0.3,
                  max_tokens: 1024,
                  messages: openaiMessages,
                  stream: true,
                  tool_choice: withTools ? 'auto' : 'none',
                }),
                signal: ctrl.signal,
              }),
              new Promise<never>((_, rej) => setTimeout(() => rej(new Error('completion timeout')), 60000))
            ]);
            if (!('ok' in res) || !(res as Response).ok) {
              const errTxt = await (res as Response).text().catch(() => 'OpenAI error');
              throw new Error(errTxt);
            }
            const reader = (res as Response).body!.getReader();
            const decoder = new TextDecoder();
            let full = '';
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split(/\r?\n/);
              for (const line of lines) {
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (!data || data === '[DONE]') continue;
                try {
                  const json = JSON.parse(data);
                  const delta = json?.choices?.[0]?.delta?.content || '';
                  if (delta) {
                    full += delta;
                    send({ choices: [{ delta: { content: delta } }] });
                  }
                } catch { /* ignore parse */ }
              }
            }
            // Persist
            if (dbSessionId) {
              const userMsg = lastUser ? [{ session_id: dbSessionId, role: 'user', content: { text: lastUser.content } }] : [];
              const asstMsg = [{ session_id: dbSessionId, role: 'assistant', content: { text: full, retrieved: (retrieved||[]).slice(0,3) } }];
              if (userMsg.length) await supabase.from('ai_messages').insert(userMsg as any);
              await supabase.from('ai_messages').insert(asstMsg as any);
            }
          } catch (err) {
            throw err;
          }
        }

        try {
          await run(!!allow_browsing);
        } catch (err: any) {
          if (allow_browsing) {
            // Tool path failed — inform and retry without tools
            send({ delta: 'Browsing failed; answering without browsing… ' });
            try {
              await run(false);
            } catch (finalErr: any) {
              const msg = /quota/i.test(String(finalErr?.message || '')) ? 'AI is temporarily unavailable (OpenAI quota exceeded). Please try again later.' : 'AI Guru failed—try again with browsing off or reload.';
              send({ error: 'final', message: msg });
            }
          } else {
            const isTimeout = /timeout/i.test(String(err?.message || ''));
            const isQuota = /quota/i.test(String(err?.message || ''));
            const message = isTimeout
              ? 'Request timeout after 60s'
              : (isQuota ? 'AI is temporarily unavailable (OpenAI quota exceeded). Please try again later.' : 'AI Guru failed—try again with browsing off or reload.');
            send({ error: isTimeout ? 'timeout' : 'final', message });
          }
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...baseCors,
        'Access-Control-Allow-Origin': allowed,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
  } catch (err: any) {
    console.error('ai-route error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { ...baseCors, 'Access-Control-Allow-Origin': allowOrigin(req.headers.get('Origin') || '') } });
  }
});