import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import QuestionCard from "@/components/exams/QuestionCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { mapEnumToLabel } from "@/lib/exams";
import { recordNotification } from "@/components/ui/ToastOrNotice";

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

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string>("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attemptData, setAttemptData] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [score, setScore] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });

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

      // Load questions based on attempt configuration
      await loadQuestions(attempt);
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

  const loadQuestions = async (attempt: any) => {
    try {
      const config = attempt.breakdown || {};
      const examLabel = config.exam_label || mapEnumToLabel(config.exam_type) || 'MRCEM Intermediate SBA';
      const topic = config.topic;
      const totalQuestions = attempt.total_questions || 10;

      // Helper: try queries with fallbacks
      async function fetchReviewed(): Promise<any[]> {
        let query = supabase
          .from('reviewed_exam_questions')
          .select('id, stem, options, correct_index, explanation, exam, topic, status')
          .eq('status', 'approved')
          .eq('exam', examLabel);

        // Add topic filter if specified and not "All areas"
        if (topic && topic !== 'All areas') {
          query = query.eq('topic', topic);
        }

        let { data, error } = await query.limit(totalQuestions);
        if (error) throw error;
        if (data?.length) return data;

        // Fallback: exam only (remove topic filter)
        ({ data, error } = await supabase
          .from('reviewed_exam_questions')
          .select('id, stem, options, correct_index, explanation, exam, topic, status')
          .eq('status', 'approved')
          .eq('exam', examLabel)
          .limit(totalQuestions));
        if (error) throw error;
        if (data?.length) return data;

        // Last resort: any approved questions
        ({ data, error } = await supabase
          .from('reviewed_exam_questions')
          .select('id, stem, options, correct_index, explanation, exam, topic, status')
          .eq('status', 'approved')
          .limit(totalQuestions)
          .order('id', { ascending: false }));
        if (error) throw error;
        return data ?? [];
      }

      const questionData = await fetchReviewed();
      if (!questionData.length) {
        setQuestions([]);
        return;
      }

      // Normalize all questions
      const normalizedQuestions = questionData.map(q => {
        const choices: Record<string, string> = {};
        (q.options || []).forEach((opt: string, i: number) => {
          choices[String.fromCharCode(65 + i)] = opt;
        });
        return {
          id: q.id,
          stem: q.stem,
          choices,
          correct_index: q.correct_index ?? 0,
          explanation: q.explanation ?? '',
          tags: [q.topic].filter(Boolean),
        };
      });

      setQuestions(normalizedQuestions);
      setCurrentIndex(0);
    } catch (err: any) {
      console.error('Questions load failed', err);
      setQuestions([]);
    }
  };

  const handleSubmit = async () => {
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion || !selected || !attemptId) return;

    try {
      setLoading(true);

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('User not authenticated');

      // Save attempt item
      const isCorrect = selected === Object.keys(currentQuestion.choices)[currentQuestion.correct_index];
      
      await supabase
        .from('exam_attempt_items')
        .insert({
          attempt_id: attemptId,
          question_id: currentQuestion.id,
          user_id: user.id,
          selected_key: selected,
          correct_key: Object.keys(currentQuestion.choices)[currentQuestion.correct_index],
          topic: currentQuestion.tags?.[0] || 'General',
          position: currentIndex + 1
        });

      // Update answers and score
      setAnswers(prev => ({ ...prev, [currentIndex]: selected }));
      setScore(prev => ({ 
        correct: prev.correct + (isCorrect ? 1 : 0), 
        total: prev.total + 1 
      }));

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

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelected("");
      setShowExplanation(false);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    const scoreText = `${score.correct}/${score.total}`;
    
    toast({
      title: 'Practice Complete!',
      description: `You scored ${scoreText} correct`,
      duration: 5000
    });
    
    // Record notification
    await recordNotification(user?.id, 'Practice complete', `You scored ${scoreText}`, '/dashboard?view=exams&tab=attempts');
    
    navigate('/exams/practice', { replace: true });
  };

  if (loading && questions.length === 0) {
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

  if (questions.length === 0 && !loading) {
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

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Progress indicator */}
      <Card className="mb-6">
        <CardContent className="py-3">
          <div className="flex justify-between items-center">
            <span className="font-medium">Practice Mode</span>
            <span className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {questions.length}
            </span>
          </div>
        </CardContent>
      </Card>

      <QuestionCard
        stem={currentQuestion.stem}
        options={Object.entries(currentQuestion.choices).map(([key, text]) => ({ key, text }))}
        selectedKey={selected}
        onSelect={setSelected}
        showExplanation={showExplanation}
        explanation={currentQuestion.explanation}
        correctKey={Object.keys(currentQuestion.choices)[currentQuestion.correct_index]}
        questionId={currentQuestion.id}
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
              <Button onClick={handleNext}>
                {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Practice'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}