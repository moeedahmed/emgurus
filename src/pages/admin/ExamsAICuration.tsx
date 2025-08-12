import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { callFunction } from "@/lib/functionsUrl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface LiteQuestion {
  id: string;
  created_at: string;
  question_text: string;
  exam_type?: string | null;
  difficulty_level?: string | null;
  topic?: string | null;
}

interface GuruOption { id: string; label: string }

const ExamsAICuration = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<LiteQuestion[]>([]);
  const [approved, setApproved] = useState<LiteQuestion[]>([]);
  const [rejected, setRejected] = useState<LiteQuestion[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [gurus, setGurus] = useState<GuruOption[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [reviewerId, setReviewerId] = useState<string | undefined>();

  useEffect(() => {
    document.title = "AI Curation | Admin | EMGurus";
    // initial load
    (async () => {
      setLoading(true);
      try {
        const [gen, app, rej, g] = await Promise.all([
          callFunction("/exams-admin-curate/generated", null, true),
          callFunction("/exams-admin-curate/approved", null, true),
          callFunction("/exams-admin-curate/rejected", null, true),
          callFunction("/exams-admin-curate/gurus", null, true),
        ]);
        setGenerated(gen?.data || []);
        setApproved(app?.data || []);
        setRejected(rej?.data || []);
        setGurus((g?.data || []) as GuruOption[]);
      } catch (e: any) {
        toast({ title: "Load failed", description: e.message || "Could not load data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allSelectedIds = useMemo(() => Object.keys(selected).filter(id => selected[id]), [selected]);
  const toggleOne = (id: string) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleAll = () => {
    const flag = generated.length > 0 && allSelectedIds.length !== generated.length;
    const next: Record<string, boolean> = {};
    generated.forEach((q) => { next[q.id] = flag; });
    setSelected(next);
  };

  const onAssign = async () => {
    if (!reviewerId) {
      toast({ title: "Pick a Guru", description: "Select a reviewer before assigning.", variant: "destructive" });
      return;
    }
    if (allSelectedIds.length === 0) {
      toast({ title: "No selection", description: "Choose at least one question.", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      await callFunction("/exams-admin-curate/assign", { question_ids: allSelectedIds, reviewer_id: reviewerId }, true);
      toast({ title: "Assigned", description: `Assigned ${allSelectedIds.length} question(s).` });
      setAssignOpen(false);
      setSelected({});
      // refresh generated + approved
      const [gen, app] = await Promise.all([
        callFunction("/exams-admin-curate/generated", null, true),
        callFunction("/exams-admin-curate/approved", null, true),
      ]);
      setGenerated(gen?.data || []);
      setApproved(app?.data || []);
    } catch (e: any) {
      toast({ title: "Assign failed", description: e.message || "Please try again." , variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">AI-Generated Exams Curation</h1>

      {/* Generator */}
      <section id="generator" className="mb-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">AI Question Generator</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-1">
              <label className="text-sm">Exam</label>
              <input className="mt-1 w-full rounded-md border bg-background p-2" placeholder="e.g. mrcem_sba" onChange={(e)=> (window as any)._genExam=e.target.value} />
            </div>
            <div className="md:col-span-1">
              <label className="text-sm">Topic</label>
              <input className="mt-1 w-full rounded-md border bg-background p-2" placeholder="e.g. Chest pain" onChange={(e)=> (window as any)._genTopic=e.target.value} />
            </div>
            <div className="md:col-span-1">
              <label className="text-sm">Difficulty</label>
              <input className="mt-1 w-full rounded-md border bg-background p-2" placeholder="easy | medium | hard" onChange={(e)=> (window as any)._genDiff=e.target.value} />
            </div>
            <div className="md:col-span-1">
              <label className="text-sm">Count</label>
              <input type="number" min={1} max={10} defaultValue={10} className="mt-1 w-full rounded-md border bg-background p-2" onChange={(e)=> (window as any)._genCount=Number(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={async ()=>{
              const exam = ((window as any)._genExam||'').trim();
              const topic = ((window as any)._genTopic||'').trim();
              const difficulty = ((window as any)._genDiff||'').trim();
              let count = Number((window as any)._genCount||10); count = Math.max(1, Math.min(10, isNaN(count)?10:count));
              if(!exam){ toast({ title: 'Missing exam', description: 'Please set Exam before generating.'}); return; }
              try{
                setLoading(true);
                const payload = { examType: exam, topic, difficulty } as any;
                const tasks = Array.from({length: count}).map(()=> callFunction('/generate-ai-question', payload, true));
                await Promise.allSettled(tasks);
                toast({ title: 'Generated', description: `Requested ${count} question(s).`});
                const gen = await callFunction('/exams-admin-curate/generated', null, true);
                setGenerated(gen?.data || []);
              }catch(e:any){ toast({ title: 'Generate failed', description: e.message || 'Please try again.' , variant:'destructive'});}finally{ setLoading(false);} 
            }} disabled={loading}>Generate</Button>
          </div>
        </Card>
      </section>

      {/* Unassigned list with bulk actions */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Generated</h2>
          <div className="flex items-center gap-2">
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild>
                <Button disabled={loading || allSelectedIds.length === 0}>Assign to Guru</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign selected ({allSelectedIds.length})</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <label className="text-sm">Reviewer</label>
                  <Select onValueChange={(v) => setReviewerId(v)} value={reviewerId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a Guru" />
                    </SelectTrigger>
                    <SelectContent>
                      {gurus.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button onClick={onAssign} disabled={loading || !reviewerId}>Assign</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" disabled={loading || allSelectedIds.length===0} onClick={async()=>{
              try{ setLoading(true); await callFunction('/exams-admin-curate/archive', { question_ids: allSelectedIds }, true); toast({ title:'Archived', description:`Moved ${allSelectedIds.length} to archive.`}); setSelected({}); const gen = await callFunction('/exams-admin-curate/generated', null, true); setGenerated(gen?.data||[]);} finally { setLoading(false);} 
            }}>Archive</Button>
          </div>
        </div>
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox" onChange={toggleAll} checked={generated.length>0 && allSelectedIds.length===generated.length} />
                </TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Topic</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {generated.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <input type="checkbox" checked={!!selected[q.id]} onChange={() => toggleOne(q.id)} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{new Date(q.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-sm"><a className="underline" href={`/guru/exams/review?open=${q.id}`}>{q.question_text}</a></TableCell>
                  <TableCell className="text-sm">{q.exam_type || '-'}</TableCell>
                  <TableCell className="text-sm">{q.difficulty_level || '-'}</TableCell>
                  <TableCell className="text-sm">{q.topic || '-'}</TableCell>
                </TableRow>
              ))}
              {generated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">No unassigned items</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Curation Outcomes</h2>
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              setLoading(true);
              const [app, rej] = await Promise.all([
                callFunction("/exams-admin-curate/approved", null, true),
                callFunction("/exams-admin-curate/rejected", null, true)
              ]);
              setApproved(app?.data || []);
              setRejected(rej?.data || []);
            } finally { setLoading(false); }
          }}>Refresh</Button>
        </div>
        <Tabs defaultValue="approved">
          <TabsList>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected (Archive)</TabsTrigger>
          </TabsList>
          <TabsContent value="approved">
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Topic</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approved.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="whitespace-nowrap text-sm">{new Date(q.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{q.question_text}</TableCell>
                      <TableCell className="text-sm">{q.exam_type || '-'}</TableCell>
                      <TableCell className="text-sm">{q.difficulty_level || '-'}</TableCell>
                      <TableCell className="text-sm">{q.topic || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {approved.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nothing approved yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
          <TabsContent value="rejected">
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Topic</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rejected.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="whitespace-nowrap text-sm">{new Date(q.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{q.question_text}</TableCell>
                      <TableCell className="text-sm">{q.exam_type || '-'}</TableCell>
                      <TableCell className="text-sm">{q.difficulty_level || '-'}</TableCell>
                      <TableCell className="text-sm">{q.topic || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {rejected.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">No rejected items</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
};

export default ExamsAICuration;
