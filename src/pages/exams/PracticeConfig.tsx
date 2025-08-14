import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CURRICULA, EXAMS, ExamName } from "@/lib/curricula";
import { mapLabelToEnum } from "@/lib/exams";
import PageHero from "@/components/PageHero";

const COUNTS = [10, 25, 50];

export default function PracticeConfig() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [exam, setExam] = useState<ExamName | "">(searchParams.get('exam') as ExamName || "");
  const [count, setCount] = useState<number>(Number(searchParams.get('count')) || 25);
  const [area, setArea] = useState<string>(searchParams.get('topic') || "All areas");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Practice Mode Configuration • EM Gurus";
    const desc = "Configure Practice Mode by exam, count, and curriculum areas.";
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
      navigate(`/auth?returnTo=${encodeURIComponent('/exams/practice')}`);
      return;
    }
    
    setLoading(true);
    try {
      // Use canonical exam type
      const examType = mapLabelToEnum(exam);
      
      // Create practice session (attempt)
      const { data: attempt, error: attemptError } = await supabase
        .from('exam_attempts')
        .insert({
          user_id: user.id,
          source: 'reviewed',
          mode: 'practice',
          total_questions: count,
          question_ids: [], // Will be populated as questions are answered
          // Store exam configuration in breakdown for session queries
          breakdown: { 
            exam_type: examType,
            topic: area !== 'All areas' ? area : null,
            selection_id: null // No preselected list
          }
        })
        .select('id')
        .single();
      
      if (attemptError) throw attemptError;

      // Navigate to practice session
      const params = new URLSearchParams();
      params.set('exam', exam);
      params.set('count', String(count));
      if (area !== 'All areas') params.set('topic', area);
      navigate(`/exams/practice/session/${attempt.id}?${params.toString()}`);
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
        title="Practice Mode Configuration" 
        subtitle="Configure your practice session with expert-reviewed questions" 
        align="center" 
      />
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Practice Mode</CardTitle>
            </CardHeader>
            <CardContent className="py-8">
              <div className="grid gap-6 md:grid-cols-3">
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
              </div>
              <div className="mt-8 text-center">
                <Button onClick={start} disabled={!exam || loading} size="lg">
                  {loading ? 'Starting…' : 'Start Practice'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}