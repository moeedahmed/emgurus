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
const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" }
];

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
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [loading, setLoading] = useState(false);

  const areas = useMemo(() => (exam ? ["All areas", ...CURRICULA[exam]] : ["All areas"]) , [exam]);

  const start = async () => {
    if (!exam) return;
    
    // Check auth first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate(`/auth?returnTo=${encodeURIComponent('/exams/ai-practice')}`);
      return;
    }
    
    setLoading(true);
    try {
      // Navigate directly to session page with query params
      const params = new URLSearchParams();
      params.set('exam', exam);
      params.set('count', String(count));
      if (area !== 'All areas') params.set('topic', area);
      params.set('difficulty', difficulty);
      navigate(`/exams/ai-practice/session/${Date.now()}?${params.toString()}`);
    } catch (err: any) {
      console.error('Start failed', err);
      const errorMsg = err?.message || String(err);
      toast({ 
        title: "Start failed", 
        description: errorMsg,
        variant: 'destructive'
      });
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
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          <div>
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select difficulty" /></SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map(d => (<SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 lg:col-span-4 flex items-center gap-2 justify-end pt-2">
            <Button onClick={start} disabled={!exam || loading}>
              {loading ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
