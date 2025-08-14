import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import QuestionCard from "@/components/exams/QuestionCard";
import MarkForReviewButton from "@/components/exams/MarkForReviewButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { mapEnumToLabel } from "@/lib/exams";
import { recordNotification } from "@/components/ui/ToastOrNotice";

// Shuffle utility for randomizing questions
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  const [showSummary, setShowSummary] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

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

      // Check if we already have question IDs stored from session creation
      if (attempt.question_ids && attempt.question_ids.length > 0) {
        // Load the stored questions in their randomized order
        const { data: questionData, error } = await supabase
          .from('reviewed_exam_questions')
          .select('id, stem, options, correct_index, explanation, exam, topic, status')
          .in('id', attempt.question_ids)
          .eq('status', 'approved');
        
        if (error) throw error;
        
        // Sort questions according to the stored order
        const orderedQuestions = attempt.question_ids.map((id: string) => 
          questionData?.find(q => q.id === id)
        ).filter(Boolean);
        
        if (orderedQuestions.length > 0) {
          const normalizedQuestions = orderedQuestions.map(q => {
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
          return;
        }
      }

      // Fallback: fetch and randomize new questions
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

        let { data, error } = await query.limit(totalQuestions * 3); // Get more for randomization
        if (error) throw error;
        if (data?.length) return data;

        // Fallback: exam only (remove topic filter)
        ({ data, error } = await supabase
          .from('reviewed_exam_questions')
          .select('id, stem, options, correct_index, explanation, exam, topic, status')
          .eq('status', 'approved')
          .eq('exam', examLabel)
          .limit(totalQuestions * 3));
        if (error) throw error;
        if (data?.length) return data;

        return [];
      }

      const questionData = await fetchReviewed();
      if (!questionData.length) {
        setQuestions([]);
        return;
      }

      // Randomize and limit to required count
      const shuffledQuestions = shuffle(questionData).slice(0, totalQuestions);
      
      // Update attempt with randomized question IDs
      const questionIds = shuffledQuestions.map(q => q.id);
      await supabase
        .from('exam_attempts')
        .update({ question_ids: questionIds })
        .eq('id', attempt.id);

      // Normalize questions
      const normalizedQuestions = shuffledQuestions.map(q => {
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
      setSelected(answers[currentIndex + 1] || "");
      setShowExplanation(false);
    } else {
      finishPractice();
    }
  };

  const finishPractice = async () => {
    // Update attempt as finished
    if (attemptId) {
      await supabase
        .from('exam_attempts')
        .update({ 
          finished_at: new Date().toISOString(),
          correct_count: score.correct,
          total_attempted: score.total
        })
        .eq('id', attemptId);
    }

    setShowSummary(true);
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

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSelected(answers[currentIndex - 1] || "");
      setShowExplanation(false);
    }
  };

  const jumpToQuestion = (index: number) => {
    setCurrentIndex(index);
    setSelected(answers[index] || "");
    setShowExplanation(false);
  };

  // Calculate summary stats
  const answeredCount = Object.keys(answers).length;
  const byTopic = questions.reduce((acc, q, i) => {
    const topic = q.tags?.[0] || 'General';
    if (!acc[topic]) acc[topic] = { correct: 0, total: 0 };
    
    if (answers[i]) {
      acc[topic].total++;
      const correctKey = Object.keys(q.choices)[q.correct_index];
      if (answers[i] === correctKey) {
        acc[topic].correct++;
      }
    }
    return acc;
  }, {} as Record<string, { correct: number; total: number }>);

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

  if (showSummary && !reviewMode) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="py-8">
            <h2 className="text-2xl font-semibold mb-6">Practice Summary</h2>
            <div className="grid gap-6">
              <div className="text-lg font-semibold">
                Score: {score.correct} / {score.total} ({Math.round((score.correct / score.total) * 100)}%)
              </div>
              
              <div className="text-sm text-muted-foreground">
                Questions attempted: {score.total} of {questions.length}
              </div>

              {Object.keys(byTopic).length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">Performance by Topic</h3>
                  <div className="grid gap-2">
                    {Object.entries(byTopic).map(([topic, stats]) => (
                      <div key={topic} className="flex justify-between text-sm">
                        <span>{topic}</span>
                        <span>{stats.correct}/{stats.total} ({Math.round((stats.correct / stats.total) * 100)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => navigate('/exams/practice')}>
                  New Practice
                </Button>
                <Button onClick={() => setReviewMode(true)}>
                  Review Answers
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showSummary && reviewMode) {
    const currentQuestion = questions[currentIndex];
    const userAnswer = answers[currentIndex] || '';
    const correctKey = Object.keys(currentQuestion.choices)[currentQuestion.correct_index];
    
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-6">
          <CardContent className="py-3">
            <div className="flex justify-between items-center">
              <span className="font-medium">Review Mode</span>
              <span className="text-sm text-muted-foreground">
                Question {currentIndex + 1} of {questions.length}
              </span>
            </div>
          </CardContent>
        </Card>

        <QuestionCard
          stem={currentQuestion.stem}
          options={Object.entries(currentQuestion.choices).map(([key, text]) => ({ key, text }))}
          selectedKey={userAnswer}
          onSelect={() => {}} // Read-only in review mode
          showExplanation={true}
          explanation={currentQuestion.explanation}
          correctKey={correctKey}
          questionId={currentQuestion.id}
          lockSelection={true}
        />

        <Card className="mt-6">
          <CardContent className="py-4">
            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setReviewMode(false)}>
                Back to Summary
              </Button>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => jumpToQuestion(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                >
                  Previous
                </Button>
                <Button 
                  onClick={() => jumpToQuestion(Math.min(questions.length - 1, currentIndex + 1))}
                  disabled={currentIndex === questions.length - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
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
            source={currentQuestion.tags?.[0]}
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
                
                <div className="flex gap-2">
                  {showExplanation && (
                    <MarkForReviewButton 
                      currentQuestionId={currentQuestion.id} 
                      source="reviewed" 
                    />
                  )}
                  
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
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            <Card>
              <CardContent className="py-4">
                <div className="text-sm font-medium mb-2">Progress</div>
                <div className="text-sm mb-2">{answeredCount} of {questions.length} answered</div>
                <Progress value={(answeredCount / questions.length) * 100} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4">
                <div className="text-sm font-medium mb-3">Question Map</div>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((_, i) => {
                    const isCurrent = i === currentIndex;
                    const hasAnswer = answers[i];
                    const isCorrect = hasAnswer && answers[i] === Object.keys(questions[i].choices)[questions[i].correct_index];
                    
                    const baseClasses = "h-8 w-8 rounded text-sm flex items-center justify-center border cursor-pointer";
                    const stateClasses = isCurrent
                      ? "bg-primary text-primary-foreground border-primary"
                      : hasAnswer
                        ? isCorrect 
                          ? "bg-success/20 border-success text-success hover:bg-success/30"
                          : "bg-destructive/10 border-destructive text-destructive hover:bg-destructive/20"
                        : "bg-muted hover:bg-muted/70";
                    
                    return (
                      <button
                        key={i}
                        onClick={() => jumpToQuestion(i)}
                        className={`${baseClasses} ${stateClasses}`}
                        aria-label={`Go to question ${i + 1}`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Mobile drawer for controls */}
            <div className="lg:hidden">
              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    Practice Tools
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="p-4 space-y-4">
                  <div>
                    <div className="text-sm font-medium mb-2">Progress</div>
                    <div className="text-sm mb-2">{answeredCount} of {questions.length} answered</div>
                    <Progress value={(answeredCount / questions.length) * 100} />
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-3">Question Map</div>
                    <div className="grid grid-cols-8 gap-2">
                      {questions.map((_, i) => {
                        const isCurrent = i === currentIndex;
                        const hasAnswer = answers[i];
                        
                        return (
                          <button
                            key={i}
                            onClick={() => jumpToQuestion(i)}
                            className={`h-8 w-8 rounded text-sm flex items-center justify-center border ${
                              isCurrent ? "bg-primary text-primary-foreground" : 
                              hasAnswer ? "bg-muted" : "bg-background"
                            }`}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </DrawerContent>
              </Drawer>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}