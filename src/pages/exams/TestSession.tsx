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

export default function TestSession() {
  const navigate = useNavigate();
  const { id: attemptId } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attemptData, setAttemptData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    document.title = "Test Session • EM Gurus";
    loadAttemptAndFirstQuestion();
  }, [attemptId]);

  // Timer effect
  useEffect(() => {
    if (timeLeft > 0 && !showExplanation) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && attemptData) {
      // Auto-submit when time runs out
      handleSubmit();
    }
  }, [timeLeft, showExplanation, attemptData]);

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

      // Set timer from breakdown or default
      const breakdown = attempt.breakdown as any;
      const timeLimit = breakdown?.time_limit || 60;
      setTimeLeft(timeLimit * 60); // Convert minutes to seconds

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
      const examLabel = mapEnumToLabel(enumVal);
      const topic = config.topic;

      // Query reviewed questions with filters
      let query = supabase
        .from('reviewed_exam_questions')
        .select('id, stem, options, correct_index, explanation, exam, topic')
        .eq('status', 'approved')
        .order('id', { ascending: false });

      // Apply filters if available
      if (examLabel && examLabel !== 'Other') {
        query = query.eq('exam', examLabel);
      }
      if (topic) {
        query = query.eq('topic', topic);
      }

      const { data: questions, error } = await query.limit(1);

      if (error) throw error;

      if (!questions || questions.length === 0) {
        // Show empty state instead of error
        setQuestion(null);
        return;
      }

      const q = questions[0];
      // Convert options array to choices object for compatibility
      const choicesObj: Record<string, string> = {};
      if (q.options && Array.isArray(q.options)) {
        q.options.forEach((option: string, index: number) => {
          const key = String.fromCharCode(65 + index); // A, B, C, D, E
          choicesObj[key] = option;
        });
      }
      
      setQuestion({
        id: q.id,
        stem: q.stem,
        choices: choicesObj,
        correct_index: q.correct_index || 0,
        explanation: q.explanation || '',
        tags: [q.topic].filter(Boolean)
      });
    } catch (err: any) {
      console.error('Question load failed', err);
      setQuestion(null);
    }
  };

  const handleSubmit = async () => {
    if (!question || !attemptId) return;

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
          selected_key: selected || 'No answer',
          correct_key: Object.keys(question.choices)[question.correct_index],
          topic: question.tags?.[0] || 'General',
          position: 1
        });

      // Update attempt as finished
      await supabase
        .from('exam_attempts')
        .update({ finished_at: new Date().toISOString() })
        .eq('id', attemptId);

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
      title: 'Test Complete!',
      description: 'Check your dashboard for detailed results.',
      duration: 3000
    });
    navigate('/dashboard/exams/attempts');
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading && !question) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardContent className="py-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading test session...</p>
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
            <Button onClick={() => navigate('/exams/test')}>
              Back to Configuration
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Timer Bar */}
      <Card className="mb-6">
        <CardContent className="py-3">
          <div className="flex justify-between items-center">
            <span className="font-medium">Test Mode</span>
            <span className={`font-mono ${timeLeft < 300 ? 'text-destructive' : 'text-foreground'}`}>
              Time Remaining: {formatTime(timeLeft)}
            </span>
          </div>
        </CardContent>
      </Card>

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
              onClick={() => navigate('/exams/test')}
            >
              Back to Config
            </Button>
            
            {!showExplanation ? (
              <Button 
                onClick={handleSubmit} 
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Test'}
              </Button>
            ) : (
              <Button onClick={handleFinish}>
                View Results
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}