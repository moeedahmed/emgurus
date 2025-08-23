import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { Trash2 } from "lucide-react";
import { callFunction } from "@/lib/functionsUrl";
import { toast } from "sonner";

interface Discussion {
  id: string;
  post_id: string;
  author_id: string;
  message: string;
  kind: string;
  created_at: string;
  author_name: string;
}

export default function BlogChat({ postId }: { postId: string }) {
  const { user } = useAuth();
  const { isAdmin, isGuru } = useRoles();
  const [items, setItems] = useState<Discussion[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [items]);

  const load = async () => {
    if (!postId) return;
    try {
      setLoading(true);
      const data = await callFunction(`/api/blogs/${postId}/discussions`, {}, true, 'GET');
      setItems(data.items || []);
    } catch (error) {
      console.error("Failed to load discussions:", error);
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Simple polling for real-time updates
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [postId]);

  const send = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    try {
      const response = await callFunction(`/api/blogs/${postId}/discussions`, {
        message: text.trim(),
        kind: "comment"
      }, true, "POST");
      
      if (response.success) {
        setText("");
        await load();
        toast.success("Message sent");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string, authorId: string) => {
    if (!isAdmin && authorId !== user?.id) return;
    try {
      const response = await callFunction(`/api/blogs/discussions/${id}`, {}, true, "DELETE");
      if (response.success) {
        await load();
        toast.success("Message deleted");
      }
    } catch (error) {
      console.error("Failed to delete message:", error);
      toast.error("Failed to delete message");
    }
  };

  // Only show chat for admins and gurus
  if (!isAdmin && !isGuru) {
    return null;
  }

  return (
    <Card className="p-3 md:p-4 h-[520px] flex flex-col">
      <div className="font-semibold mb-2">Discussion</div>
      <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 pr-3">
        <div className="space-y-3 pb-2">
          {loading && items.length === 0 && (
            <div className="text-sm text-muted-foreground">Loading messages...</div>
          )}
          {!loading && items.length === 0 && (
            <div className="text-sm text-muted-foreground">No messages yet.</div>
          )}
          {items.map((m) => (
            <div key={m.id} className="text-sm group">
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-xs mb-1">
                  {new Date(m.created_at).toLocaleString()} • {m.author_name} • {m.kind}
                </div>
                {(isAdmin || m.author_id === user?.id) && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 opacity-0 group-hover:opacity-100" 
                    aria-label="Delete message" 
                    onClick={() => handleDelete(m.id, m.author_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="bg-muted rounded-md p-2 whitespace-pre-wrap leading-relaxed">
                {m.message}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="mt-2 flex gap-2">
        <Input 
          value={text} 
          onChange={(e) => setText(e.target.value)} 
          placeholder="Write a message..." 
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button onClick={send} disabled={sending || !text.trim()}>
          {sending ? "Sending..." : "Send"}
        </Button>
      </div>
    </Card>
  );
}