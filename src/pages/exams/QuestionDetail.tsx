import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import QuestionCard from "@/components/exams/QuestionCard";
import { toast } from "@/hooks/use-toast";
export default function QuestionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // TODO: replace (supabase as any) with typed client once Supabase types are regenerated to include reviewed_exam_questions.
        const { data, error } = await (supabase as any).from('reviewed_exam_questions').select('*').eq('id', id as any).maybeSingle();
        if (error) throw error;
        if (!cancelled) setQ(data);
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
      <Button variant="ghost" onClick={() => navigate('/exams/question-bank')} aria-label="Back to list">Back to list</Button>
      <Card className="mt-3">
        <CardHeader>
          <CardTitle>Reviewed Question</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-24 rounded-xl border animate-pulse bg-muted/40" />
          ) : (
            <QuestionCard
              stem={q?.stem || 'Question'}
              options={Array.isArray(q?.options)
                ? (typeof (q.options as any[])[0] === 'string'
                    ? (q.options as string[]).map((s, idx) => ({ key: String.fromCharCode(65+idx), text: s }))
                    : (q.options as any[]))
                : ['A','B','C','D'].map((_, idx) => ({ key: String.fromCharCode(65+idx), text: `Option ${String.fromCharCode(65+idx)}` }))}
              selectedKey={''}
              onSelect={() => {}}
              showExplanation={true}
              explanation={q?.explanation || 'No explanation provided.'}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
