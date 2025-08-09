import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CURRICULA, EXAMS, ExamName } from "@/lib/curricula";

const COUNTS = [10, 25, 50];

export default function AiPracticeConfig() {
  useEffect(() => {
    document.title = "AI Practice • EM Gurus";
    const desc = "Configure AI Practice by exam, count, and curriculum areas.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content', desc);
  }, []);

  const { toast } = useToast();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ExamName | "">("");
  const [count, setCount] = useState<number>(10);
  const [area, setArea] = useState<string>("All areas");
  const [loading, setLoading] = useState(false);

  const areas = useMemo(() => (exam ? ["All areas", ...CURRICULA[exam]] : ["All areas"]) , [exam]);

  async function invokeWithTimeout(body: any, ms = 20000) {
    return await Promise.race([
      supabase.functions.invoke('ai-generate-questions', { body }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout after 20s')), ms))
    ]) as Awaited<ReturnType<typeof supabase.functions.invoke>>;
  }

  function buildDemoSession() {
    const id = crypto.randomUUID();
    const questions = [
      { id: crypto.randomUUID(), stem: 'A 65-year-old patient presents with fever, tachycardia, and hypotension. What is the earliest marker that correlates with mortality in suspected sepsis?', options: ['A. Total WBC','B. Serum lactate','C. ESR','D. D-dimer'], correct: 'B', explanation: 'Serum lactate correlates with tissue hypoperfusion and mortality risk in sepsis. Early measurement guides resuscitation.' },
      { id: crypto.randomUUID(), stem: 'In septic shock, the first-line vasopressor following adequate fluids is:', options: ['A. Dopamine','B. Phenylephrine','C. Norepinephrine','D. Epinephrine'], correct: 'C', explanation: 'Norepinephrine is first-line given best evidence for efficacy and safety.' },
      { id: crypto.randomUUID(), stem: 'For suspected community-acquired pneumonia with sepsis, the recommended timing for initial antibiotics is within:', options: ['A. 1 hour','B. 3 hours','C. 6 hours','D. 12 hours'], correct: 'A', explanation: 'Early antibiotics within 1 hour are associated with improved outcomes in sepsis.' },
    ];
    return { id, questions };
  }

  const start = async (skip = false) => {
    if (!exam) return;
    setLoading(true);
    const curriculum = skip || area === 'All areas' ? null : area;
    try {
      console.log('EXAMS start', { exam, count, curriculum });
      let data: any;
      try {
        const res = await invokeWithTimeout({ exam, count, curriculum });
        if (res.error) throw res.error;
        data = res.data;
      } catch (e) {
        console.warn('ai-generate-questions unavailable, using demo', e);
        data = { session: buildDemoSession() };
      }
      const sessionId = data?.session?.id || crypto.randomUUID();
      const qs = data?.session?.questions || buildDemoSession().questions;
      // persist in localStorage
      const store = JSON.parse(localStorage.getItem('ai_sessions') || '{}');
      store[sessionId] = { exam, count, curriculum, questions: qs };
      localStorage.setItem('ai_sessions', JSON.stringify(store));
      navigate(`/exams/ai-practice/session/${sessionId}`);
    } catch (err: any) {
      console.error('Generate failed', err);
      toast({ title: "Couldn't start AI practice. Please try again.", description: String(err?.message || err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Practice (Beta)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Exam<span className="sr-only"> required</span></Label>
            <Select value={exam} onValueChange={(v) => setExam(v as ExamName)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select exam" /></SelectTrigger>
              <SelectContent>
                {EXAMS.map(e => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Number of questions</Label>
            <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select count" /></SelectTrigger>
              <SelectContent>
                {COUNTS.map(c => (<SelectItem key={c} value={String(c)}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Curriculum</Label>
            <Select value={area} onValueChange={setArea} disabled={!exam}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="All areas" /></SelectTrigger>
              <SelectContent>
                {areas.map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3 flex items-center gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => start(true)} disabled={loading}>Skip</Button>
            <Button onClick={() => start(false)} disabled={!exam || loading}>
              {loading ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
