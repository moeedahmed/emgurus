import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import QuestionCard from "@/components/exams/QuestionCard";
import { supabase } from "@/integrations/supabase/client";
aimport { useToast } from "@/hooks/use-toast";

interface SavedQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
  source?: string;
  topic?: string;
  subtopic?: string;
}

export default function AiPracticeSession() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { toast } = useToast();

  const total = useMemo(() => {
    const n = Number(search.get("count") || 10);
    return Math.max(1, Math.min(50, isNaN(n) ? 10 : n));
  }, [search]);
  const topic = search.get("slo");

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string>("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<(SavedQuestion | null)[]>([]);

  useEffect(() => {
    document.title = "AI Practice Session • EM Gurus";
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    // Generate first question on mount
    if (!questions[0]) void generate(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardContent className="py-8 text-center">
            <div className="mb-3 font-medium">Session not found</div>
            <Button variant="outline" onClick={() => navigate('/exams/ai-practice')}>Back to setup</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const q = questions[idx] || null;

  async function generate(index: number) {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('ai-exams-api', {
        body: { action: 'generate_question', session_id: sessionId, topic, count: total }
      });
      if (error) throw error;
      const saved: SavedQuestion | undefined = data?.question;
      if (!saved) throw new Error('No question returned');
      setQuestions((prev) => {
        const next = prev.slice();
        next[index] = saved;
        return next;
      });
      setSelected("");
      setShow(false);
    } catch (err: any) {
      console.error('Generate question failed', err);
      toast({
        title: 'Generation failed',
        description: `${String(err?.message || err)}. You can retry or edit selection.`,
      });
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!q || !selected) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('ai-exams-api', {
        body: { action: 'submit_answer', question_id: q.id, selected_answer: selected }
      });
      if (error) throw error;
      setShow(true);
    } catch (err: any) {
      console.error('Submit failed', err);
      toast({ title: 'Submit failed', description: String(err?.message || err) });
    } finally {
      setLoading(false);
    }
  }

  function next() {
    if (idx < total - 1) {
      const nextIdx = idx + 1;
      setIdx(nextIdx);
      setSelected("");
      setShow(false);
      if (!questions[nextIdx]) void generate(nextIdx);
    } else {
      navigate('/exams');
    }
  }

  function prev() {
    if (idx > 0) {
      setIdx(idx - 1);
      setSelected("");
      setShow(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Question {idx + 1} of {total}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {q && (
            <QuestionCard
              stem={q.question}
              options={(q.options || []).map((t: string, i: number) => ({ key: String.fromCharCode(65 + i), text: t.replace(/^\w[\.)]\s*/, '') }))}
              selectedKey={selected}
              onSelect={setSelected}
              showExplanation={show}
              explanation={q.explanation}
              source={q.source}
              correctKey={q.correct_answer}
            />
          )}
          {!q && (
            <div className="text-sm text-muted-foreground">{loading ? 'Generating question…' : 'No question yet.'}</div>
          )}
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate('/exams/ai-practice')}>Edit selection</Button>
              <Button variant="ghost" onClick={() => generate(idx)} disabled={loading}>Retry</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={prev} disabled={idx === 0}>Previous</Button>
              {!show ? (
                <Button onClick={submit} disabled={!q || !selected || loading}>Submit</Button>
              ) : (
                <Button onClick={next}>{idx < total - 1 ? 'Next' : 'Finish'}</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
