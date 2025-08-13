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

type StatusFilter = 'pending' | 'approved' | 'rejected';
const ApproveGurus: React.FC<{ embedded?: boolean; status?: StatusFilter }> = ({ embedded = false, status = 'pending' }) => {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [counts, setCounts] = useState<{ pending: number; approved7d: number; rejected7d: number }>({ pending: 0, approved7d: 0, rejected7d: 0 });

  useEffect(() => {
    if (!embedded) document.title = "Approve Gurus | EMGurus";
    (async () => {
      const { data } = await supabase
        .from('guru_applications')
        .select('id, user_id, created_at, status, notes')
        .eq('status', status)
        .order('created_at', { ascending: status === 'pending' });
      setApps((data || []) as any);

      const now = new Date();
      const ago7 = new Date(now.getTime() - 7*24*60*60*1000).toISOString();
      const [ { count: pCount }, { count: a7 }, { count: r7 } ] = await Promise.all([
        supabase.from('guru_applications').select('id', { count: 'exact', head: true }).eq('status','pending'),
        supabase.from('guru_applications').select('id', { count: 'exact', head: true }).eq('status','approved').gte('updated_at', ago7),
        supabase.from('guru_applications').select('id', { count: 'exact', head: true }).eq('status','rejected').gte('updated_at', ago7),
      ]);
      setCounts({ pending: pCount ?? 0, approved7d: a7 ?? 0, rejected7d: r7 ?? 0 });

      const ids = Array.from(new Set((data || []).map((a: any) => a.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, country, specialty, exams, timezone, bio')
          .in('user_id', ids);
        const map: Record<string, any> = {};
        (profs || []).forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      } else {
        setProfiles({});
      }
    })();
  }, [embedded, status]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    let reason: string | undefined;
    if (action === 'reject') {
      reason = window.prompt('Enter rejection reason (required)') || '';
      if (!reason.trim()) { return; }
    }
    const row = apps.find((a) => a.id === id);
    const userId = row?.user_id;
    const { error } = await supabase
      .from('guru_applications')
      .update({ status: nextStatus, ...(reason ? { notes: reason } : {}) })
      .eq('id', id);
    if (error) {
      toast({ title: 'Failed', description: error.message });
      return;
    }
    try {
      if (userId) {
        await fetch('/functions/v1/notifications-dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toUserIds: [userId],
            subject: nextStatus === 'approved' ? 'Your Guru request was approved' : 'Your Guru request was rejected',
            html: nextStatus === 'approved' ? '<p>Congratulations! Your Guru request has been approved.</p>' : `<p>Your Guru request was rejected.</p>${reason ? `<p>Reason: ${reason}</p>` : ''}`,
            inApp: [{ userId, type: 'guru_application', title: `Guru ${nextStatus}`, body: reason || null }],
          }),
        });
      }
    } catch (e) { /* non-blocking */ }
    toast({ title: `Application ${nextStatus}` });
    setApps((prev) => prev.filter((a) => a.id !== id));
  };
  return (
    <main className="container mx-auto px-4 py-8">
      {!embedded && (
        <>
          <h1 className="text-3xl font-bold mb-2">Guru Approvals</h1>
          <p className="text-muted-foreground mb-6">
            {status === 'pending' && 'Users requesting Guru status.'}
            {status === 'approved' && 'Requests you approved.'}
            {status === 'rejected' && 'Requests you rejected (with reason).'}
          </p>
        </>
      )}

      <div className="grid gap-2 grid-cols-1 sm:grid-cols-3 mb-4">
        <Card className="p-3 text-sm"><div className="text-muted-foreground">Pending</div><div className="text-xl font-semibold">{counts.pending}</div></Card>
        <Card className="p-3 text-sm"><div className="text-muted-foreground">Approved (7d)</div><div className="text-xl font-semibold">{counts.approved7d}</div></Card>
        <Card className="p-3 text-sm"><div className="text-muted-foreground">Rejected (7d)</div><div className="text-xl font-semibold">{counts.rejected7d}</div></Card>
      </div>

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
                    {status === 'pending' && (
                      <>
                        <Button variant="outline" onClick={() => act(a.id, 'reject')}>Reject</Button>
                        <Button onClick={() => act(a.id, 'approve')}>Approve</Button>
                      </>
                    )}
                    {status === 'approved' && (
                      <Button variant="outline" onClick={() => act(a.id, 'reject')}>Reject</Button>
                    )}
                    {status === 'rejected' && (
                      <Button onClick={() => act(a.id, 'approve')}>Approve</Button>
                    )}
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
