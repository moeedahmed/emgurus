import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MessageCircle, Send, Sparkles, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";

interface ChatMsg { role: 'user'|'assistant'; content: string }

// Streaming helpers
const supaUrl = import.meta.env.VITE_SUPABASE_URL;
const functionsUrl = (path: string) => `${supaUrl}/functions/v1/${path}`;
function supabaseFnHeaders(session?: { access_token?: string }) { 
  const h: Record<string,string> = { 
    'Content-Type': 'application/json', 
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  }; 
  if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`; 
  return h; 
}

function detectPageContext() {
  const path = window.location.pathname;
  let page_type: string = 'other';
  if (path.startsWith('/blogs/') && path.split('/').length >= 3) page_type = 'blog_detail';
  else if (path.startsWith('/blogs')) page_type = 'blogs';
  else if (path.startsWith('/forums/')) page_type = 'forum_thread';
  else if (path.startsWith('/forums')) page_type = 'forums';
  else if (path.startsWith('/consultations')) page_type = 'consults';
  else if (path.startsWith('/exams')) page_type = 'exams';
  else if (path.startsWith('/profile')) page_type = 'profile';
  else if (path === '/') page_type = 'home';
  return { page_type, path };
}

export default function AIGuru() {
  const { user, session } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string>("");
  const [allowBrowsing, setAllowBrowsing] = useState<boolean>(false);
  const sessionKey = useRef<string>("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const pageContext = useMemo(() => detectPageContext(), [open, window.location.pathname]);

  useEffect(() => {
    const key = localStorage.getItem('ai_guru_session') || crypto.randomUUID();
    localStorage.setItem('ai_guru_session', key);
    sessionKey.current = key;
    const cached = localStorage.getItem('ai_guru_msgs');
    if (cached) setMsgs(JSON.parse(cached));
  }, []);

  useEffect(() => {
    localStorage.setItem('ai_guru_msgs', JSON.stringify(msgs.slice(-20)));
  }, [msgs]);

  // Close on outside click without blocking page scroll
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (fabRef.current?.contains(target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Tab' && panelRef.current) {
        // simple focus trap
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
        if (e.shiftKey && active === first) { e.preventDefault(); (last as HTMLElement).focus(); }
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    // autofocus textarea
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);


  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content) return;
    const newMsgs = [...msgs, { role: 'user', content } as ChatMsg];
    setMsgs(newMsgs);
    setInput("");
    setLoading(true);
    setStatusText('Generating…');

    // Add assistant placeholder for streaming
    setMsgs(m => [...m, { role: 'assistant', content: '' }]);

    // transient status
    const statusTimer = setTimeout(() => setStatusText('Searching EM Gurus…'), 600);

    const payload = {
      session_id: sessionKey.current,
      anon_id: sessionKey.current,
      pageContext: pageContext,
      messages: newMsgs.slice(-20),
      browsing: allowBrowsing,
      purpose: "chatbot",
    };

    const scrollToBottom = () => {
      setTimeout(() => {
        const chatContainer = panelRef.current?.querySelector('.overflow-y-auto');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 10);
    };

    const updateLastAssistant = (content: string) => {
      setMsgs(m => {
        const copy = [...m];
        const idx = copy.length - 1;
        if (idx >= 0 && copy[idx].role === 'assistant') {
          copy[idx] = { ...copy[idx], content };
        }
        return copy;
      });
      scrollToBottom();
    };

    const appendToLastAssistant = (chunk: string) => {
      setMsgs(m => {
        const copy = [...m];
        const idx = copy.length - 1;
        if (idx >= 0 && copy[idx].role === 'assistant') {
          copy[idx] = { ...copy[idx], content: copy[idx].content + chunk };
        }
        return copy;
      });
      scrollToBottom();
    };

    try {
      // Primary streaming path
      const res = await fetch(functionsUrl('ai-route'), {
        method: 'POST',
        headers: supabaseFnHeaders(session),
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => `HTTP ${res.status}`);
        // Attempt non-stream fallback via invoke
        try {
          const { data, error } = await supabase.functions.invoke('ai-route', {
            body: { ...payload, no_stream: true }
          });
          if (error) {
            updateLastAssistant(String(error.message || error));
          } else {
            const content = data?.message || data?.text || data?.content || String(data || errorText);
            updateLastAssistant(content);
          }
        } catch {
          updateLastAssistant(errorText);
        }
        return;
      }

      if (!res.body) {
        throw new Error('no-stream');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      clearTimeout(statusTimer);
      setStatusText('');

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          
          // Handle different response formats
          if (chunk.includes('data:')) {
            // Server-sent events format
            const lines = chunk.split(/\r?\n/);
            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const json = JSON.parse(data);
                const delta = json?.choices?.[0]?.delta?.content || json?.delta || json?.content || '';
                const errMsg = json?.message || json?.error || '';
                if (delta) {
                  appendToLastAssistant(delta);
                } else if (errMsg) {
                  updateLastAssistant(String(errMsg));
                  break;
                }
              } catch {}
            }
          } else {
            // Try parsing as JSON first
            try {
              const json = JSON.parse(chunk);
              if (json.error) {
                updateLastAssistant(String(json.error));
                break;
              } else if (json.message || json.text) {
                updateLastAssistant(String(json.message || json.text));
                break;
              }
            } catch {
              // Treat as raw text chunk
              appendToLastAssistant(chunk);
            }
          }
        }
      }

    } catch (e: any) {
      // Fallback to supabase.functions.invoke
      console.log('Falling back to supabase.functions.invoke due to:', e?.message);
      
      try {
        const { data, error } = await supabase.functions.invoke('ai-route', {
          body: { ...payload, no_stream: true }
        });
        
        clearTimeout(statusTimer);
        setStatusText('');
        
        if (error) {
          updateLastAssistant(String(error.message || error));
        } else {
          const content = data?.message || data?.text || data?.content || String(data || 'Sorry, I could not generate a response.');
          updateLastAssistant(content);
        }
      } catch (fallbackError: any) {
        clearTimeout(statusTimer);
        setStatusText('');
        const errorMsg = fallbackError?.message || 'Sorry, I couldn\'t generate a response.';
        updateLastAssistant(errorMsg);
        console.error('AI Guru fallback error', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  }, [input, msgs, pageContext, allowBrowsing, session]);

  const runSelfTest = async () => {
    await send("Give me 2 links about sepsis from EM Gurus");
  };

  // Quick chips actions
  const quickAsk = [
    { label: 'Summarize this page', text: 'Summarize this page in 5 bullet points.' },
    { label: 'Find sepsis', text: 'Show me recent EM Gurus content on sepsis.' },
    { label: 'Key takeaways', text: 'What are the key takeaways here?' },
  ];

  return (
    <div className="fixed right-4 md:right-6 bottom-4 md:bottom-6 z-50 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]">
      <button
        ref={fabRef}
        onClick={() => setOpen(true)}
        aria-label="Open AI Guru chat"
        className="rounded-full px-4 h-12 shadow-lg bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background flex items-center gap-2"
      >
        <Sparkles className="h-5 w-5" />
        <span className="font-medium">AI Guru</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="mt-3 w-[90vw] max-w-[420px] h-[65vh] md:h-[70vh] rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden"
          style={{ position: 'fixed', right: '1rem', bottom: '4.25rem' }}
          role="dialog" aria-modal="false" aria-label="AI Guru chat"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MessageCircle className="h-5 w-5 shrink-0" />
              <div className="truncate">
                <div className="font-medium">AI Guru • Browsing: {pageContext.page_type}</div>
                <div className="text-xs text-muted-foreground truncate">AI Guru provides general guidance, not medical advice.</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={runSelfTest}>Test</Button>
              <button aria-label="Close" onClick={() => setOpen(false)} className="p-2 rounded-md hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick actions (wrap, max two lines) */}
          <div className="px-3 pt-2">
            <div className="flex flex-wrap gap-2 max-h-[72px] overflow-hidden items-center">
              <button
                onClick={() => setAllowBrowsing(v => !v)}
                className={`text-xs px-2 py-1 rounded-full border ${allowBrowsing ? 'bg-accent' : ''}`}
                aria-pressed={allowBrowsing}
                aria-label="Toggle browsing"
              >
                Browsing: {allowBrowsing ? 'On' : 'Off'}
              </button>
              {quickAsk.map((q) => (
                <button key={q.label} onClick={() => send(q.text)} className="text-xs px-2 py-1 rounded-full border hover:bg-accent">
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <div className={`inline-block max-w-[85%] rounded-lg px-3 py-2 ${m.role==='user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <div className="prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.content).replace(/\n/g,'<br/>') }} />
                </div>
              </div>
            ))}
            {statusText && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> {statusText}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              className="flex-1 resize-none h-12 rounded-md border bg-background p-2"
              placeholder="Ask AI Guru…"
              aria-label="Chat input"
            />
            <Button onClick={() => send()} disabled={loading || !input.trim()} aria-label="Send message">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}