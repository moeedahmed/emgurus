import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { BookOpen, ArrowLeft, ArrowRight, Settings, Flag } from "lucide-react";
import QuestionCard from "@/components/exams/QuestionCard";
import QuestionChat from "@/components/exams/QuestionChat";
import FloatingSettings from "@/components/exams/FloatingSettings";
import Progress from "@/components/exams/Progress";
import RightSidebar from "@/components/exams/RightSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRoles } from "@/hooks/useRoles";
import { useAuth } from "@/contexts/AuthContext";
import { MODE_LABEL, SHOW_GURU } from "@/lib/exams/modeLabels";

interface PracticeSessionState {
  ids: string[];
  index: number;
  exam?: string;
  topic?: string;
}

interface Question {
  id: string;
  stem: string;
  options: { key: string; text: string }[];
  source?: string;
  topic?: string;
  exam?: string;
  correct_answer?: string;
  explanation?: string;
}

const FEEDBACK_TAGS = ["Wrong answer", "Ambiguous", "Outdated", "Typo", "Too easy", "Too hard"] as const;

export default function PracticeSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isGuru } = useRoles();
  const sessionState = location.state as PracticeSessionState | null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [showExplanations, setShowExplanations] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [attemptId, setAttemptId] = useState<string>("");
  const [feedbackType, setFeedbackType] = useState<{ [key: string]: 'good' | 'improvement' | null }>({});
  const [issueTypes, setIssueTypes] = useState<{ [key: string]: string[] }>({});
  const [feedbackNotes, setFeedbackNotes] = useState<{ [key: string]: string }>({});
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<{ [key: string]: boolean }>({});
  
  // Autosave feedback state
  const savingRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const [feedbackDirty, setFeedbackDirty] = useState<Record<string, boolean>>({});
  const [feedbackSaving, setFeedbackSaving] = useState<Record<string, boolean>>({});
  const [feedbackSaved, setFeedbackSaved] = useState<Record<string, boolean>>({});
  const [feedbackError, setFeedbackError] = useState<Record<string, string | null>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [showQuestionMap, setShowQuestionMap] = useState(false);
  const SESSION_KEY = 'emgurus.practice.session';

  useEffect(() => {
    document.title = "Study Session • EM Gurus";
    document.body.classList.add('exam-shell');
    return () => document.body.classList.remove('exam-shell');
  }, []);

  // Save/restore session progress
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved && !sessionState) {
      try {
        const data = JSON.parse(saved);
        if (data.ids?.length) {
          navigate(`/exams/practice/session/${data.ids[data.index || 0]}`, { 
            state: data,
            replace: true 
          });
        }
      } catch (e) {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }, [navigate, sessionState]);

  // Save session to localStorage
  useEffect(() => {
    if (sessionState?.ids?.length) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        ...sessionState,
        index: currentIndex
      }));
    }
  }, [sessionState, currentIndex]);

  // Initialize session
  useEffect(() => {
    if (!sessionState?.ids?.length) {
      console.warn('No session state found, redirecting to practice config');
      navigate('/exams/practice');
      return;
    }

    // Set index from URL params if available
    const questionId = params.id;
    if (questionId && sessionState.ids.includes(questionId)) {
      setCurrentIndex(sessionState.ids.indexOf(questionId));
    } else {
      setCurrentIndex(sessionState.index || 0);
    }
    
    loadQuestions();
    createAttempt();
  }, [sessionState, navigate, params.id]);

  const currentQuestion = questions[currentIndex];
  
  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '5') {
        const idx = parseInt(e.key, 10) - 1;
        const letters = ['A','B','C','D','E'];
        const key = letters[idx];
        if (key && currentQuestion && !showExplanations[currentQuestion.id]) {
          handleAnswer(currentQuestion.id, key);
        }
      } else if (e.key === 'ArrowLeft') {
        prevQuestion();
      } else if (e.key === 'ArrowRight') {
        nextQuestion();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (currentQuestion && answers[currentQuestion.id] && !showExplanations[currentQuestion.id]) {
          // Auto-show explanation when Enter/Space is pressed after answering
          setShowExplanations(prev => ({ ...prev, [currentQuestion.id]: true }));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentQuestion, answers, showExplanations]);

  const loadQuestions = async () => {
    if (!sessionState?.ids?.length) {
      console.error('No question IDs provided');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('reviewed_exam_questions')
        .select('id, stem, options, topic, exam, subtopic, correct_index, explanation')
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
          source: `${q.exam || ''}${q.topic ? ' • ' + q.topic : ''}${q.subtopic ? ' • ' + q.subtopic : ''}`,
          correct_answer: q.correct_index !== undefined ? String.fromCharCode(65 + q.correct_index) : undefined,
          explanation: q.explanation || undefined
        };
      }).filter((q): q is NonNullable<typeof q> => q !== null);

      if (!orderedQuestions.length) {
        throw new Error('No valid questions could be processed');
      }

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
      setTimeout(() => navigate('/exams/practice'), 2000);
    } finally {
      setLoading(false);
    }
  };

  const createAttempt = async () => {
    if (!sessionState) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: attempt, error } = await supabase
        .from('exam_attempts')
        .insert({
          user_id: user.id,
          source: 'reviewed_questions',
          mode: 'practice',
          total_questions: sessionState.ids.length,
          question_ids: sessionState.ids
        })
        .select('id')
        .single();

      if (error) throw error;
      setAttemptId(attempt.id);
    } catch (err) {
      console.error('Create attempt failed:', err);
    }
  };

  const handleAnswer = (questionId: string, selectedKey: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: selectedKey }));
    
    // Auto-show explanation after answering
    setTimeout(() => {
      setShowExplanations(prev => ({ ...prev, [questionId]: true }));
      saveAnswer(questionId, selectedKey);
    }, 500);
  };

  const saveAnswer = async (questionId: string, selectedKey: string) => {
    if (!attemptId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const question = questions.find(q => q.id === questionId);
      await supabase
        .from('exam_attempt_items')
        .upsert({
          attempt_id: attemptId,
          question_id: questionId,
          user_id: user.id,
          selected_key: selectedKey,
          correct_key: question?.correct_answer || '',
          topic: question?.topic || null,
          position: currentIndex + 1
        });
    } catch (err) {
      console.error('Save answer failed:', err);
    }
  };

  const nextQuestion = async () => {
    // Flush feedback before navigation
    if (currentQuestion && feedbackDirty[currentQuestion.id]) {
      if (savingRef.current[currentQuestion.id]) clearTimeout(savingRef.current[currentQuestion.id]!);
      await doSubmitFeedback(currentQuestion.id);
    }
    
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      navigate(`/exams/practice/session/${questions[nextIdx].id}`, { 
        state: sessionState,
        replace: true 
      });
    } else {
      // End of practice
      toast({
        title: 'Practice Complete!',
        description: 'Great job! You\'ve completed all questions.',
        duration: 3000
      });
      setTimeout(() => navigate('/exams/practice'), 2000);
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      navigate(`/exams/practice/session/${questions[prevIdx].id}`, { 
        state: sessionState,
        replace: true 
      });
    }
  };

  // Autosave helpers
  const buildFeedbackPayload = (questionId: string) => ({
    type: feedbackType[questionId] ?? null,
    tags: Array.from(issueTypes[questionId] ?? []),
    text: feedbackNotes[questionId] ?? '',
  });

  const syncMarkForReview = async (questionId: string) => {
    const type = feedbackType[questionId];
    const shouldFlag = type === 'improvement';
    try {
      if (shouldFlag) {
        setMarkedForReview(prev => new Set(prev).add(questionId));
      } else {
        setMarkedForReview(prev => {
          const next = new Set(prev);
          next.delete(questionId);
          return next;
        });
      }
    } catch (e) {
      console.warn('Mark for review sync failed:', e);
    }
  };

  const doSubmitFeedback = async (questionId: string) => {
    setFeedbackError(v => ({...v, [questionId]: null}));
    setFeedbackSaving(v => ({...v, [questionId]: true}));
    try {
      await submitFeedback(questionId);
      await syncMarkForReview(questionId);
      setFeedbackSaved(v => ({...v, [questionId]: true}));
      setFeedbackDirty(v => ({...v, [questionId]: false}));
    } catch (e: any) {
      setFeedbackError(v => ({...v, [questionId]: e?.message ?? 'Could not save'}));
    } finally {
      setFeedbackSaving(v => ({...v, [questionId]: false}));
    }
  };

  const queueSubmitFeedback = (questionId: string, delay = 400) => {
    setFeedbackDirty(v => ({...v, [questionId]: true}));
    if (savingRef.current[questionId]) clearTimeout(savingRef.current[questionId]!);
    savingRef.current[questionId] = setTimeout(() => { void doSubmitFeedback(questionId); }, delay);
  };

  const handleFeedbackTypeChange = (questionId: string, type: 'good' | 'improvement') => {
    setFeedbackType(prev => ({ ...prev, [questionId]: type }));
    if (type === 'good') {
      // Clear any improvement feedback when selecting "good"
      setIssueTypes(prev => ({ ...prev, [questionId]: [] }));
      setFeedbackNotes(prev => ({ ...prev, [questionId]: '' }));
    }
    queueSubmitFeedback(questionId, 300);
  };

  const handleToggleFeedbackTag = (questionId: string, tag: string) => {
    setIssueTypes(prev => ({
      ...prev,
      [questionId]: prev[questionId]?.includes(tag) 
        ? prev[questionId].filter(t => t !== tag)
        : [...(prev[questionId] || []), tag]
    }));
    queueSubmitFeedback(questionId, 350);
  };

  const handleFeedbackNotesChange = (questionId: string, notes: string) => {
    setFeedbackNotes(prev => ({ ...prev, [questionId]: notes }));
  };

  const submitFeedback = async (questionId: string) => {
    const type = feedbackType[questionId];
    if (!type) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let comment = '';
      if (type === 'good') {
        comment = 'Looks good';
      } else {
        const issues = issueTypes[questionId] || [];
        const notes = feedbackNotes[questionId] || '';
        comment = `[${issues.join(', ')}] ${notes}`.trim();
      }

      await supabase.from('exam_question_flags').insert({
        question_id: questionId,
        flagged_by: user.id,
        question_source: 'reviewed_questions',
        comment: comment
      });

      setFeedbackSubmitted(prev => ({ ...prev, [questionId]: true }));
      
    } catch (err) {
      console.error('Feedback submission failed:', err);
      toast({
        title: 'Feedback failed',
        description: 'Please try again later.',
        variant: 'destructive'
      });
    }
  };

  const answeredCount = Object.keys(answers).length;
  const markedCount = markedForReview.size;

  const navigateToQuestion = (questionIndex: number) => {
    if (questionIndex >= 0 && questionIndex < questions.length) {
      setCurrentIndex(questionIndex);
      navigate(`/exams/practice/session/${questions[questionIndex].id}`, { 
        state: sessionState,
        replace: true 
      });
    }
  };

  const handleMarkForReview = (questionId: string) => {
    setMarkedForReview(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const endPractice = () => {
    localStorage.removeItem(SESSION_KEY);
    // Show final summary
    const correctCount = questions.reduce((count, q) => {
      const userAnswer = answers[q.id];
      return count + (userAnswer === q.correct_answer ? 1 : 0);
    }, 0);
    
    toast({
      title: 'Practice Complete!',
      description: `Final Score: ${correctCount}/${questions.length} (${Math.round((correctCount/questions.length)*100)}%)`,
      duration: 5000
    });
    setTimeout(() => navigate('/exams/practice'), 2000);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardContent className="py-8 text-center">
            <div className="mb-3">Loading practice session...</div>
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
            <Button variant="outline" onClick={() => navigate('/exams/practice')}>
              Back to Practice Config
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 overflow-x-clip">
      {/* Unified header */}
      <Progress current={currentIndex + 1} total={questions.length} />
      <h1 className="mt-4 text-2xl font-semibold">{MODE_LABEL["practice"]}</h1>

      {/* Mobile question map drawer */}
      <div className="md:hidden mt-4">
        <Drawer open={showQuestionMap} onOpenChange={setShowQuestionMap}>
          <DrawerTrigger asChild>
            <Button variant="outline" size="sm">Open map & AI chat</Button>
          </DrawerTrigger>
          <DrawerContent className="p-4">
            <div className="space-y-4">
              <div className="text-sm font-medium">Jump to Question</div>
              <div className="grid grid-cols-8 gap-2">
                {questions.map((q, i) => {
                  const isCurrent = i === currentIndex;
                  const isAnswered = !!answers[q.id];
                  const isMarked = markedForReview.has(q.id);
                  const isCorrect = isAnswered && answers[q.id] === q.correct_answer;
                  
                  let buttonClass = "h-8 w-8 rounded text-sm flex items-center justify-center border ";
                  if (isCurrent) {
                    buttonClass += "bg-primary text-primary-foreground ring-2 ring-primary";
                  } else if (isAnswered) {
                    buttonClass += isCorrect ? "bg-success/10 border-success/20 text-success" : "bg-destructive/10 border-destructive/20 text-destructive";
                  } else {
                    buttonClass += "bg-muted border-muted-foreground/20";
                  }
                  
                  return (
                    <Button
                      key={q.id}
                      onClick={() => {
                        navigateToQuestion(i);
                        setShowQuestionMap(false);
                      }}
                      className={buttonClass}
                      variant="ghost"
                      size="sm"
                    >
                      {isMarked && <Flag className="h-3 w-3 text-warning absolute -top-1 -right-1" />}
                      {i + 1}
                    </Button>
                  );
                })}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      <div className="grid gap-6 lg:grid-cols-4 mt-6">
        <div className="lg:col-span-3">
          <Card>
        <CardContent className="space-y-4 w-full max-w-full break-words">
          {currentQuestion && (
            <>
                <QuestionCard
                  stem={currentQuestion.stem}
                  options={currentQuestion.options}
                  selectedKey={answers[currentQuestion.id] || ""}
                  onSelect={(key) => handleAnswer(currentQuestion.id, key)}
                  showExplanation={showExplanations[currentQuestion.id] || false}
                  explanation={currentQuestion.explanation}
                  correctKey={currentQuestion.correct_answer}
                  source={currentQuestion.source}
                  questionId={currentQuestion.id}
                  locked={showExplanations[currentQuestion.id] || false}
                  index={currentIndex}
                  total={questions.length}
                />

              {/* Feedback Card */}
              {showExplanations[currentQuestion.id] && (
                <Card className="min-w-0 w-full max-w-full mt-4">
                  <CardContent className="min-w-0 w-full max-w-full break-words p-4 sm:p-5">
                    <h3 className="font-semibold mb-2">Question Feedback</h3>

                    {/* Type buttons */}
                    <div className="flex flex-wrap gap-2 w-full min-w-0 mb-3">
                      <Button
                        variant={feedbackType[currentQuestion.id]==='good' ? 'default' : 'secondary'}
                        size="icon"
                        className="h-10 w-10 rounded-full"
                        aria-pressed={feedbackType[currentQuestion.id]==='good'}
                        aria-label="Looks good"
                        onClick={() => handleFeedbackTypeChange(currentQuestion.id, 'good')}
                      >
                        <span aria-hidden>👍</span>
                        <span className="sr-only">Looks good</span>
                      </Button>

                      <Button
                        variant={feedbackType[currentQuestion.id]==='improvement' ? 'default' : 'secondary'}
                        size="icon"
                        className="h-10 w-10 rounded-full"
                        aria-pressed={feedbackType[currentQuestion.id]==='improvement'}
                        aria-label="Needs improvement"
                        onClick={() => handleFeedbackTypeChange(currentQuestion.id, 'improvement')}
                      >
                        <span aria-hidden>👎</span>
                        <span className="sr-only">Needs improvement</span>
                      </Button>
                    </div>

                    {/* Improvement details */}
                    {feedbackType[currentQuestion.id] === 'improvement' && (
                      <div className="rounded-md border p-3 sm:p-4">
                        <p className="font-medium mb-2">What's the issue? (select all)</p>
                        <div className="flex flex-wrap gap-2 w-full min-w-0 mb-3">
                          {FEEDBACK_TAGS.map(tag => (
                            <Button key={tag} variant={issueTypes[currentQuestion.id]?.includes(tag) ? 'default' : 'secondary'}
                              className="min-w-0 text-sm px-3 py-2"
                              onClick={() => handleToggleFeedbackTag(currentQuestion.id, tag)}
                            >{tag}</Button>
                          ))}
                        </div>
                        <Textarea
                          value={feedbackNotes[currentQuestion.id] ?? ''}
                          onChange={(e) => handleFeedbackNotesChange(currentQuestion.id, e.target.value)}
                          onBlur={() => queueSubmitFeedback(currentQuestion.id, 600)}
                          placeholder="Add details (optional)…"
                          className="min-w-0 w-full"
                        />
                      </div>
                    )}

                    {/* Micro status */}
                    <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                      {feedbackSaving[currentQuestion.id] ? 'Saving…' : feedbackError[currentQuestion.id] ? `Error: ${feedbackError[currentQuestion.id]}` : feedbackSaved[currentQuestion.id] ? 'Saved' : ''}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Primary action placement - right under options */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="justify-self-start">
                  <Button
                    variant="outline"
                    onClick={prevQuestion}
                    disabled={currentIndex === 0}
                    className="min-w-0 text-sm sm:text-base"
                  >
                    Previous
                  </Button>
                </div>
                <div className="justify-self-end">
                  <Button
                    onClick={nextQuestion}
                    className="min-w-0 text-sm sm:text-base"
                  >
                    Next Question
                  </Button>
                </div>
              </div>

              {/* Secondary actions - below explanation/feedback */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between order-last md:order-none pt-4">
                <div className="flex flex-wrap items-center gap-2 gap-y-2 md:flex-nowrap">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/exams/practice')}
                    className="flex items-center gap-2 min-w-0 text-sm sm:text-base"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Config
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={endPractice}
                    className="text-warning min-w-0 text-sm sm:text-base"
                  >
                    End Practice
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
            onJump={navigateToQuestion}
            mode="practice"
            showGuru={SHOW_GURU["practice"]}
            examId={sessionState?.exam}
            questionId={currentQuestion?.id}
            kbId={currentQuestion?.topic}
          />
        </aside>
  </div>

      <FloatingSettings
        currentExam={'MRCEM Intermediate SBA' as const}
        currentCount={questions.length}
        currentTopic={sessionState?.topic || 'All areas'}
        currentDifficulty="medium"
        onUpdate={(settings) => {
          // Navigate back to practice config with new settings
          navigate('/exams/practice', { 
            state: settings,
            replace: false 
          });
        }}
      />
    </div>
  );
}