import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ChatMsg { role: 'user'|'assistant'; content: string }

function detectPageContext() {
  const path = window.location.pathname;
  let page_type: string = 'other';
  if (path.startsWith('/blogs/') && path.split('/').length >= 3) page_type = 'blog_detail';
  else if (path.startsWith('/blogs')) page_type = 'blogs';
  else if (path.startsWith('/forums/')) page_type = 'forum_thread';
  else if (path.startsWith('/forums')) page_type = 'forums';
  else if (path.startsWith('/consultations')) page_type = 'consultations';
  else if (path.startsWith('/exams')) page_type = 'exams';
  else if (path.startsWith('/profile')) page_type = 'profile';
  else if (path === '/') page_type = 'home';
  return { page_type, path };
}

export default function AIGuru() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const sessionKey = useRef<string>("");

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

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content) return;
    const newMsgs = [...msgs, { role: 'user', content } as ChatMsg];
    setMsgs(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-route', {
        body: {
          session_id: sessionKey.current,
          anon_id: sessionKey.current,
          page_context: pageContext,
          messages: newMsgs,
        }
      });
      if (error) throw error;
      const reply = (data as any)?.reply || "Sorry, I couldn't generate a response.";
      setMsgs(m => [...m, { role: 'assistant', content: reply }]);
      if ((data as any)?.session_id) sessionKey.current = (data as any).session_id;
    } catch (e: any) {
      setMsgs(m => [...m, { role: 'assistant', content: 'There was an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="lg" className="rounded-full shadow-lg" aria-label="Open AI Guru chat">
            <Sparkles className="mr-2 h-5 w-5" /> AI Guru
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[90vh] sm:h-[70vh] p-0">
          <div className="h-full flex flex-col">
            <SheetHeader className="p-4 border-b">
              <SheetTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" /> AI Guru
                <span className="text-xs text-muted-foreground">Browsing: {pageContext.page_type}</span>
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="text-xs text-muted-foreground">AI Guru provides general guidance, not medical advice.</div>
              {msgs.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                  <div className={`inline-block max-w-[85%] rounded-lg px-3 py-2 ${m.role==='user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <div className="prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: m.content.replace(/\n/g,'<br/>') }} />
                  </div>
                </div>
              ))}
              {loading && <div className="text-sm text-muted-foreground">Generating…</div>}
            </div>
            <div className="p-3 border-t flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                className="flex-1 resize-none h-12 rounded-md border bg-background p-2"
                placeholder="Ask AI Guru…"
                aria-label="Chat input"
              />
              <Button onClick={() => send()} disabled={loading || !input.trim()} aria-label="Send message">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
