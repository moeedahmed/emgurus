import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ChatMsg { 
  role: 'user' | 'assistant'; 
  content: string; 
}

interface AIGuruPanelProps {
  mode: "practice" | "ai" | "exam";
  examId?: string;
  questionId?: string;
  kbId?: string;
}

export default function AIGuruPanel({ mode, examId, questionId, kbId }: AIGuruPanelProps) {
  const { session } = useAuth();
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [msgs]);

  const send = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMsgs(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-route', {
        body: {
          messages: [...msgs, { role: 'user', content: userMsg }],
          context: {
            mode,
            examId,
            questionId,
            kbId,
            page_type: 'exams'
          }
        }
      });

      if (error) throw error;

      const response = data?.content || "Sorry, I couldn't generate a response.";
      setMsgs(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      console.error('AI Guru error:', err);
      setMsgs(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-96">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-0">
        {msgs.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Ask me about this question or exam content!
          </div>
        )}
        {msgs.map((msg, i) => (
          <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-right' : ''}`}>
            <div
              className={`inline-block p-2 rounded-lg max-w-[85%] ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground ml-auto'
                  : 'bg-muted'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask about this question..."
          className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
          disabled={loading}
        />
        <Button
          onClick={send}
          disabled={loading || !input.trim()}
          size="sm"
          aria-label="Send message"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}