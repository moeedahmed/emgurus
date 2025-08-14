import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CURRICULA, EXAMS, ExamName } from "@/lib/curricula";
import PageHero from "@/components/PageHero";

const COUNTS = [10, 25, 50];
const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" }
];

export default function AiPracticeConfig() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [exam, setExam] = useState<ExamName | "">(searchParams.get('exam') as ExamName || "");
  const [count, setCount] = useState<number>(Number(searchParams.get('count')) || 10);
  const [area, setArea] = useState<string>(searchParams.get('topic') || "All areas");
  const [difficulty, setDifficulty] = useState<string>(searchParams.get('difficulty') || "medium");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "AI Practice Configuration • EM Gurus";
    const desc = "Configure AI Practice by exam, count, and curriculum areas.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content', desc);
  }, []);

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
      navigate(`/exams/ai-practice/session?${params.toString()}`);
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
    <main>
      <PageHero 
        title="AI Practice Configuration" 
        subtitle="Configure your AI-generated practice session with customizable exam settings" 
        align="center" 
      />
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">AI Practice (Beta)</CardTitle>
            </CardHeader>
            <CardContent className="py-8">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
              </div>
              <div className="mt-8 text-center">
                <Button onClick={start} disabled={!exam || loading} size="lg">
                  {loading ? 'Generating…' : 'Generate Practice Session'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
