import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-6 mx-0 w-full px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <span className="text-primary">⚡</span>
              AI Practice
            </h1>
            <p className="text-sm text-muted-foreground">AI-generated questions with instant feedback</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/exams')}>
            Back to Exams
          </Button>
        </div>
      </div>

      <Card className="min-w-0 w-full max-w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold">AI Practice</span>
            <Badge variant="secondary">Beta</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            AI-generated questions with instant feedback. Use your judgment and report issues.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>Immediate feedback after each question</li>
            <li>AI-generated stems and distractors</li>
            <li>Detailed explanations included</li>
          </ul>

          <Alert>
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>
              Content is AI-generated and may be imperfect. Please submit feedback if something looks off.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
