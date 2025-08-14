import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import FilterChips from "@/components/ui/filter-chips";

const STATUS = ["open", "in_review", "resolved", "dismissed"] as const;

type Flag = {
  id: string;
  reason: string;
  status: typeof STATUS[number];
  flagged_by: string;
  assigned_to: string | null;
  thread_id: string | null;
  reply_id: string | null;
  created_at: string;
  resolution_note: string | null;
};

interface ForumsModerationQueueProps {
  isAdmin?: boolean;
}

export default function ForumsModerationQueue({ isAdmin = false }: ForumsModerationQueueProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<typeof STATUS[number]>("open");
  const [rows, setRows] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase.from("forum_flags").select("id,reason,status,flagged_by,assigned_to,thread_id,reply_id,created_at,resolution_note");
      
      if (!isAdmin) {
        // For gurus, only show flags assigned to them
        query = query.eq("assigned_to", user?.id);
      }
      
      query = query.eq("status", status).order("created_at", { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      setRows(data as any);
    } catch (e: any) {
      console.error(e);
      setRows([]);
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { load(); }, [status, user?.id, isAdmin]);

  const assignToMe = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("forum_flags").update({ assigned_to: user.id, status: "in_review" }).eq("id", id);
    if (error) { toast({ title: "Assign failed" }); return; }
    toast({ title: "Assigned" });
    load();
  };

  const setFlagStatus = async (id: string, next: typeof STATUS[number]) => {
    const payload: any = { status: next };
    if (next !== "open") payload.resolution_note = note[id] || null;
    const { error } = await supabase.from("forum_flags").update(payload).eq("id", id);
    if (error) { toast({ title: "Update failed" }); return; }
    toast({ title: "Updated" });
    load();
  };

  const filterItems = STATUS.map(s => ({ 
    label: s.replace('_', ' ').charAt(0).toUpperCase() + s.replace('_', ' ').slice(1), 
    value: s 
  }));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {isAdmin ? "Organization-wide flag handling." : "Review and resolve flagged posts."}
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>Refresh</Button>
      </div>

      <div className="flex items-center gap-4">
        <FilterChips
          items={filterItems}
          mode="single"
          selected={status}
          onChange={(value) => setStatus(value as typeof STATUS[number])}
          variant="outline"
          size="sm"
        />
      </div>

      <div className="space-y-3">
        {rows.map((f) => (
          <Card key={f.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium flex items-center gap-2">
                  <span>{f.reason}</span>
                  <Badge variant="secondary">{f.status.replace('_', ' ')}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Flagged: {new Date(f.created_at).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Thread: {f.thread_id ? f.thread_id.slice(0, 8) : '-'} · Reply: {f.reply_id ? f.reply_id.slice(0, 8) : '-'}</div>
                {f.resolution_note && (
                  <div className="text-xs mt-2"><span className="font-medium">Note:</span> {f.resolution_note}</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {isAdmin && (
                  <Button variant="secondary" onClick={() => assignToMe(f.id)}>Assign to me</Button>
                )}
                <Button variant="outline" onClick={() => setFlagStatus(f.id, "in_review")}>Mark In Review</Button>
                <Button variant="outline" onClick={() => setFlagStatus(f.id, "dismissed")}>Dismiss</Button>
                <Button onClick={() => setFlagStatus(f.id, "resolved")}>Resolve</Button>
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm">Resolution note</label>
              <Textarea 
                value={note[f.id] || ""} 
                onChange={(e) => setNote(prev => ({ ...prev, [f.id]: e.target.value }))} 
                placeholder="Optional note for audit trail" 
              />
            </div>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">
            {loading ? "Loading..." : "No items."}
          </Card>
        )}
      </div>
    </div>
  );
}