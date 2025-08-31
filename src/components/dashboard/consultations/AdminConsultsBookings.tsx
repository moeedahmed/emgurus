import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { showErrorToast } from "@/lib/errors";
import ErrorBoundary from "@/components/ErrorBoundary";

interface BookingRow {
  id: string;
  user_id: string;
  guru_id: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  price: number | null;
  payment_status: string | null;
}

export default function AdminConsultsBookings({ statusFilter }: { statusFilter?: 'upcoming' | 'past' | 'cancelled' }) {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      let query: any = supabase
        .from('consult_bookings')
        .select('id, user_id, guru_id, start_datetime, end_datetime, status, price, payment_status')
        .order('start_datetime', { ascending: false });

      // Apply status filter based on statusFilter prop
      if (statusFilter) {
        const now = new Date().toISOString();
        if (statusFilter === 'upcoming') {
          query = query.gte('start_datetime', now).neq('status', 'cancelled');
        } else if (statusFilter === 'past') {
          query = query.lt('end_datetime', now).neq('status', 'cancelled');
        } else if (statusFilter === 'cancelled') {
          query = query.eq('status', 'cancelled');
        }
      }

      // Apply additional filters
      if (status && status !== "all") query = (query as any).eq('status', status as any);
      if (from) query = query.gte('start_datetime', new Date(from).toISOString());
      if (to) query = query.lte('start_datetime', new Date(to).toISOString());
      
      const { data, error: queryError } = await query;
      
      if (queryError) {
        if (queryError.code === 'PGRST301' || queryError.message?.includes('permission')) {
          setError('You do not have permission to view bookings. Please contact an administrator.');
          return;
        }
        throw queryError;
      }
      
      const list = (data || []) as any as BookingRow[];
      setRows(list);
      const ids = Array.from(new Set(list.flatMap(r => [r.user_id, r.guru_id])));
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
        const map: Record<string,string> = {};
        (profs || []).forEach((p: any) => { map[p.user_id] = p.full_name || 'User'; });
        setNameMap(map);
      } else {
        setNameMap({});
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load bookings');
      showErrorToast(e, 'Failed to load bookings');
      setRows([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter, status, from, to]);

  const updateStatus = async (id: string, next: string) => {
    try {
      setUpdating((s) => ({ ...s, [id]: next }));
      const { error } = await supabase.from('consult_bookings').update({ status: next as any }).eq('id', id);
      if (error) throw error;
      toast.success('Status updated');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Update failed');
    } finally {
      setUpdating((s) => { const n = { ...s }; delete n[id]; return n; });
    }
  };

  const resend = async (id: string) => {
    try {
      const res = await fetch(`/functions/v1/notifications-dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'booking_updated', booking_id: id }),
      });
      if (!res.ok) throw new Error('Failed to trigger notifications');
      toast.success('Notifications enqueued');
    } catch (e: any) {
      toast.error(e.message || 'Failed to trigger notifications');
    }
  };

  const statuses = useMemo(() => [
    'pending_payment', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'refund_requested', 'refunded'
  ], []);

  if (error) {
    return (
      <div className="p-4 space-y-3">
        <Card className="p-6 border-destructive bg-destructive/5">
          <div className="text-sm text-destructive mb-2">Error loading bookings</div>
          <div className="text-xs text-muted-foreground mb-3">{error}</div>
          <Button size="sm" variant="outline" onClick={load}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">From</div>
            <Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">To</div>
            <Input type="date" value={to} onChange={(e)=>setTo(e.target.value)} />
          </div>
          <Button onClick={load} disabled={loading} variant="outline">
            {loading ? 'Loading...' : 'Apply'}
          </Button>
        </div>

        <Card className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Start</TableHead>
                <TableHead>Learner</TableHead>
                <TableHead>Guru</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading bookings...</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    No bookings found {statusFilter && `for ${statusFilter} filter`}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(r.start_datetime).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{nameMap[r.user_id] || r.user_id.slice(0,6)}</TableCell>
                    <TableCell className="text-xs">{nameMap[r.guru_id] || r.guru_id.slice(0,6)}</TableCell>
                    <TableCell className="text-xs">{r.price ? `$${r.price}` : 'Free'}</TableCell>
                    <TableCell className="text-xs">
                      <Select value={updating[r.id] || r.status} onValueChange={(v)=>updateStatus(r.id, v)}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={()=>resend(r.id)}>Resend notifications</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </ErrorBoundary>
  );
}
