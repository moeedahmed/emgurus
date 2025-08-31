import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

interface ExamItem {
  id: string;
  stem: string | null;
  choices: any;
  explanation: string | null;
  exam_type: string | null;
  status?: string | null;
  created_at?: string;
}

const PAGE_SIZE = 10;

interface FlagItem { id: string; question_id: string; comment?: string | null; created_at: string; status: string; }

const GuruReviewQueue = () => {
  const [items, setItems] = useState<ExamItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<ExamItem | null>(null);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteTargetId, setNoteTargetId] = useState<string | null>(null);

  const [flags, setFlags] = useState<FlagItem[]>([]);

  const combined = useMemo(() => {
    const a = items.map((it) => ({
      key: `assign:${it.id}`,
      when: it.created_at || '',
      question: (it.stem ?? '').slice(0, 140) || '(no stem)',
      exam: it.exam_type ?? 'UNKNOWN',
      marked: false as const,
      source: 'assigned' as const,
      ref: it,
    }));
    const b = flags.map((f) => ({
      key: `flag:${f.id}`,
      when: f.created_at,
      question: (f.comment ? `Marked: ${f.comment}` : 'Marked question'),
      exam: '-',
      marked: true as const,
      source: 'flag' as const,
      ref: f,
    }));
    return [...a, ...b].sort((x, y) => new Date(y.when).getTime() - new Date(x.when).getTime());
  }, [items, flags]);

  useEffect(() => {
    document.title = "Review Queue | EM Gurus";
  }, []);

  const offset = useMemo(() => (page - 1) * PAGE_SIZE, [page]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("list_exam_reviewer_queue", {
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });
      if (error) throw error;
      const rows: ExamItem[] = data ?? [];
      setItems(rows);
      setTotal(rows.length < PAGE_SIZE && page === 1 ? rows.length : null);
    } catch (e: any) {
      setError(e?.message || "Failed to load queue");
      toast.error(e?.message || "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }

  async function loadFlags() {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data, error } = await supabase
        .from('exam_question_flags')
        .select('id, question_id, comment, created_at, status')
        .eq('assigned_to', uid)
        .in('status', ['assigned','open']);
      if (error) throw error;
      setFlags((data as any) || []);
    } catch (e: any) {
      // silent
    }
  }

  useEffect(() => {
    load();
    loadFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const approve = async (id: string) => {
    try {
      const { error } = await supabase.rpc("exam_approve", { p_question_id: id });
      if (error) throw error;
      toast.success("Approved");
      setConfirmId(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Approve failed");
    }
  };

  const requestChanges = async () => {
    if (!noteTargetId) return;
    try {
      const { error } = await supabase.rpc("exam_request_changes", { p_question_id: noteTargetId, p_note: noteText || "" });
      if (error) throw error;
      toast.success("Requested changes");
      setNoteOpen(false);
      setNoteText("");
      setNoteTargetId(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Request failed");
    }
  };

  const nextPage = () => setPage((p) => p + 1);
  const prevPage = () => setPage((p) => Math.max(1, p - 1));

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Review AI-Generated Questions</h1>
      <p className="text-muted-foreground mb-6">Approve or request changes on questions assigned to you.</p>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead className="w-[50%]">Question</TableHead>
              <TableHead>Exam</TableHead>
              <TableHead>Marked</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading…</TableCell>
              </TableRow>
            )}
            {!loading && error && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-destructive">{error}</TableCell>
              </TableRow>
            )}
            {!loading && !error && combined.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No items assigned.</TableCell>
              </TableRow>
            )}
            {!loading && !error && combined.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(row.when).toLocaleString()}</TableCell>
                <TableCell className="text-xs">
                  {row.source === 'assigned' ? (
                    <button className="text-left hover:underline" onClick={() => setDetail(row.ref as any)}>
                      {row.question}
                    </button>
                  ) : (
                    <span title={(row.ref as any)?.comment || ''}>{row.question}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">{row.exam}</TableCell>
                <TableCell className="text-xs">{row.marked ? 'Yes' : 'No'}</TableCell>
                <TableCell className="text-right space-x-2">
                  {row.source === 'assigned' ? (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => { setNoteTargetId((row.ref as any).id); setNoteOpen(true); }}>Request changes</Button>
                      <Button size="sm" onClick={() => setConfirmId((row.ref as any).id)}>Approve</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" onClick={async () => {
                        const { data: u } = await supabase.auth.getUser();
                        const uid = u.user?.id;
                        await supabase.from('exam_question_flags').update({ status: 'resolved', resolved_by: uid }).eq('id', (row.ref as any).id);
                        loadFlags();
                      }}>Approve & Resolve</Button>
                      <Button variant="destructive" size="sm" onClick={() => { setNoteTargetId((row.ref as any).id); setNoteOpen(true); }}>Remove</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Page {page}{total !== null ? "" : ""}</div>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={prevPage} disabled={page === 1 || loading}>Previous</Button>
          <Button variant="outline" size="sm" onClick={nextPage} disabled={loading || items.length < PAGE_SIZE}>Next</Button>
        </div>
      </div>

      {/* Detail Drawer (using Dialog for simplicity) */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Question detail</DialogTitle>
            <DialogDescription>Review the stem, choices and explanation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-1">Stem</h3>
              <p className="whitespace-pre-wrap leading-relaxed">{detail?.stem}</p>
            </div>
            <div>
              <h3 className="font-medium mb-1">Choices</h3>
              <ul className="list-disc pl-5 space-y-1">
                {Array.isArray(detail?.choices)
                  ? (detail?.choices as any[]).map((c, i) => <li key={i}>{typeof c === 'string' ? c : JSON.stringify(c)}</li>)
                  : detail?.choices ? <li>{JSON.stringify(detail?.choices)}</li> : <li>(none)</li>}
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-1">Explanation</h3>
              <p className="whitespace-pre-wrap leading-relaxed">{detail?.explanation || "—"}</p>
            </div>
            <div>
              <Badge variant="outline">{detail?.exam_type ?? "UNKNOWN"}</Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve confirmation */}
      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this question?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmId && approve(confirmId)}>Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Request changes or Remove modal (reused) */}
      <Dialog open={noteOpen} onOpenChange={(o) => { setNoteOpen(o); if (!o) { setNoteText(""); setNoteTargetId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provide a note</DialogTitle>
            <DialogDescription>Add a short reason for removal or requested changes.</DialogDescription>
          </DialogHeader>
          <Textarea value={noteText} onChange={(e) => setNoteText(e.currentTarget.value)} placeholder="Your note…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNoteOpen(false); setNoteText(""); setNoteTargetId(null); }}>Cancel</Button>
            <Button onClick={async () => {
              if (!noteTargetId) return;
              if (flags.find(f => f.id === noteTargetId)) {
                const { data: u } = await supabase.auth.getUser();
                const uid = u.user?.id;
                await supabase.from('exam_question_flags').update({ status: 'removed', resolved_by: uid, resolution_note: noteText }).eq('id', noteTargetId);
                loadFlags();
                setNoteOpen(false);
                setNoteText("");
                setNoteTargetId(null);
              } else {
                await requestChanges();
              }
            }}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default GuruReviewQueue;
