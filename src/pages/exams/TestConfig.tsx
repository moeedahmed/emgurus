import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CURRICULA, EXAMS, ExamName } from "@/lib/curricula";
import { canonExamType } from "@/lib/exams";
import PageHero from "@/components/PageHero";

const COUNTS = [10, 25, 50];
const TIME_OPTIONS = [30, 45, 60, 90, 120];

export default function TestConfig() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [exam, setExam] = useState<ExamName | "">(searchParams.get('exam') as ExamName || "");
  const [count, setCount] = useState<number>(Number(searchParams.get('count')) || 25);
  const [area, setArea] = useState<string>(searchParams.get('topic') || "All areas");
  const [timeLimit, setTimeLimit] = useState<string>("60");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Test Mode Configuration • EM Gurus";
    const desc = "Configure Test Mode with timed exam conditions.";
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
      navigate(`/auth?returnTo=${encodeURIComponent('/exams/test')}`);
      return;
    }
    
    setLoading(true);
    try {
      // Use canonical exam type
      const examType = canonExamType(exam, EXAMS);
      
      // Create test session (attempt with exam mode)
      const { data: attempt, error: attemptError } = await supabase
        .from('exam_attempts')
        .insert({
          user_id: user.id,
          source: 'reviewed',
          mode: 'exam', // Keep DB value as 'exam'
          total_questions: count,
          question_ids: [], // Will be populated as questions are answered
          // Store exam configuration in breakdown for session queries
          breakdown: { 
            exam_type: examType,
            topic: area !== 'All areas' ? area : null,
            time_limit: parseInt(timeLimit),
            selection_id: null // No preselected list
          }
        })
        .select('id')
        .single();
      
      if (attemptError) throw attemptError;

      // Navigate to test session
      const params = new URLSearchParams();
      params.set('exam', exam);
      params.set('count', String(count));
      if (area !== 'All areas') params.set('topic', area);
      params.set('timeLimit', timeLimit);
      navigate(`/exams/test/session/${attempt.id}?${params.toString()}`);
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
        title="Test Mode Configuration" 
        subtitle="Configure your timed test with realistic exam conditions" 
        align="center" 
      />
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Test Mode</CardTitle>
            </CardHeader>
            <CardContent className="py-8">
              <div className="grid gap-6 md:grid-cols-4">
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
                  <Label>Time Limit</Label>
                  <Select value={timeLimit} onValueChange={setTimeLimit}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select time" /></SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map(t => (<SelectItem key={t} value={String(t)}>{t} min</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-8 text-center">
                <Button onClick={start} disabled={!exam || loading} size="lg">
                  {loading ? 'Starting…' : 'Start Test'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}