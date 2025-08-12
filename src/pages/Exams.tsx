import { useEffect, useState } from "react";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EXAMS, CURRICULA, ExamName } from "@/lib/curricula";
import { getJson } from "@/lib/functionsClient";
import { supabase } from "@/integrations/supabase/client";

export default function Exams() {
  const navigate = useNavigate();
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [examOpen, setExamOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const [pExam, setPExam] = useState<ExamName | "">("");
  const [pTopic, setPTopic] = useState<string>("All areas");

  const [eExam, setEExam] = useState<ExamName | "">("");
  const [eTopic, setETopic] = useState<string>("All areas");
  const [eCount, setECount] = useState<number>(25);
  const [eTimed, setETimed] = useState<boolean>(true);

  const [aiExam, setAiExam] = useState<ExamName | "">("");
  const [aiCount, setAiCount] = useState<number>(10);
  const [aiArea, setAiArea] = useState<string>("All areas");

  useEffect(() => {
    document.title = "EMGurus Exam Practice • EM Gurus";
    const desc = "Targeted MCQs for MRCEM Primary, MRCEM SBA, and FRCEM. Learn smarter, score higher.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content', desc);
  }, []);

  // Fetch reviewed question IDs via Edge Function, with direct-table fallback
  const fetchReviewedIds = async (exam?: ExamName | "", topic?: string, limit: number = 50) => {
    const params = new URLSearchParams();
    params.set('limit', String(Math.max(1, Math.min(100, limit))));
    if (exam) params.set('exam', String(exam));
    if (topic && topic !== 'All areas') params.set('q', topic);
    try {
      const res = await getJson(`/public-reviewed-exams?${params.toString()}`);
      const items = Array.isArray(res.items) ? res.items : [];
      return items.map((r: any) => r.id).filter(Boolean);
    } catch {
      // Fallback to direct table query
      let q = (supabase as any)
        .from('reviewed_exam_questions')
        .select('id', { count: 'exact' })
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(Math.max(1, Math.min(100, limit)));
      if (exam) q = q.or(`exam.eq.${exam},exam_type.eq.${exam}`);
      if (topic && topic !== 'All areas') {
        q = (q as any).contains?.('tags', [topic]) || (q as any).eq('topic', topic);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (Array.isArray(data) ? data : []).map((r: any) => r.id).filter(Boolean);
    }
  };

  const startPractice = async () => {
    try {
      const ids = await fetchReviewedIds(pExam, pTopic, 50);
      if (!ids.length) { setPracticeOpen(false); return; }
      navigate(`/exams/reviewed/${ids[0]}`, { state: { ids, index: 0 } });
    } finally {
      setPracticeOpen(false);
    }
  };

  const startExam = async () => {
    try {
      const ids = await fetchReviewedIds(eExam, eTopic, Math.max(5, Math.min(100, eCount)));
      if (!ids.length) { setExamOpen(false); return; }
      const limitSec = eTimed ? Math.round(Math.max(1, Math.min(300, eCount)) * 90) : undefined; // ~90s per Q
      navigate('/exams/reviewed-exam', { state: { ids, limitSec } });
    } finally {
      setExamOpen(false);
    }
  };

  const pAreas = pExam ? ["All areas", ...CURRICULA[pExam]] : ["All areas"];
  const eAreas = eExam ? ["All areas", ...CURRICULA[eExam]] : ["All areas"];

  return (
    <main>
      <PageHero title="EMGurus Exam Practice" subtitle="Targeted MCQs for MRCEM Primary, MRCEM SBA, and FRCEM. Learn smarter, score higher." align="center" ctas={[{ label: "Exam Membership", href: "/pricing", variant: "outline" }]} />
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mx-auto max-w-5xl grid items-stretch gap-6 md:grid-cols-3">
          {/* AI Mode */}
          <Card className="h-full p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-xl font-semibold mb-2">AI Mode <span className="ml-2 align-middle text-xs px-2 py-0.5 rounded-full border">Beta</span></h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Instantly generated MCQs</li>
                <li>• Immediate, concise explanations</li>
                <li>• Topic‑guided practice</li>
              </ul>
            </div>
            <div className="pt-6">
              <Dialog open={aiOpen} onOpenChange={setAiOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" aria-label="Start AI Mode">Start AI Mode</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>AI Practice (Beta)</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label>Exam</Label>
                      <Select value={aiExam || undefined as any} onValueChange={(v) => setAiExam(v as ExamName)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select exam" /></SelectTrigger>
                        <SelectContent className="z-50">
                          {EXAMS.map(e => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Number of questions</Label>
                      <Select value={String(aiCount)} onValueChange={(v)=> setAiCount(Number(v))}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="10" /></SelectTrigger>
                        <SelectContent className="z-50">
                          {[10,25,50].map(c => (<SelectItem key={c} value={String(c)}>{c}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Curriculum</Label>
                      <Select value={aiArea} onValueChange={setAiArea} disabled={!aiExam}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="All areas" /></SelectTrigger>
                        <SelectContent className="z-50">
                          {(aiExam ? ["All areas", ...CURRICULA[aiExam]] : ["All areas"]).map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-3 flex items-center justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setAiOpen(false)}>Cancel</Button>
                      <Button onClick={async()=>{
                        if(!aiExam) return; 
                        try {
                          const res = await supabase.functions.invoke('ai-exams-api', { body: { action: 'start_session', examType: aiExam } });
                          const sessionId = (res as any)?.data?.session?.id;
                          if(sessionId){
                            const params = new URLSearchParams();
                            params.set('count', String(aiCount));
                            if (aiArea && aiArea !== 'All areas') params.set('slo', aiArea);
                            navigate(`/exams/ai-practice/session/${sessionId}?${params.toString()}`);
                          }
                        } finally { setAiOpen(false); }
                      }} disabled={!aiExam}>Start</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </Card>

          {/* Practice Mode */}
          <Card className="h-full p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-xl font-semibold mb-2">Practice Mode</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Study with reviewed questions</li>
                <li>• Show answer + explanation after each choice</li>
                <li>• Untimed, learn‑first workflow</li>
              </ul>
            </div>
            <div className="pt-6">
              <Dialog open={practiceOpen} onOpenChange={setPracticeOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" aria-label="Start Practice">Start Practice</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Start Practice</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Exam</Label>
                      <Select value={pExam || undefined as any} onValueChange={(v) => setPExam(v as ExamName)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select exam" /></SelectTrigger>
                        <SelectContent className="z-50">
                          {EXAMS.map(e => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Topic</Label>
                      <Select value={pTopic} onValueChange={setPTopic} disabled={!pExam}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="All areas" /></SelectTrigger>
                        <SelectContent className="z-50">
                          {pAreas.map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setPracticeOpen(false)}>Cancel</Button>
                      <Button onClick={startPractice} disabled={!pExam}>Start</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </Card>

          {/* Exam Mode */}
          <Card className="h-full p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-xl font-semibold mb-2">Exam Mode</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Timed session from reviewed bank</li>
                <li>• No explanations until finish</li>
                <li>• Score & topic breakdown</li>
              </ul>
            </div>
            <div className="pt-6">
              <Dialog open={examOpen} onOpenChange={setExamOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" aria-label="Start Exam">Start Exam</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Start Exam</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="md:col-span-1">
                      <Label>Exam</Label>
                      <Select value={eExam || undefined as any} onValueChange={(v) => setEExam(v as ExamName)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select exam" /></SelectTrigger>
                        <SelectContent className="z-50">
                          {EXAMS.map(e => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1">
                      <Label>Topic</Label>
                      <Select value={eTopic} onValueChange={setETopic} disabled={!eExam}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="All areas" /></SelectTrigger>
                        <SelectContent className="z-50">
                          {eAreas.map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1">
                      <Label>Questions</Label>
                      <Input type="number" min={5} max={100} value={eCount} onChange={(e)=> setECount(Number(e.target.value || 25))} className="mt-1" />
                    </div>
                    <div className="md:col-span-3 flex items-center justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setExamOpen(false)}>Cancel</Button>
                      <Button onClick={startExam} disabled={!eExam}>Start</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

