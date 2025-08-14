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

  const start = async () => {
    if (!exam) return;
    setLoading(true);
    const slo = area === 'All areas' ? null : area;
    try {
      const res = await supabase.functions.invoke('ai-exams-api', {
        body: { action: 'start_session', examType: exam }
      });
      if (res.error) throw res.error;
      const sessionId = res.data?.session?.id;
      if (!sessionId) throw new Error('Failed to start session');
      const params = new URLSearchParams();
      params.set('count', String(count));
      if (slo) params.set('slo', slo);
      navigate(`/exams/ai-practice/session/${sessionId}?${params.toString()}`);
    } catch (err: any) {
      console.error('Start session failed', err);
      const errorMsg = err?.message || String(err);
      toast({ 
        title: "AI Practice failed", 
        description: errorMsg.includes('OpenAI') ? 'AI service not configured. Please contact support.' : errorMsg,
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
            <Button onClick={start} disabled={!exam || loading}>
              {loading ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
