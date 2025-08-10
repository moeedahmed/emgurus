import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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

  useEffect(() => {
    document.title = "Review Queue | EMGurus";
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
      // We don't have a total from the RPC; approximate: if fewer than page size, end reached
      setTotal(rows.length < PAGE_SIZE && page === 1 ? rows.length : null);
    } catch (e: any) {
      setError(e?.message || "Failed to load queue");
      toast.error(e?.message || "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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
              <TableHead className="w-[60%]">Question</TableHead>
              <TableHead>Exam</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Loading…</TableCell>
              </TableRow>
            )}
            {!loading && error && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-destructive">{error}</TableCell>
              </TableRow>
            )}
            {!loading && !error && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No items assigned.</TableCell>
              </TableRow>
            )}
            {!loading && !error && items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>
                  <button className="text-left hover:underline" onClick={() => setDetail(it)}>
                    {(it.stem ?? "").slice(0, 140) || "(no stem)"}
                  </button>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{it.exam_type ?? "UNKNOWN"}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="secondary" size="sm" onClick={() => { setNoteTargetId(it.id); setNoteOpen(true); }}>Request changes</Button>
                  <Button variant="default" size="sm" onClick={() => setConfirmId(it.id)}>Approve</Button>
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

      {/* Request changes modal */}
      <Dialog open={noteOpen} onOpenChange={(o) => { setNoteOpen(o); if (!o) { setNoteText(""); setNoteTargetId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>Add a short note explaining what to improve.</DialogDescription>
          </DialogHeader>
          <Textarea value={noteText} onChange={(e) => setNoteText(e.currentTarget.value)} placeholder="Your feedback…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNoteOpen(false); setNoteText(""); setNoteTargetId(null); }}>Cancel</Button>
            <Button onClick={requestChanges} disabled={!noteTargetId}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default GuruReviewQueue;
