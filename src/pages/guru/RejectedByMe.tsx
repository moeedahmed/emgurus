import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Row {
  id: string;
  question_id: string;
  status: string;
  note?: string | null;
  created_at?: string;
  question?: { id: string; stem?: string | null; exam_type?: string | null } | null;
}

export default function RejectedByMe() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Rejected by Me | Guru | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content','Questions you rejected with notes. Read-only history.');
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setItems([]); return; }
        // Pull from exam_review_assignments to ensure we get the reviewer and note
        const { data, error } = await (supabase as any)
          .from('exam_review_assignments')
          .select('id, question_id, reviewer_id, status, note, created_at, question:exam_questions(id, stem, exam_type)')
          .eq('reviewer_id', user.id)
          .in('status', ['rejected','changes_requested']);
        if (error) throw error;
        setItems((data || []) as Row[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-2">Rejected</h1>
      <p className="text-muted-foreground mb-4">Read-only list of items you rejected. Admins can see your note.</p>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[55%]">Question</TableHead>
              <TableHead>Exam</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No rejected items.</TableCell></TableRow>
            )}
            {!loading && items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="align-top">
                  <div className="line-clamp-3 text-sm">{r.question?.stem || '—'}</div>
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant="secondary">{r.question?.exam_type || '—'}</Badge>
                </TableCell>
                <TableCell className="align-top text-xs whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</TableCell>
                <TableCell className="align-top text-xs max-w-[360px] truncate" title={r.note || ''}>{r.note || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </main>
  );
}
