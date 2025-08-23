import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Discussion {
  id: string;
  post_id: string;
  author_id: string;
  message: string;
  kind: string;
  created_at: string;
  author?: {
    full_name: string;
  };
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
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("blog_post_discussions")
        .select(`
          id,
          post_id,
          author_id,
          message,
          kind,
          created_at
        `)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      
      // Fetch author info separately for each message
      const messagesWithAuthors = await Promise.all(
        (data || []).map(async (message) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", message.author_id)
            .single();
          
          return {
            ...message,
            author: profile ? { full_name: profile.full_name || 'Unknown' } : { full_name: 'Unknown' }
          };
        })
      );
      
      setItems(messagesWithAuthors);
    } catch (error) {
      console.error("Failed to load discussions:", error);
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!postId) return;
    load();

    const channel = supabase
      .channel(`blog_discussions_${postId}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "blog_post_discussions", 
          filter: `post_id=eq.${postId}` 
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            // For INSERT events, fetch the author info and add to items
            const fetchAuthorAndAdd = async () => {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("user_id", payload.new.author_id)
                .single();
              
              const messageWithAuthor = {
                ...payload.new,
                author: profile ? { full_name: profile.full_name || 'Unknown' } : { full_name: 'Unknown' }
              };
              
              setItems((prev) => [...prev, messageWithAuthor as Discussion]);
            };
            fetchAuthorAndAdd();
          }
          if (payload.eventType === "DELETE") {
            setItems((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  const send = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    try {
      const { data: newMessage, error } = await supabase
        .from("blog_post_discussions")
        .insert({
          post_id: postId,
          author_id: user.id,
          message: text.trim(),
          kind: "comment"
        })
        .select("*")
        .single();
      
      if (error) throw error;
      if (newMessage) {
        // Get author info and add to UI immediately
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .single();
        
        const messageWithAuthor = {
          ...newMessage,
          author: profile ? { full_name: profile.full_name || 'Unknown' } : { full_name: 'Unknown' }
        };
        
        setItems((prev) => [...prev, messageWithAuthor]);
        setText("");
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
      const { error } = await supabase
        .from("blog_post_discussions")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast.success("Message deleted");
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
          {items.map((m) => {
            const isOwnMessage = user?.id === m.author_id;
            return (
              <div key={m.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group`}>
                <div className={`max-w-[80%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                  <div className="text-muted-foreground text-xs mb-1 flex items-center gap-2">
                    <span>{m.author?.full_name || 'Unknown'}</span>
                    <span>•</span>
                    <span>{new Date(m.created_at).toLocaleString()}</span>
                    <span>•</span>
                    <span>{m.kind}</span>
                    {(isAdmin || isOwnMessage) && (
                      <button 
                        onClick={() => handleDelete(m.id, m.author_id)}
                        className="text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Delete message"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className={`rounded-lg p-3 whitespace-pre-wrap leading-relaxed ${
                    isOwnMessage 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    {m.message}
                  </div>
                </div>
              </div>
            );
          })}
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