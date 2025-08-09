import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QuestionCard from "@/components/exams/QuestionCard";

const letters = ['A','B','C','D','E'];

export default function ReviewedQuestionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState<any>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [reviewerName, setReviewerName] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Reviewed Question • EM Gurus";
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('reviewed_exam_questions' as any)
          .select('*')
          .eq('id', id)
          .eq('status', 'approved')
          .maybeSingle();
        if (error) throw error;
        const row = data as any;
        if (!cancelled) setQ(row);
        if (row?.reviewer_id) {
          const { data: g } = await supabase.from('gurus').select('id, name').eq('id', row.reviewer_id).maybeSingle();
          if (!cancelled) setReviewerName((g as any)?.name || null);
        }
      } catch (e) {
        console.error('Reviewed question fetch failed', e);
        if (!cancelled) setQ(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const options = useMemo(() => {
    const arr: string[] = Array.isArray(q?.options) ? q.options : [];
    return arr.map((text, idx) => ({ key: letters[idx] || String(idx+1), text }));
  }, [q]);

  const correctKey = useMemo(() => letters[(q?.correct_index ?? 0)] || 'A', [q]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Button variant="outline" onClick={() => navigate('/exams/reviewed')}>Back to list</Button>

      {loading ? (
        <div className="h-40 rounded-xl border animate-pulse bg-muted/40 mt-4" />
      ) : q ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-xl">Reviewed Question</CardTitle>
          </CardHeader>
          <CardContent>
            <QuestionCard
              stem={q.stem}
              options={options}
              selectedKey={selectedKey}
              onSelect={(k) => setSelectedKey(k)}
              showExplanation={showExplanation}
              explanation={q.explanation || ''}
              source={`${q.exam} • ${q.topic}${q.subtopic ? ' — ' + q.subtopic : ''}`}
            />

            {!showExplanation ? (
              <Button className="mt-4" onClick={() => setShowExplanation(true)} disabled={!selectedKey}>Check answer</Button>
            ) : (
              <div className="mt-4 text-sm">
                Correct answer: <span className="font-semibold">{correctKey}</span>
              </div>
            )}

            <div className="mt-6 text-sm text-muted-foreground flex flex-wrap gap-2">
              {q.difficulty && <span className="border rounded px-2 py-0.5">{q.difficulty}</span>}
              {q.reviewed_at && <span className="border rounded px-2 py-0.5">Reviewed {new Date(q.reviewed_at).toLocaleDateString()}</span>}
              <span className="border rounded px-2 py-0.5">Reviewer: {reviewerName || '—'}</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center text-muted-foreground py-10">Question not found.</div>
      )}
    </div>
  );
}
