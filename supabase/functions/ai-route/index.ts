import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOpenAI } from "../_shared/openai.ts";

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
const EMBEDDING_MODEL = Deno.env.get("EMBEDDING_MODEL") || "text-embedding-3-small";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface MessageIn { role: 'user'|'assistant'|'system'; content: string }

function sseEncode(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function getEmbedding(input: string) {
  const apiKey = getOpenAI();
  const ctrl = new AbortController();
  const res = await Promise.race([
    fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
    const browsing: boolean = !!body.browsing;
    const noStream: boolean = !!body.no_stream;
    const sessionId: string | null = body.session_id || null;
    const anonId: string | null = body.anon_id || null;
    const pageContext: any = body.pageContext || body.page_context || {};
    const messages: MessageIn[] = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const purpose: string = typeof body.purpose === 'string' ? body.purpose : 'chatbot';
    // Map requested purpose to real OpenAI models compatible with Chat Completions
    // "gpt-5.0-nano/pro" are project-level labels; route to OpenAI equivalents
    const requested = (purpose === 'exam-generation' || purpose === 'blog_generation') ? 'gpt-5.0-pro' : 'gpt-5.0-nano';
    const model: string = requested === 'gpt-5.0-pro' ? 'gpt-4o' : 'gpt-4o-mini';

    const now = new Date().toISOString();
    let dbSessionId = sessionId;
    try {
      if (!dbSessionId) {
        const { data: s, error: sErr } = await supabase
          .from('ai_sessions')
          .insert({ anon_id: anonId || crypto.randomUUID(), page_first_seen: pageContext?.page_type || null })
          .select('id')
          .maybeSingle();
        if (!sErr) dbSessionId = s?.id ?? null;
      } else {
        await supabase.from('ai_sessions').update({ last_active_at: now }).eq('id', dbSessionId);
      }
    } catch (_) {
      dbSessionId = null; // non-fatal
    }

    // Build retrieval context if browsing allowed
    let retrieved: any[] = [];
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (browsing && lastUser?.content) {
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

    // Handle blog generation purpose
    if (purpose === 'blog_generation') {
      const { topic, instructions_text, source_links, source_files } = body;
      if (!topic) {
        return new Response(JSON.stringify({ success: false, error: 'Topic is required for blog generation' }), {
          status: 400,
          headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json' }
        });
      }
      
      if (!instructions_text) {
        return new Response(JSON.stringify({ success: false, error: 'Instructions text is required for blog generation' }), {
          status: 400,
          headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json' }
        });
      }

      try {
        const apiKey = getOpenAI();
        
        // Build context from sources
        let contextBlock = '';
        const hasUrls = Array.isArray(source_links) && source_links.length > 0;
        const hasFiles = Array.isArray(source_files) && source_files.length > 0;
        
        // Process source files - support .pdf, .docx, .pptx, .txt, .md
        let sourceTexts: string[] = [];
        if (hasFiles) {
          for (const file of source_files) {
            if (file.content && file.content.trim()) {
              // Client-parsed .txt/.md files
              sourceTexts.push(file.content);
            } else if (file.name && !file.content) {
              // Files that need server-side processing (.pdf, .docx, .pptx)
              // For now, just add a placeholder - future enhancement could implement actual parsing
              const fileName = file.name.toLowerCase();
              if (fileName.endsWith('.pdf') || fileName.endsWith('.docx') || fileName.endsWith('.pptx')) {
                sourceTexts.push(`[Document: ${file.name} - content parsing not yet implemented]`);
              }
            }
          }
        }
        
        if (hasUrls || sourceTexts.length > 0) {
          contextBlock = '\n\nContext to ground your response:\n';
          
          // Add source texts (truncate to 4000 chars total)
          if (sourceTexts.length > 0) {
            const combinedText = sourceTexts.join('\n\n');
            contextBlock += combinedText.slice(0, 4000);
            if (combinedText.length > 4000) {
              contextBlock += '\n[Content truncated for length]';
            }
          }
          
          // Add numbered URL list for citations
          if (hasUrls) {
            contextBlock += '\n\nSource URLs for citation:\n';
            source_links.forEach((url: string, index: number) => {
              contextBlock += `[${index + 1}] ${url}\n`;
            });
          }
        }
        
        // Build system prompt with grounding instructions
        let systemPrompt = `Generate a structured blog post about "${topic}" following these requirements:

Topic: ${topic}
Instructions: ${instructions_text}

RESPOND ONLY with valid JSON in this exact format:
{
  "success": true,
  "title": "Compelling clinical title",
  "tags": ["tag1", "tag2", "tag3"],
  "blocks": [
    { "type": "paragraph", "content": "Full paragraph text..." },
    { "type": "image_request", "description": "Specific image description" }
  ]
}

Block types allowed: "paragraph", "image_request", "video_placeholder"
- paragraph blocks need "content" field with full text
- image_request/video_placeholder blocks need "description" field`;

        if (hasUrls) {
          systemPrompt += `\n\nIMPORTANT: Ground your content in the provided sources and cite them inline using bracketed numbers [1], [2], etc. that correspond to the numbered source URLs.`;
        }

        systemPrompt += `\n\nGenerate comprehensive, evidence-based content appropriate for emergency medicine professionals.${contextBlock}`;

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o',
            temperature: 0.3,
            max_tokens: 2000,
            messages: [{ role: 'user', content: systemPrompt }]
          })
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error('OpenAI API error:', errorText);
          throw new Error('OpenAI API request failed');
        }
        
        const result = await res.json();
        const content = result.choices?.[0]?.message?.content;
        
        if (!content) {
          throw new Error('No content returned from OpenAI');
        }
        
        // Parse and validate JSON response
        let structuredData;
        try {
          // Remove any markdown formatting if present
          const cleanJson = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
          structuredData = JSON.parse(cleanJson);
          
          // Validate structure
          if (!structuredData || typeof structuredData !== 'object') {
            throw new Error('Invalid JSON structure');
          }
        } catch (parseError) {
          console.error('Failed to parse AI JSON response:', parseError, 'Raw content:', content);
          
          // Return error instead of fallback to maintain contract
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'AI returned invalid JSON format' 
          }), {
            status: 500,
            headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json' }
          });
        }

        // Ensure required fields exist with defaults and return success format
        const finalData = {
          success: true,
          title: structuredData.title || `Blog on ${topic}`,
          tags: Array.isArray(structuredData.tags) ? structuredData.tags : [],
          blocks: Array.isArray(structuredData.blocks) ? structuredData.blocks : [{ type: 'paragraph', content: 'No content generated' }]
        };

        return new Response(JSON.stringify(finalData), {
          headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Blog generation error:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Blog generation failed' 
        }), {
          status: 500,
          headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json' }
        });
      }
    }

    const systemPrompt = `You are AI Guru, a helpful assistant for EM Gurus. Provide concise, friendly answers using EM Gurus content first. Never give medical advice; include a short disclaimer when medical questions arise.${pageContext?.text ? ` CONTEXT: ${pageContext.text.slice(0, 3000)}` : ''}`;
    console.log('AI Route - model:', model, 'messages:', messages.length, 'browsing:', browsing, 'purpose:', purpose);

    // Handle image generation purpose
    if (purpose === 'image_generation') {
      const { description } = body;
      if (!description) {
        return new Response(JSON.stringify({ 
          success: false, 
          image_url: null, 
          image_data: null, 
          error: 'Missing image description' 
        }), {
          status: 400,
          headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json' }
        });
      }

      try {
        const apiKey = getOpenAI();
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: `Medical illustration: ${description}. Professional, clinical style suitable for medical education.`,
            size: '512x512'
          })
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error('Image generation OpenAI API error:', errorText);
          throw new Error(`OpenAI API error: ${errorText}`);
        }
        
        const result = await res.json();
        const imageData = result.data?.[0];
        
        // Check if we have a valid image URL
        if (!imageData?.url) {
          console.error('Image generation error: No image URL returned', result);
          throw new Error('Image generation returned no URL');
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          image_url: imageData.url,
          image_data: null,
          error: null 
        }), {
          headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Image generation error:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          image_url: null, 
          image_data: null,
          error: error instanceof Error ? error.message : 'Image generation failed'
        }), {
          status: 500,
          headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json' }
        });
      }
    }

    // Validate secrets early to surface clear errors
    try {
      getOpenAI();
    } catch (error) {
      return new Response(sseEncode({ error: 'missing_key', message: 'OpenAI key not configured' }), {
        status: 500,
        headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'text/event-stream' },
      });
    }


    // Prepare OpenAI payload
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ] as Array<{ role: string; content: string }>;

    if (retrieved.length) {
      const ctx = retrieved.map((r: any, i: number) => `#${i+1} [${r.title}](${r.slug_url || r.url || r.slug || ''})\n${(r.text_chunk||'').slice(0,800)}`).join('\n\n');
      openaiMessages.push({ role: 'system', content: `Relevant EM Gurus content:\n${ctx}` });
    }

    // If non-stream requested, return JSON once
    if (noStream) {
      try {
        const apiKey = getOpenAI();
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            temperature: 0.3,
            max_tokens: 1024,
            messages: openaiMessages,
            stream: false,
          }),
        });
        if (!res.ok) {
          const errTxt = await res.text().catch(() => 'OpenAI error');
          throw new Error(errTxt);
        }
        const json = await res.json();
        const full = json?.choices?.[0]?.message?.content || '';
        // Persist minimal history
        if (dbSessionId) {
          const lastUser = [...messages].reverse().find(m => m.role === 'user');
          const userMsg = lastUser ? [{ session_id: dbSessionId, role: 'user', content: { text: lastUser.content } }] : [];
          const asstMsg = [{ session_id: dbSessionId, role: 'assistant', content: { text: full, retrieved: (retrieved||[]).slice(0,3) } }];
          if (userMsg.length) await supabase.from('ai_messages').insert(userMsg as any);
          await supabase.from('ai_messages').insert(asstMsg as any);
        }
        return new Response(JSON.stringify({ message: full }), {
          headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'OpenAI request failed' }), {
          status: 500,
          headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json' }
        });
      }
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        const send = (d: unknown) => controller.enqueue(encoder.encode(sseEncode(d)));

        async function run(withTools: boolean) {
          const ctrl = new AbortController();
          try {
            const apiKey = getOpenAI();
            const res = await Promise.race([
              fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
          await run(!!browsing);
        } catch (err: any) {
          if (browsing) {
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