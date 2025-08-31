import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

interface GuruRow { guru_id: string; is_public: boolean; base_rate: number | null; }

export default function AdminConsultsGurus() {
  const [rows, setRows] = useState<GuruRow[]>([]);
  const [names, setNames] = useState<Record<string,string>>({});

  const load = async () => {
    try {
      const { data } = await supabase.from('consult_pricing').select('guru_id, is_public, base_rate');
      const list = (data || []) as any as GuruRow[];
      setRows(list);
      const ids = Array.from(new Set(list.map(r => r.guru_id)));
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
        const map: Record<string,string> = {};
        (profs || []).forEach((p: any) => { map[p.user_id] = p.full_name || 'Guru'; });
        setNames(map);
      }
    } catch {
      setRows([]);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (guru_id: string, is_public: boolean) => {
    try {
      const { error } = await supabase.from('consult_pricing').update({ is_public }).eq('guru_id', guru_id);
      if (error) throw error;
      toast.success(is_public ? 'Unpaused' : 'Paused');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    }
  };

  return (
    <div className="p-4 space-y-3">
      {rows.map(r => (
        <Card key={r.guru_id} className="p-4 flex items-center justify-between">
          <div>
            <div className="font-medium">{names[r.guru_id] || r.guru_id.slice(0,6)}</div>
            <div className="text-sm text-muted-foreground">Base rate: {r.base_rate ? `$${r.base_rate}` : '—'}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm">Active</div>
            <Switch checked={r.is_public} onCheckedChange={(v)=>toggle(r.guru_id, v)} />
            <Button asChild size="sm" variant="outline"><a href={`/guru/availability?guru=${r.guru_id}`} target="_blank" rel="noreferrer">View availability</a></Button>
          </div>
        </Card>
      ))}
      {rows.length === 0 && <Card className="p-6 text-sm text-muted-foreground">No gurus set up for consultations.</Card>}
    </div>
  );
}
