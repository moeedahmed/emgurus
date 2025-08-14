import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import QuestionCard from "@/components/exams/QuestionCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { mapEnumToLabel } from "@/lib/exams";

interface Question {
  id: string;
  stem: string;
  choices: Record<string, string>;
  correct_index: number;
  explanation: string;
  tags?: string[];
}

export default function PracticeSession() {
  const navigate = useNavigate();
  const { id: attemptId } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attemptData, setAttemptData] = useState<any>(null);

  useEffect(() => {
    document.title = "Practice Session • EM Gurus";
    loadAttemptAndFirstQuestion();
  }, [attemptId]);

  const loadAttemptAndFirstQuestion = async () => {
    if (!attemptId) return;

    try {
      setLoading(true);

      // Load attempt data
      const { data: attempt, error: attemptError } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('id', attemptId)
        .single();

      if (attemptError) throw attemptError;
      setAttemptData(attempt);

      // Load first question based on attempt configuration
      await loadQuestion(attempt);
    } catch (err: any) {
      console.error('Load failed', err);
      toast({
        title: 'Load failed',
        description: err?.message || String(err),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadQuestion = async (attempt: any) => {
    try {
      const config = attempt.breakdown || {};
      const enumVal = config.exam_type;
      const examLabel = mapEnumToLabel?.(enumVal) ?? 'MRCEM Intermediate SBA';
      const topic = config.topic;

      // Helper: try N queries, first that returns rows wins
      async function fetchReviewed(): Promise<any[]> {
        // 1) strict (exam + topic)
        let { data, error } = await supabase
          .from('reviewed_exam_questions')
          .select('id, stem, options, correct_index, explanation, exam, topic, status')
          .eq('status','approved')
          .eq('exam', examLabel)
          .eq('topic', topic ?? '__no_topic__');   // forces no match if topic is null
        if (error) throw error;
        if (data?.length) return data;

        // 2) relax topic (exam only)
        ({ data, error } = await supabase
          .from('reviewed_exam_questions')
          .select('id, stem, options, correct_index, explanation, exam, topic, status')
          .eq('status','approved')
          .eq('exam', examLabel));
        if (error) throw error;
        if (data?.length) return data;

        // 3) last-ditch: any approved question
        ({ data, error } = await supabase
          .from('reviewed_exam_questions')
          .select('id, stem, options, correct_index, explanation, exam, topic, status')
          .eq('status','approved')
          .limit(1)
          .order('id', { ascending: false }));
        if (error) throw error;
        return data ?? [];
      }

      const questions = await fetchReviewed();
      if (!questions.length) {
        setQuestion(null); // render your nice empty state
        return;
      }

      // Normalize one question
      const q = questions[0];
      const choices: Record<string, string> = {};
      (q.options || []).forEach((opt: string, i: number) => {
        choices[String.fromCharCode(65 + i)] = opt;
      });
      setQuestion({
        id: q.id,
        stem: q.stem,
        choices,
        correct_index: q.correct_index ?? 0,
        explanation: q.explanation ?? '',
        tags: [q.topic].filter(Boolean),
      });
    } catch (err: any) {
      console.error('Question load failed', err);
      setQuestion(null);
    }
  };

  const handleSubmit = async () => {
    if (!question || !selected || !attemptId) return;

    try {
      setLoading(true);

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('User not authenticated');

      // Save attempt item
      const isCorrect = selected === Object.keys(question.choices)[question.correct_index];
      
      await supabase
        .from('exam_attempt_items')
        .insert({
          attempt_id: attemptId,
          question_id: question.id,
          user_id: user.id,
          selected_key: selected,
          correct_key: Object.keys(question.choices)[question.correct_index],
          topic: question.tags?.[0] || 'General',
          position: 1
        });

      setShowExplanation(true);
    } catch (err: any) {
      console.error('Submit failed', err);
      toast({
        title: 'Submit failed',
        description: err?.message || String(err),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    toast({
      title: 'Practice Complete!',
      description: 'Check your dashboard for detailed results.',
      duration: 3000
    });
    navigate('/exams/practice', { replace: true });
  };

  if (loading && !question) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardContent className="py-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading practice session...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardContent className="py-8 text-center">
            <h2 className="text-xl font-semibold mb-4">No Questions Available</h2>
            <p className="text-muted-foreground mb-4">
              No reviewed questions found for this filter. Try removing the topic filter or choose a different exam.
            </p>
            <Button onClick={() => navigate('/exams/practice')}>
              Back to Configuration
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <QuestionCard
        stem={question.stem}
        options={Object.entries(question.choices).map(([key, text]) => ({ key, text }))}
        selectedKey={selected}
        onSelect={setSelected}
        showExplanation={showExplanation}
        explanation={question.explanation}
        correctKey={Object.keys(question.choices)[question.correct_index]}
        questionId={question.id}
      />

      <Card className="mt-6">
        <CardContent className="py-4">
          <div className="flex justify-between items-center">
            <Button 
              variant="outline" 
              onClick={() => navigate('/exams/practice')}
            >
              Back to Config
            </Button>
            
            {!showExplanation ? (
              <Button 
                onClick={handleSubmit} 
                disabled={!selected || loading}
              >
                {loading ? 'Submitting...' : 'Submit'}
              </Button>
            ) : (
              <Button onClick={handleFinish}>
                Finish Practice
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}