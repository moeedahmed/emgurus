import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { CURRICULA, EXAMS, ExamName } from "@/lib/curricula";
interface AIQuestion {
  id: string;
  question: string;
  options: string[]; // ['A. ...','B. ...','C. ...','D. ...']
  correct_answer: string; // 'A' | 'B' | 'C' | 'D'
  explanation?: string;
  source?: string;
}

interface CurriculumRow {
  id: string;
  slo_number: number;
  slo_title: string;
  key_capability_number: number;
  key_capability_title: string;
}

type Feedback = "none" | "too_easy" | "hallucinated" | "wrong" | "not_relevant";

const COUNTS = [10, 25, 50];
const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" }
];

export default function AiPractice() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const showInline = false; // Remove duplicate form

  if (showInline) {
    // Keep old form code for backwards compatibility, but it won't render
    return <div>Old inline form disabled</div>;
  }

  const [configOpen, setConfigOpen] = useState(false);
  const [exam, setExam] = useState<ExamName | "">("");
  const [count, setCount] = useState<number>(10);
  const [area, setArea] = useState<string>("All areas");
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [loading, setLoading] = useState(false);

  const areas = exam ? ["All areas", ...CURRICULA[exam]] : ["All areas"];

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
      setConfigOpen(false); // Close modal after navigation
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
    <div className="space-y-6">
      <Card>
        <CardContent className="py-8 text-center">
          <div className="mb-4">
            <h3 className="text-xl font-semibold mb-2">AI Practice (Beta)</h3>
            <p className="text-muted-foreground">Start an AI-generated practice set.</p>
          </div>
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button size="lg">Start</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>AI Practice (Beta)</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 p-4">
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
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancel</Button>
                <Button onClick={start} disabled={!exam || loading}>
                  {loading ? 'Generating…' : 'Start Practice'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportChooser({ onChange }: { onChange: (v: Feedback) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Feedback>("none");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">Report</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this question</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          {([
            { k: "none", l: "No issue" },
            { k: "too_easy", l: "Too Easy" },
            { k: "not_relevant", l: "Irrelevant" },
            { k: "wrong", l: "Inaccurate / Wrong" },
            { k: "hallucinated", l: "Hallucinated" },
          ] as Array<{k: Feedback; l: string}>).map((o) => (
            <label key={o.k} className="flex items-center gap-3">
              <input
                type="radio"
                name="feedback"
                className="accent-[hsl(var(--primary))]"
                checked={value === o.k}
                onChange={() => setValue(o.k)}
              />
              <span>{o.l}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onChange(value); setOpen(false); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
