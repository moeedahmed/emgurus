import { useEffect, useMemo, useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface NotificationRow {
  id: string;
  title: string;
  body?: string | null;
  type: string;
  created_at: string;
  read_at?: string | null;
  data?: any;
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const unread = useMemo(() => rows.filter(r => !r.read_at).length, [rows]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setRows((data as any) || []);
    } catch (e) {
      // silent; header should not toast
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const markAllRead = async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return;
      const ids = rows.filter(r => !r.read_at).map(r => r.id);
      if (ids.length === 0) return;
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', ids);
      setRows(prev => prev.map(r => ({ ...r, read_at: r.read_at || new Date().toISOString() })));
    } catch {}
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button aria-label="Notifications" className="relative rounded-md p-2 hover:bg-accent">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] px-1">
              {unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unread === 0}>Mark all read</Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="py-6 text-center text-muted-foreground">No notifications</div>
        )}
        {!loading && rows.map((r) => (
          <DropdownMenuItem key={r.id} className="flex flex-col items-start whitespace-normal">
            <div className="flex items-center gap-2 w-full">
              {!r.read_at ? <span className="h-2 w-2 rounded-full bg-primary" /> : <Check className="w-3 h-3 text-muted-foreground" />}
              <span className="font-medium text-sm flex-1">{r.title}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
            </div>
            {r.body && <div className="text-xs text-muted-foreground mt-1">{r.body}</div>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
