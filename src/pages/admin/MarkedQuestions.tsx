import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FlagRow {
  id: string;
  question_id: string;
  question_source: string;
  flagged_by: string;
  comment?: string | null;
  status: 'open' | 'assigned' | 'resolved' | 'removed' | 'archived';
  assigned_to?: string | null;
  created_at: string;
}

interface GuruOption { id: string; name: string; }

export default function MarkedQuestionsAdmin() {
  const { toast } = useToast();
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [gurus, setGurus] = useState<GuruOption[]>([]);
  const [assigning, setAssigning] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = "Marked Questions | Admin | EMGurus";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Manage questions flagged by users: assign to gurus, archive, resolve.");
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('exam_question_flags').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setFlags((data as any) || []);
    } catch (e: any) {
      toast({ title: 'Failed to load', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadGurus = async () => {
    try {
      const { data: roleRows } = await supabase.from('user_roles').select('user_id').eq('role', 'guru');
      const ids = (roleRows || []).map((r: any) => r.user_id);
      if (ids.length === 0) { setGurus([]); return; }
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids);
      const opts: GuruOption[] = (profs || []).map((p: any) => ({ id: p.user_id, name: p.full_name || p.email || p.user_id.slice(0,6) }));
      setGurus(opts);
    } catch {}
  };

  useEffect(() => { load(); loadGurus(); }, []);

  const assign = async (flagId: string, guruId?: string) => {
    if (!guruId) return;
    try {
      await supabase.from('exam_question_flags').update({ assigned_to: guruId, status: 'assigned' }).eq('id', flagId);
      toast({ title: 'Assigned', description: 'Flag assigned to guru.' });
      await load();
    } catch (e: any) {
      toast({ title: 'Assignment failed', description: e.message, variant: 'destructive' });
    }
  };

  const archive = async (flagId: string) => {
    try {
      await supabase.from('exam_question_flags').update({ status: 'archived' }).eq('id', flagId);
      toast({ title: 'Archived', description: 'Flag archived.' });
      await load();
    } catch (e: any) {
      toast({ title: 'Archive failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Marked Questions</h1>
          <Button variant="outline" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assign</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="whitespace-nowrap text-xs">{new Date(f.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{f.question_source}</TableCell>
                  <TableCell className="text-xs max-w-[360px] truncate" title={f.comment || ''}>{f.comment || '—'}</TableCell>
                  <TableCell className="text-xs">{f.status}</TableCell>
                  <TableCell>
                    <Select value={assigning[f.id] || f.assigned_to || ''} onValueChange={(v) => setAssigning(s => ({ ...s, [f.id]: v }))}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder={f.assigned_to ? 'Assigned' : 'Select guru'} />
                      </SelectTrigger>
                      <SelectContent>
                        {gurus.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" onClick={() => assign(f.id, assigning[f.id])} disabled={!assigning[f.id]}>Assign</Button>
                    <Button variant="outline" size="sm" onClick={() => archive(f.id)}>Archive</Button>
                  </TableCell>
                </TableRow>
              ))}
              {flags.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">No marked questions</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </main>
      <Footer />
      <link rel="canonical" href={`${window.location.origin}/admin/marked-questions`} />
    </div>
  );
}
