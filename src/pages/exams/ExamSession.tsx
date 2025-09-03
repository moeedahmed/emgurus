import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Flag, ArrowLeft } from "lucide-react";
import QuestionCard from "@/components/exams/QuestionCard";
import Progress from "@/components/exams/Progress";
import RightSidebar from "@/components/exams/RightSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { MODE_LABEL, SHOW_GURU } from "@/lib/exams/modeLabels";

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

const FEEDBACK_TAGS = ["Wrong answer", "Ambiguous", "Outdated", "Typo", "Too easy", "Too hard"] as const;

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
  
  // Feedback state
  const [feedbackType, setFeedbackType] = useState<{ [key: number]: 'good' | 'improvement' }>({});
  const [feedbackTags, setFeedbackTags] = useState<{ [key: number]: Set<string> }>({});
  const [feedbackText, setFeedbackText] = useState<{ [key: number]: string }>({});
  
  // Autosave state
  const savingRef = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});
  const [feedbackDirty, setFeedbackDirty] = useState<Record<number, boolean>>({});
  const [feedbackSaving, setFeedbackSaving] = useState<Record<number, boolean>>({});
  const [feedbackSaved, setFeedbackSaved] = useState<Record<number, boolean>>({});
  const [feedbackError, setFeedbackError] = useState<Record<number, string | null>>({});

  useEffect(() => {
    document.title = "Exam Session • EM Gurus";
    document.body.classList.add('exam-shell');
    return () => document.body.classList.remove('exam-shell');
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

  // Feedback helpers
  const buildFeedbackPayload = (qIndex: number) => ({
    type: feedbackType[qIndex] ?? null,
    tags: Array.from(feedbackTags[qIndex] ?? []),
    text: feedbackText[qIndex] ?? '',
  });

  const toggleQuestionFlag = async (questionId: string, shouldFlag: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      if (shouldFlag) {
        await supabase.from('exam_question_flags').insert({
          question_id: questionId,
          question_source: 'reviewed',
          flagged_by: user.id,
          comment: null,
        });
      } else {
        await supabase.from('exam_question_flags')
          .delete()
          .eq('question_id', questionId)
          .eq('flagged_by', user.id);
      }
    } catch (err) {
      console.error('Flag toggle failed:', err);
    }
  };

  const syncMarkForReview = async (qIndex: number) => {
    const shouldFlag = feedbackType[qIndex] === 'improvement';
    const question = questions[qIndex];
    if (question) {
      await toggleQuestionFlag(question.id, shouldFlag);
    }
  };

  const submitFeedback = async (qIndex: number, payload: any) => {
    // Mock implementation for exam feedback submission
    // In a real app, this would submit to your feedback endpoint
    console.log('Submitting feedback for question', qIndex, payload);
  };

  const doSubmitFeedback = async (qIndex: number) => {
    setFeedbackError(v => ({...v, [qIndex]: null}));
    setFeedbackSaving(v => ({...v, [qIndex]: true}));
    try {
      await submitFeedback(qIndex, buildFeedbackPayload(qIndex));
      await syncMarkForReview(qIndex);
      setFeedbackSaved(v => ({...v, [qIndex]: true}));
      setFeedbackDirty(v => ({...v, [qIndex]: false}));
    } catch (e: any) {
      setFeedbackError(v => ({...v, [qIndex]: e?.message ?? 'Could not save'}));
    } finally {
      setFeedbackSaving(v => ({...v, [qIndex]: false}));
    }
  };

  const queueSubmitFeedback = (qIndex: number, delay = 450) => {
    setFeedbackDirty(v => ({...v, [qIndex]: true}));
    if (savingRef.current[qIndex]) clearTimeout(savingRef.current[qIndex]!);
    savingRef.current[qIndex] = setTimeout(() => { void doSubmitFeedback(qIndex); }, delay);
  };

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
    // Flush pending feedback
    if (feedbackDirty[currentIndex]) {
      if (savingRef.current[currentIndex]) clearTimeout(savingRef.current[currentIndex]!);
      await doSubmitFeedback(currentIndex);
    }
    
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
      
      // Show result card instead of just toast
      showExamResult(correctCount, questions.length, percentage);
    } catch (err) {
      console.error('Finish exam failed:', err);
      toast({
        title: 'Failed to save exam',
        description: 'Please try again.',
        variant: 'destructive'
      });
    }
  };

  const showExamResult = (correct: number, total: number, percentage: number) => {
    // Navigate to report card instead of showing toast/confirm
    const durationSec = Math.floor((Date.now() - startTime.getTime()) / 1000);
    
    navigate('/exams/result', {
      replace: true,
      state: {
        attemptId,
        score: { correct, total, percentage },
        duration: { seconds: durationSec, formatted: formatTime(durationSec) },
        exam: { name: sessionState.exam, topic: sessionState.topic }
      }
    });
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

  // Compute shared values for unified shell
  const total = questions.length;
  const percent = total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0;
  const modeTitle = 'Exam Mode';
  const metaLeft = `Question ${currentIndex + 1} of ${total} • ${sessionState?.exam ?? 'Unknown'}${sessionState?.topic ? ` • ${sessionState.topic}` : ''}`;
  const metaRight = `${percent}% complete`;

  return (
    <div className="container mx-auto px-4 py-6 overflow-x-clip">
      {/* Unified header */}
      <Progress current={currentIndex + 1} total={total} />
      <div className="flex items-center justify-between mt-4 mb-6">
        <h1 className="text-2xl font-semibold">{MODE_LABEL["exam"]}</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={timeLeft < 300 ? 'text-destructive' : ''}>
            <Clock className="h-3 w-3 mr-1" />
            {formatTime(timeLeft)}
          </Badge>
          {markedCount > 0 && (
            <Badge variant="outline" className="text-warning">
              <Flag className="h-3 w-3 mr-1" />
              {markedCount} marked
            </Badge>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      <div className="md:hidden mt-4">
        <Button variant="outline" size="sm">Open question map</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4 mt-6">
        <div className="lg:col-span-3">
          <Card>
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
                questionId={currentQuestion.id}
                index={currentIndex}
                total={questions.length}
              />

              {/* Question Feedback - show after selection */}
              {answers[currentQuestion.id] && (
                <Card className="min-w-0 w-full max-w-full mt-4">
                  <CardContent className="min-w-0 w-full max-w-full break-words p-4 sm:p-5">
                    <h3 className="font-semibold mb-2">Question Feedback</h3>

                    <div className="flex flex-wrap gap-2 w-full min-w-0 mb-3">
                      <Button
                        variant={feedbackType[currentIndex] === 'good' ? 'default' : 'secondary'}
                        size="icon"
                        className="h-10 w-10 rounded-full"
                        aria-pressed={feedbackType[currentIndex] === 'good'}
                        aria-label="Looks good"
                        onClick={() => {
                          setFeedbackType(v => ({...v, [currentIndex]: 'good'}));
                          queueSubmitFeedback(currentIndex, 300);
                        }}
                      >
                        <span aria-hidden>👍</span>
                        <span className="sr-only">Looks good</span>
                      </Button>

                      <Button
                        variant={feedbackType[currentIndex] === 'improvement' ? 'default' : 'secondary'}
                        size="icon"
                        className="h-10 w-10 rounded-full"
                        aria-pressed={feedbackType[currentIndex] === 'improvement'}
                        aria-label="Needs improvement"
                        onClick={() => {
                          setFeedbackType(v => ({...v, [currentIndex]: 'improvement'}));
                          queueSubmitFeedback(currentIndex, 300);
                        }}
                      >
                        <span aria-hidden>👎</span>
                        <span className="sr-only">Needs improvement</span>
                      </Button>
                    </div>

                    {feedbackType[currentIndex] === 'improvement' && (
                      <div className="rounded-md border p-3 sm:p-4">
                        <p className="font-medium mb-2">What's the issue? (select all)</p>
                        <div className="flex flex-wrap gap-2 w-full min-w-0 mb-3">
                          {FEEDBACK_TAGS.map(tag => (
                            <Button
                              key={tag}
                              variant={feedbackTags[currentIndex]?.has(tag) ? 'default' : 'secondary'}
                              className="min-w-0 text-sm px-3 py-2"
                              onClick={() => {
                                setFeedbackTags(v => {
                                  const next = new Set(v[currentIndex] ?? []);
                                  next.has(tag) ? next.delete(tag) : next.add(tag);
                                  return {...v, [currentIndex]: next};
                                });
                                queueSubmitFeedback(currentIndex, 350);
                              }}
                            >
                              {tag}
                            </Button>
                          ))}
                        </div>
                        <Textarea
                          value={feedbackText[currentIndex] ?? ''}
                          onChange={(e) => {
                            setFeedbackText(v => ({...v, [currentIndex]: e.target.value}));
                            queueSubmitFeedback(currentIndex, 600);
                          }}
                          placeholder="Add details (optional)…"
                          className="min-w-0 w-full"
                        />
                      </div>
                    )}

                    <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                      {feedbackSaving[currentIndex] ? 'Saving…' : feedbackError[currentIndex] ? `Error: ${feedbackError[currentIndex]}` : feedbackSaved[currentIndex] ? 'Saved' : ''}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Primary action placement */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="justify-self-start">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (feedbackDirty[currentIndex]) {
                        if (savingRef.current[currentIndex]) clearTimeout(savingRef.current[currentIndex]!);
                        await doSubmitFeedback(currentIndex);
                      }
                      setCurrentIndex(prev => Math.max(0, prev - 1));
                    }}
                    disabled={currentIndex === 0}
                    className="min-w-0 text-sm sm:text-base"
                  >
                    Previous
                  </Button>
                </div>
                <div className="justify-self-end">
                  <Button
                    onClick={async () => {
                      if (feedbackDirty[currentIndex]) {
                        if (savingRef.current[currentIndex]) clearTimeout(savingRef.current[currentIndex]!);
                        await doSubmitFeedback(currentIndex);
                      }
                      
                      if (currentIndex < questions.length - 1) {
                        setCurrentIndex(prev => prev + 1);
                      } else {
                        finishExam();
                      }
                    }}
                    disabled={!answers[currentQuestion.id]}
                    className="min-w-0 text-sm sm:text-base"
                  >
                    {currentIndex < questions.length - 1 ? 'Next' : 'Finish Exam'}
                  </Button>
                </div>
              </div>

              {!answers[currentQuestion.id] && (
                <div className="text-sm text-muted-foreground text-center mt-2">
                  Please select an answer to continue
                </div>
              )}

              {/* Secondary actions - below primary actions */}
              <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between order-last md:order-none">
                <div className="flex flex-wrap items-center gap-2 gap-y-2">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/exams/exam')}
                    className="flex items-center gap-2 min-w-0 text-sm sm:text-base"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Config
                  </Button>
                   <Button 
                     variant="outline" 
                     onClick={finishExam}
                     className="text-warning min-w-0 text-sm sm:text-base"
                   >
                    Finish Early
                  </Button>
                </div>
              </div>
            </>
          )}
            </CardContent>
          </Card>
        </div>

        {/* Desktop Sidebar */}
        <aside className="hidden lg:block">
          <RightSidebar
            total={questions.length}
            currentIndex={currentIndex}
            answered={Object.fromEntries(questions.map((_, i) => [i, !!answers[questions[i]?.id]]))}
            onJump={(i) => setCurrentIndex(i)}
            mode="exam"
            showGuru={SHOW_GURU["exam"]}
            examId={sessionState?.exam}
            questionId={currentQuestion?.id}
            kbId={currentQuestion?.topic}
          />
        </aside>
      </div>
    </div>
  );
}