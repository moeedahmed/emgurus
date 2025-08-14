import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { Trash2 } from "lucide-react";

interface Discussion {
  id: string;
  question_id: string;
  author_id: string;
  message: string;
  kind: string;
  created_at: string;
}

export default function QuestionChat({ questionId }: { questionId: string }) {
  const { user } = useAuth();
  const { isAdmin } = useRoles();
  const [items, setItems] = useState<Discussion[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!questionId) return;
    const { data, error } = await supabase
      .from("exam_question_discussions")
      .select("*")
      .eq("question_id", questionId)
      .order("created_at", { ascending: true });
    if (!error) setItems((data as any) || []);
  };

  useEffect(() => {
    load();
    // Optional: simple polling for now
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [questionId]);

  const send = async () => {
    if (!text.trim() || !user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("exam_question_discussions")
        .insert({ question_id: questionId, author_id: user.id, message: text.trim(), kind: "comment" });
      if (error) throw error;
      setText("");
      await load();
    } catch (e) {
      // Silently ignore for now; RLS will block unauthorized users
    } finally { setLoading(false); }
  };
  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    try {
      await supabase.from('exam_question_discussions').delete().eq('id', id);
      await load();
    } catch (e) {}
  };

  return (
    <Card className="p-3 md:p-4 h-[520px] flex flex-col">
      <div className="font-semibold mb-2">Discussion</div>
      <ScrollArea className="flex-1 min-h-0 pr-3">
        <div className="space-y-3 pb-2">
          {items.length === 0 && (
            <div className="text-sm text-muted-foreground">No messages yet.</div>
          )}
          {items.map((m) => (
            <div key={m.id} className="text-sm group">
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-xs mb-1">{new Date(m.created_at).toLocaleString()} • {m.kind}</div>
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" aria-label="Delete message" onClick={() => handleDelete(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="bg-muted rounded-md p-2 whitespace-pre-wrap leading-relaxed">{m.message}</div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="mt-2 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message..." onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } }} />
        <Button onClick={send} disabled={loading || !text.trim()}>Send</Button>
      </div>
    </Card>
  );
}