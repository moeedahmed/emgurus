import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import QuestionCard from "@/components/exams/QuestionCard";

const letters = ['A','B','C','D','E'];

interface FullQuestion {
  id: string;
  stem: string;
  options: string[];
  correct_index: number;
  explanation?: string | null;
  exam?: string | null;
  topic?: string | null;
}

export default function ReviewedExamSession() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const ids: string[] = Array.isArray(location?.state?.ids) ? location.state.ids : [];

  const [idx, setIdx] = useState(0);
  const [q, setQ] = useState<FullQuestion | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [answers, setAnswers] = useState<{ id: string; selected: string; correct: string; topic?: string | null }[]>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Exam Mode • Reviewed Bank";
  }, []);

  useEffect(() => {
    if (!ids.length) return;
    void load(ids[idx]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, ids.join(',')]);

  async function load(id: string) {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('reviewed_exam_questions')
        .select('id, stem, options, correct_index, explanation, exam, topic')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      setQ(data as FullQuestion);
      setSelected("");
    } finally { setLoading(false); }
  }

  const correctKey = (q ? letters[q.correct_index ?? 0] : 'A');
  const options = (q?.options || []).map((t, i) => ({ key: letters[i] || String(i+1), text: t }));

  function submit() {
    if (!q || !selected) return;
    const next = answers.filter(a => a.id !== q.id).concat([{ id: q.id, selected, correct: correctKey, topic: q.topic }]);
    setAnswers(next);
    if (idx < ids.length - 1) {
      setIdx(idx + 1);
    } else {
      // finished
      setReviewMode(false);
    }
  }

  const score = useMemo(() => answers.reduce((acc, a) => acc + (a.selected === a.correct ? 1 : 0), 0), [answers]);
  const byTopic = useMemo(() => {
    const map: Record<string, { total: number; correct: number }> = {};
    answers.forEach(a => {
      const key = a.topic || 'General';
      map[key] = map[key] || { total: 0, correct: 0 };
      map[key].total += 1;
      if (a.selected === a.correct) map[key].correct += 1;
    });
    return map;
  }, [answers]);

  if (!ids.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No selection. Go back to Reviewed Bank and pick a list.</CardContent>
        </Card>
      </div>
    );
  }

  const finished = answers.length === ids.length;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mx-auto w-full md:max-w-5xl">
        {!finished ? (
          <Card>
            <CardHeader>
              <CardTitle>Exam Mode • Question {idx + 1} of {ids.length}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {q && (
                <QuestionCard
                  key={q.id}
                  questionId={q.id}
                  stem={q.stem}
                  options={options}
                  selectedKey={selected}
                  onSelect={setSelected}
                  showExplanation={false}
                  explanation={undefined}
                  source={`${q.exam || ''}${q.topic ? ' • ' + q.topic : ''}`}
                />
              )}
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => navigate('/exams/reviewed')}>End Exam</Button>
                <Button onClick={submit} disabled={!selected || loading}>{idx < ids.length - 1 ? 'Next' : 'Finish'}</Button>
              </div>
            </CardContent>
          </Card>
        ) : !reviewMode ? (
          <Card>
            <CardHeader>
              <CardTitle>Exam Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="text-lg font-semibold">Score: {score} / {ids.length}</div>
              <div className="grid gap-2">
                {Object.entries(byTopic).map(([t, v]) => (
                  <div key={t} className="text-sm">{t}: {v.correct}/{v.total}</div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => navigate('/exams/reviewed')}>Back to bank</Button>
                <Button onClick={() => setReviewMode(true)}>Review answers</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Review Answers</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {q && (
                <QuestionCard
                  key={q.id + '-review'}
                  questionId={q.id}
                  stem={q.stem}
                  options={options}
                  selectedKey={answers.find(a=>a.id===q.id)?.selected || ''}
                  onSelect={()=>{}}
                  showExplanation={true}
                  explanation={q.explanation || ''}
                  source={`${q.exam || ''}${q.topic ? ' • ' + q.topic : ''}`}
                  correctKey={correctKey}
                />
              )}
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setReviewMode(false)}>Summary</Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setIdx(Math.max(0, idx-1))} disabled={idx===0}>Previous</Button>
                  <Button onClick={() => setIdx(Math.min(ids.length-1, idx+1))} disabled={idx===ids.length-1}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
