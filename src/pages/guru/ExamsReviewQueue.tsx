import { useEffect, useMemo, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { callFunction } from "@/lib/functionsUrl";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface QueueItem {
  assignment_id: string;
  question_id: string;
  created_at: string;
  note?: string | null;
  preview?: {
    id: string;
    created_at: string;
    question_text: string;
    exam_type?: string | null;
    difficulty_level?: string | null;
    topic?: string | null;
  } | null;
}

interface QuestionFull {
  id: string;
  question_text: string;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_answer?: "A" | "B" | "C" | "D" | null;
  explanation?: string | null;
  exam_type?: string | null;
  difficulty_level?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  keywords?: string[] | null;
}

const ExamsReviewQueue = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [openLoadingId, setOpenLoadingId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<{ assignment_id: string; question_id: string } | null>(null);
  const [model, setModel] = useState<QuestionFull | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const loadQueue = async () => {
    setLoading(true);
    try {
      const res = await callFunction("/exams-guru-review/queue", null, true);
      setQueue(res?.data || []);
    } catch (e: any) {
      toast({ title: "Failed to load queue", description: e.message || "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openEditor = async (item: QueueItem) => {
    if (openLoadingId) return;
    
    setOpenLoadingId(item.assignment_id);
    setActive({ assignment_id: item.assignment_id, question_id: item.question_id });
    setOpen(true);
    try {
      const res = await callFunction(`/exams-guru-review/item/${item.question_id}`, null, true);
      setModel(res?.data as QuestionFull);
    } catch (e: any) {
      toast({ title: "Failed to load item", description: e.message || "", variant: "destructive" });
      setOpen(false);
    } finally {
      setOpenLoadingId(null);
    }
  };

  useEffect(() => {
    document.title = "Review Queue | Guru | EMGurus";
    loadQueue();
  }, []);

  const onChange = (patch: Partial<QuestionFull>) => setModel((m) => (m ? { ...m, ...patch } : m));

  const saveApprove = async () => {
    if (!active || !model || actionLoading) return;
    try {
      setActionLoading(true);
      const updates: any = {
        question_text: model.question_text,
        option_a: model.option_a,
        option_b: model.option_b,
        option_c: model.option_c,
        option_d: model.option_d,
        correct_answer: model.correct_answer,
        explanation: model.explanation,
        exam_type: model.exam_type,
        difficulty_level: model.difficulty_level,
        topic: model.topic,
        subtopic: model.subtopic,
        keywords: model.keywords,
      };
      await callFunction("/exams-guru-review/save-and-approve", {
        assignment_id: active.assignment_id,
        question_id: active.question_id,
        updates,
      }, true);
      toast({ title: "Approved", description: "Question saved and approved." });
      setOpen(false);
      setModel(null);
      await loadQueue();
    } catch (e: any) {
      toast({ title: "Failed to approve", description: e.message || "", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async () => {
    if (!active || rejectNote.trim().length < 3 || actionLoading) {
      toast({ title: "Add a note", description: "Please include a short reason." });
      return;
    }
    try {
      setActionLoading(true);
      await callFunction("/exams-guru-review/reject", {
        assignment_id: active.assignment_id,
        question_id: active.question_id,
        note: rejectNote,
      }, true);
      toast({ title: "Rejected", description: "Assignment marked as rejected." });
      setOpen(false);
      setModel(null);
      setRejectNote("");
      await loadQueue();
    } catch (e: any) {
      toast({ title: "Failed to reject", description: e.message || "", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Exams Review Queue</h1>
      <Card className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">Created</TableHead>
                <TableHead className="w-full md:w-auto min-w-[200px]">Question</TableHead>
                <TableHead className="min-w-[80px]">Exam</TableHead>
                <TableHead className="min-w-[90px]">Difficulty</TableHead>
                <TableHead className="min-w-[80px]">Topic</TableHead>
                <TableHead className="min-w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {queue.map((item) => (
              <TableRow key={item.assignment_id}>
                <TableCell className="text-sm">{new Date(item.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-sm">
                  <div className="truncate max-w-[200px]" title={item.preview?.question_text || "(open to view)"}>
                    {item.preview?.question_text || "(open to view)"}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{item.preview?.exam_type || '-'}</TableCell>
                <TableCell className="text-sm">{item.preview?.difficulty_level || '-'}</TableCell>
                <TableCell className="text-sm">{item.preview?.topic || '-'}</TableCell>
                 <TableCell className="text-right">
                   <Button 
                     size="sm" 
                     onClick={() => openEditor(item)} 
                     disabled={loading || openLoadingId === item.assignment_id}
                   >
                     {openLoadingId === item.assignment_id ? "..." : "Open"}
                   </Button>
                 </TableCell>
              </TableRow>
            ))}
            {queue.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">No items in your queue</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-3xl p-6">
            <DrawerHeader>
              <DrawerTitle>Edit Question</DrawerTitle>
            </DrawerHeader>
            {model && (
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium">Question Text</label>
                  <Textarea value={model.question_text || ""} onChange={(e) => onChange({ question_text: e.target.value })} rows={5} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Option A</label>
                    <Input value={model.option_a || ""} onChange={(e) => onChange({ option_a: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Option B</label>
                    <Input value={model.option_b || ""} onChange={(e) => onChange({ option_b: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Option C</label>
                    <Input value={model.option_c || ""} onChange={(e) => onChange({ option_c: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Option D</label>
                    <Input value={model.option_d || ""} onChange={(e) => onChange({ option_d: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Correct Answer</label>
                    <Select value={model.correct_answer || undefined} onValueChange={(v) => onChange({ correct_answer: v as any })}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {(["A","B","C","D"] as const).map(k => (
                          <SelectItem key={k} value={k}>{k}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Explanation</label>
                  <Textarea value={model.explanation || ""} onChange={(e) => onChange({ explanation: e.target.value })} rows={4} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Exam Type</label>
                    <Input value={model.exam_type || ""} onChange={(e) => onChange({ exam_type: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Difficulty</label>
                    <Input value={model.difficulty_level || ""} onChange={(e) => onChange({ difficulty_level: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Topic</label>
                    <Input value={model.topic || ""} onChange={(e) => onChange({ topic: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Subtopic</label>
                    <Input value={model.subtopic || ""} onChange={(e) => onChange({ subtopic: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Keywords (comma-separated)</label>
                  <Input value={(model.keywords || []).join(', ')} onChange={(e) => onChange({ keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                </div>
            </div>
            )}
            <DrawerFooter className="flex flex-col sm:flex-row items-center gap-2 pt-6">
              <Button onClick={saveApprove} disabled={actionLoading || !model} className="w-full sm:w-auto">
                {actionLoading ? "Saving..." : "Save & Approve"}
              </Button>
              <div className="flex-1" />
              <div className="flex gap-2 w-full sm:w-auto">
                <Input 
                  placeholder="Reject note" 
                  value={rejectNote} 
                  onChange={(e) => setRejectNote(e.target.value)}
                  className="flex-1 sm:min-w-[200px]"
                  required
                />
                <Button variant="destructive" onClick={reject} disabled={actionLoading || !active}>
                  {actionLoading ? "Rejecting..." : "Reject"}
                </Button>
              </div>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </main>
  );
};

export default ExamsReviewQueue;
