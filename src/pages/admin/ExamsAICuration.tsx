import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { callFunction } from "@/lib/functionsUrl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EXAMS, CURRICULA } from "@/lib/curricula";

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

  useEffect(() => {
    document.title = "AI Curation | Admin | EMGurus";
    (async () => {
      setLoading(true);
      try {
        const [gen, app, rej] = await Promise.all([
          callFunction("/exams-admin-curate/generated", null, true),
          callFunction("/exams-admin-curate/approved", null, true),
          callFunction("/exams-admin-curate/rejected", null, true),
        ]);
        setGenerated(gen?.data || []);
        setApproved(app?.data || []);
        setRejected(rej?.data || []);
      } catch (e: any) {
        toast({ title: "Load failed", description: e.message || "Could not load data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Generator form state
  const [exam, setExam] = useState<string>(EXAMS[0]);
  const [topic, setTopic] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [count, setCount] = useState<number>(10);
  const [preset, setPreset] = useState<string>(() => localStorage.getItem("ai_qgen_preset") || "");
  useEffect(() => { localStorage.setItem("ai_qgen_preset", preset); }, [preset]);

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
              <Select value={exam} onValueChange={(v)=>{ setExam(v); setTopic(""); }}>
                <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select exam" /></SelectTrigger>
                <SelectContent>
                  {EXAMS.map((e)=> (<SelectItem key={e} value={e}>{e}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <label className="text-sm">Topic</label>
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select topic" /></SelectTrigger>
                <SelectContent>
                  {(CURRICULA as any)[exam]?.map((t: string) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <label className="text-sm">Difficulty</label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select difficulty" /></SelectTrigger>
                <SelectContent>
                  {['easy','medium','hard'].map(d => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <label className="text-sm">Count</label>
              <input type="number" min={1} max={10} value={count} onChange={(e)=> setCount(Math.max(1, Math.min(10, Number(e.target.value)||1)))} className="mt-1 w-full rounded-md border bg-background p-2" />
            </div>
            <div className="md:col-span-4">
              <label className="text-sm">Prompt preset</label>
              <Textarea className="mt-1" placeholder="Optional preset to steer generation (saved locally)" value={preset} onChange={(e)=> setPreset(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={async ()=>{
              const payload: any = { examType: exam, topic, difficulty, preset };
              try{
                setLoading(true);
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

      {/* Generated */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Generated</h2>
          <Button variant="outline" size="sm" onClick={async ()=>{ setLoading(true); try{ const gen = await callFunction('/exams-admin-curate/generated', null, true); setGenerated(gen?.data||[]);} finally { setLoading(false);} }}>Refresh</Button>
        </div>
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {generated.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="whitespace-nowrap text-sm">{new Date(q.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{q.question_text}</TableCell>
                  <TableCell className="text-sm">{q.exam_type || '-'}</TableCell>
                  <TableCell className="text-sm">{q.difficulty_level || '-'}</TableCell>
                  <TableCell className="text-sm">{q.topic || '-'}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="secondary" asChild><a href={`/guru/exams/review?open=${q.id}`}>Open</a></Button>
                    <Button size="sm" onClick={async()=>{ try{ setLoading(true); await callFunction('/exams-admin-curate/save', { question_ids: [q.id] }, true); const gen = await callFunction('/exams-admin-curate/generated', null, true); setGenerated(gen?.data||[]); toast({ title: 'Saved as draft' }); } finally { setLoading(false);} }}>Save</Button>
                    <Button size="sm" variant="outline" onClick={async()=>{ try{ setLoading(true); await callFunction('/exams-admin-curate/archive', { question_ids: [q.id] }, true); const gen = await callFunction('/exams-admin-curate/generated', null, true); setGenerated(gen?.data||[]); toast({ title: 'Archived' }); } finally { setLoading(false);} }}>Archive</Button>
                  </TableCell>
                </TableRow>
              ))}
              {generated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">No generated items</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* Outcomes (optional) */}
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
