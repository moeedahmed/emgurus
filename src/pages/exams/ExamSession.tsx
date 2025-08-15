import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Flag } from "lucide-react";
import QuestionCard from "@/components/exams/QuestionCard";
import MarkForReviewButton from "@/components/exams/MarkForReviewButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ExamSessionState {
  ids: string[];
  limitSec: number;
  exam: string;
  topic?: string;
  count: number;
}

interface Question {
  id: string;
  stem: string;
  options: { key: string; text: string }[];
  source?: string;
  topic?: string;
  exam?: string;
  answer_key?: string;
}

export default function ExamSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const sessionState = location.state as ExamSessionState | null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [attemptId, setAttemptId] = useState<string>("");
  const [startTime, setStartTime] = useState<Date>(new Date());

  useEffect(() => {
    document.title = "Exam Session • EM Gurus";
  }, []);

  // Initialize session
  useEffect(() => {
    if (!sessionState?.ids?.length) {
      console.warn('No session state found, redirecting to exam config');
      navigate('/exams/exam');
      return;
    }

    console.log('Initializing exam session with state:', sessionState);
    setTimeLeft(sessionState.limitSec);
    setStartTime(new Date());
    loadQuestions();
    createAttempt();
  }, [sessionState, navigate]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const loadQuestions = async () => {
    if (!sessionState?.ids?.length) {
      console.error('No question IDs provided');
      return;
    }

    try {
      console.log('Loading questions for IDs:', sessionState.ids);
      const { data, error } = await supabase
        .from('reviewed_exam_questions')
        .select('id, stem, options, topic, exam')
        .in('id', sessionState.ids)
        .eq('status', 'approved');

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      if (!data?.length) {
        console.error('No questions found for provided IDs');
        throw new Error('No questions found');
      }

      // Order questions according to the IDs array
      const orderedQuestions = sessionState.ids.map(id => 
        data?.find(q => q.id === id)
      ).filter(Boolean).map(q => {
        if (!q) return null;
        
        const options = Array.isArray(q.options) ? q.options.map((opt: any, index: number) => ({
          key: String.fromCharCode(65 + index), // A, B, C, D, E
          text: typeof opt === 'string' ? opt : opt.text || opt.option || ''
        })) : [];

        return {
          id: q.id,
          stem: q.stem || '',
          options,
          topic: q.topic || undefined,
          exam: q.exam || undefined,
          answer_key: undefined // Will be handled separately
        };
      }).filter((q): q is NonNullable<typeof q> => q !== null);

      if (!orderedQuestions.length) {
        throw new Error('No valid questions could be processed');
      }

      console.log('Successfully loaded questions:', orderedQuestions.length);
      setQuestions(orderedQuestions);
    } catch (err) {
      console.error('Load questions failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast({
        title: 'Failed to load questions',
        description: `Error: ${errorMessage}. Please try again.`,
        variant: 'destructive'
      });
      // Navigate back to config instead of hanging on broken page
      setTimeout(() => navigate('/exams/exam'), 2000);
    } finally {
      setLoading(false);
    }
  };

  const createAttempt = async () => {
    if (!sessionState) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: attempt, error } = await supabase
        .from('exam_attempts')
        .insert({
          user_id: user.id,
          source: 'reviewed_questions',
          mode: 'exam',
          total_questions: sessionState.count,
          question_ids: sessionState.ids,
          time_limit_sec: sessionState.limitSec
        })
        .select('id')
        .single();

      if (error) throw error;
      setAttemptId(attempt.id);
    } catch (err) {
      console.error('Create attempt failed:', err);
    }
  };

  const handleTimeUp = () => {
    toast({
      title: 'Time Up!',
      description: 'Your exam has been automatically submitted.',
      variant: 'destructive'
    });
    finishExam();
  };

  const finishExam = async () => {
    if (!attemptId) {
      navigate('/exams');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Save all answers
      const answerItems = Object.entries(answers).map(([questionId, selectedKey]) => {
        const question = questions.find(q => q.id === questionId);
        return {
          attempt_id: attemptId,
          question_id: questionId,
          user_id: user.id,
          selected_key: selectedKey,
          correct_key: question?.answer_key || '',
          topic: question?.topic || null,
          position: questions.findIndex(q => q.id === questionId) + 1
        };
      });

      if (answerItems.length > 0) {
        await supabase.from('exam_attempt_items').insert(answerItems);
      }

      // Calculate score
      const correctCount = answerItems.filter(item => 
        item.selected_key?.toUpperCase() === item.correct_key?.toUpperCase()
      ).length;

      const durationSec = Math.floor((Date.now() - startTime.getTime()) / 1000);

      // Update attempt
      await supabase
        .from('exam_attempts')
        .update({
          finished_at: new Date().toISOString(),
          total_attempted: Object.keys(answers).length,
          correct_count: correctCount,
          duration_sec: durationSec
        })
        .eq('id', attemptId);

      const percentage = Math.round((correctCount / questions.length) * 100);
      
      toast({
        title: 'Exam Complete!',
        description: `Score: ${correctCount}/${questions.length} (${percentage}%)`,
        duration: 5000
      });

      setTimeout(() => navigate('/dashboard/exams/attempts'), 2000);
    } catch (err) {
      console.error('Finish exam failed:', err);
      toast({
        title: 'Failed to save exam',
        description: 'Please try again.',
        variant: 'destructive'
      });
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const markedCount = markedForReview.size;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardContent className="py-8 text-center">
            <div className="mb-3">Loading exam...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!sessionState || !questions.length) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardContent className="py-8 text-center">
            <div className="mb-3 font-medium">Session not found</div>
            <Button variant="outline" onClick={() => navigate('/exams/exam')}>
              Back to Exam Config
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Sticky header with timer */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-6 -mx-4 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Exam Session
            </h1>
            <div className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {questions.length} • {sessionState.exam}
              {sessionState.topic && ` • ${sessionState.topic}`}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Time Remaining</div>
              <div className={`text-lg font-mono font-semibold ${timeLeft < 300 ? 'text-destructive' : ''}`}>
                {formatTime(timeLeft)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Progress</div>
              <div className="text-lg font-semibold">
                {answeredCount}/{questions.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <div className="flex items-center gap-2">
              {markedCount > 0 && (
                <Badge variant="outline" className="text-orange-600">
                  <Flag className="h-3 w-3 mr-1" />
                  {markedCount} marked
                </Badge>
              )}
              <Badge variant="destructive">Timed</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentQuestion && (
            <>
              <QuestionCard
                stem={currentQuestion.stem}
                options={currentQuestion.options}
                selectedKey={answers[currentQuestion.id] || ""}
                onSelect={(key) => setAnswers(prev => ({ ...prev, [currentQuestion.id]: key }))}
                showExplanation={false}
                source={currentQuestion.source}
              />

              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2">
                  <MarkForReviewButton
                    currentQuestionId={currentQuestion.id}
                    source="reviewed"
                  />
                  <Button 
                    variant="outline" 
                    onClick={finishExam}
                    className="text-orange-600"
                  >
                    Finish Early
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => {
                      if (currentIndex < questions.length - 1) {
                        setCurrentIndex(prev => prev + 1);
                      } else {
                        finishExam();
                      }
                    }}
                  >
                    {currentIndex < questions.length - 1 ? 'Next' : 'Finish Exam'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}