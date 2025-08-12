import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AppRow {
  id: string;
  user_id: string;
  created_at: string;
  status: string;
  notes: string | null;
}

const ApproveGurus = () => {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    document.title = "Approve Gurus | EMGurus";
    (async () => {
      const { data } = await supabase
        .from('guru_applications')
        .select('id, user_id, created_at, status, notes')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      setApps((data || []) as any);
      const ids = Array.from(new Set((data || []).map((a: any) => a.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, country, specialty, exams, timezone, bio')
          .in('user_id', ids);
        const map: Record<string, any> = {};
        (profs || []).forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      }
    })();
  }, []);

  const act = async (id: string, action: 'approve' | 'reject') => {
    const status = action === 'approve' ? 'approved' : 'rejected';
    const { error } = await supabase
      .from('guru_applications')
      .update({ status })
      .eq('id', id);
    if (error) {
      toast({ title: 'Failed', description: error.message });
      return;
    }
    toast({ title: `Application ${status}` });
    setApps((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Approve Gurus</h1>
      <p className="text-muted-foreground mb-6">Review and decide on pending applications.</p>

      {apps.length === 0 ? (
        <div className="rounded-lg border p-6 bg-card">No pending applications.</div>
      ) : (
        <section className="space-y-4">
          {apps.map((a) => {
            const p = profiles[a.user_id] || {};
            return (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-semibold">{p.full_name || p.email || a.user_id}</div>
                    <div className="text-sm text-muted-foreground">{p.country} • {p.specialty} • {p.timezone}</div>
                    <div className="flex flex-wrap gap-2 py-1">
                      {(p.exams || []).map((e: string) => (<Badge key={e} variant="outline">{e}</Badge>))}
                    </div>
                    {a.notes && (
                      <div className="text-sm"><span className="font-medium">Why Guru:</span> {a.notes}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => act(a.id, 'reject')}>Reject</Button>
                    <Button onClick={() => act(a.id, 'approve')}>Approve</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      <Separator className="mt-8" />
    </main>
  );
};

export default ApproveGurus;
