import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import QuestionCard from "@/components/exams/QuestionCard";
import QuestionChat from "@/components/exams/QuestionChat";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
export default function QuestionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromAdmin = Boolean((location.state as any)?.fromAdmin);
  const [q, setQ] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviewerName, setReviewerName] = useState<string | null>(null);
  const { user } = useAuth();
  const [selectedKey, setSelectedKey] = useState<string>("");
  const startRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = performance.now();
  }, []);

  const handleSelect = async (k: string) => {
    if (selectedKey) return; // prevent multiple submissions
    setSelectedKey(k);
    const end = performance.now();
    const timeMs = Math.max(0, Math.round(end - (startRef.current || end)));
    try {
      if (!user || !q?.id) return;
      const exam = q?.exam || 'Reviewed';
      // Get or create session
      let { data: sess } = await supabase
        .from('user_exam_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('exam', exam)
        .maybeSingle();
      if (!sess) {
        const ins = await supabase
          .from('user_exam_sessions')
          .insert({ user_id: user.id, exam })
          .select('*')
          .maybeSingle();
        if (ins.error) throw ins.error;
        sess = ins.data as any;
      }

      const chosenIndex = k.toUpperCase().charCodeAt(0) - 65;
      const correctIndex = typeof q?.correct_index === 'number' ? q.correct_index : null;
      const outcome = correctIndex === null ? 'skipped' : (chosenIndex === correctIndex ? 'correct' : 'incorrect');

      const evt = await (supabase as any)
        .from('user_question_events')
        .insert({ session_id: sess.id, user_id: user.id, question_id: q.id, outcome, time_ms: timeMs });
      if (evt.error) throw evt.error;

      const newTotal = (sess.total || 0) + 1;
      const newCorrect = (sess.correct || 0) + (outcome === 'correct' ? 1 : 0);
      const upd = await (supabase as any)
        .from('user_exam_sessions')
        .update({ total: newTotal, correct: newCorrect })
        .eq('id', sess.id);
      if (upd.error) throw upd.error;
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed to record answer', description: (e as any)?.message || 'Unknown error' });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // TODO: replace (supabase as any) with typed client once Supabase types are regenerated to include reviewed_exam_questions.
        const { data, error } = await (supabase as any)
          .from('reviewed_exam_questions')
          .select('id, stem, options, explanation, exam, topic, difficulty, source, reviewer_id, reviewed_at, correct_index')
          .eq('id', id as any)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) setQ(data);
        if (data?.reviewer_id) {
          const { data: guru, error: gErr } = await (supabase as any)
            .from('gurus')
            .select('id, name')
            .eq('id', data.reviewer_id)
            .maybeSingle();
          if (!gErr && !cancelled) setReviewerName(guru?.name || null);
        }
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Failed to load question",
          description: (e as any)?.message || 'Unknown error',
        });
        // demo fallback
        if (!cancelled) setQ({ id, stem: 'Guru‑reviewed sepsis recognition and management overview.', options: ['A','B','C','D'], explanation: 'Demo explanation' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="container mx-auto px-4 py-6">
      {!fromAdmin && (
        <Button variant="ghost" onClick={() => navigate('/exams')} aria-label="Back to exams">Back to exams</Button>
      )}
      <Card className="mt-3">
        <CardHeader>
          {!fromAdmin && (<CardTitle>Practice Mode</CardTitle>)}
          {reviewerName && (
            <div className="text-sm text-muted-foreground">Reviewer: {reviewerName}</div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-24 rounded-xl border animate-pulse bg-muted/40" />
          ) : (
            <>
              <QuestionCard
                stem={q?.stem || 'Question'}
                options={Array.isArray(q?.options)
                  ? (typeof (q.options as any[])[0] === 'string'
                      ? (q.options as string[]).map((s, idx) => ({ key: String.fromCharCode(65+idx), text: s }))
                      : (q.options as any[]))
                  : ['A','B','C','D'].map((_, idx) => ({ key: String.fromCharCode(65+idx), text: `Option ${String.fromCharCode(65+idx)}` }))}
                selectedKey={selectedKey}
                onSelect={handleSelect}
                showExplanation={true}
                explanation={q?.explanation || 'No explanation provided.'}
                source={q?.source || undefined}
              />
              <div className="mt-6 flex flex-wrap gap-2">
                {q?.exam && <Badge variant="secondary">{q.exam}</Badge>}
                {q?.topic && <Badge variant="secondary">{q.topic}</Badge>}
                {q?.difficulty && <Badge variant="outline">{q.difficulty}</Badge>}
                {q?.reviewed_at && <Badge variant="outline">Reviewed {new Date(q.reviewed_at).toLocaleDateString()}</Badge>}
                <a href={q?.reviewer_id ? `/profile/${q.reviewer_id}` : undefined} className="no-underline">
                  <Badge variant="secondary">Reviewer: {reviewerName || '—'}</Badge>
                </a>
              </div>
              {q?.source && <div className="mt-2 text-sm text-muted-foreground">Source: {q.source}</div>}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Discussion Panel */}
      {q && (
        <div className="mt-6">
          <QuestionChat questionId={q.id} />
        </div>
      )}
    </div>
  );
}
