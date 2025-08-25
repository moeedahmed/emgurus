import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { BookOpen, ArrowLeft, ArrowRight, Settings, Flag } from "lucide-react";
import QuestionCard from "@/components/exams/QuestionCard";
import QuestionChat from "@/components/exams/QuestionChat";
import MarkForReviewButton from "@/components/exams/MarkForReviewButton";
import FloatingSettings from "@/components/exams/FloatingSettings";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRoles } from "@/hooks/useRoles";
import { useAuth } from "@/contexts/AuthContext";

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
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [showQuestionMap, setShowQuestionMap] = useState(false);
  const SESSION_KEY = 'emgurus.practice.session';

  useEffect(() => {
    document.title = "Practice Session • EM Gurus";
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

  const nextQuestion = () => {
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

  const handleFeedbackTypeChange = (questionId: string, type: 'good' | 'improvement') => {
    setFeedbackType(prev => ({ ...prev, [questionId]: type }));
    if (type === 'good') {
      // Clear any improvement feedback when selecting "good"
      setIssueTypes(prev => ({ ...prev, [questionId]: [] }));
      setFeedbackNotes(prev => ({ ...prev, [questionId]: '' }));
    }
  };

  const handleToggleFeedbackTag = (questionId: string, tag: string) => {
    setIssueTypes(prev => ({
      ...prev,
      [questionId]: prev[questionId]?.includes(tag) 
        ? prev[questionId].filter(t => t !== tag)
        : [...(prev[questionId] || []), tag]
    }));
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
      
      toast({
        title: 'Feedback submitted',
        description: 'Thank you for helping us improve!',
      });
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
    <div className="container mx-auto px-4 py-6">
      {/* Mobile progress at top */}
      <div className="md:hidden sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border mb-4">
        <div className="px-1 py-2">
          <div className="text-xs text-muted-foreground mb-1">
            Question {currentIndex + 1} of {questions.length} • {currentQuestion?.exam}
            {currentQuestion?.topic && ` • ${currentQuestion.topic}`}
          </div>
          <Progress value={((currentIndex + 1) / questions.length) * 100} />
        </div>
      </div>

      {/* Desktop sticky header with progress */}
      <div className="hidden md:block sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-6 -mx-4 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Practice Session
            </h1>
            <div className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {questions.length} • {currentQuestion?.exam}
              {currentQuestion?.topic && ` • ${currentQuestion.topic}`}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Progress</div>
              <div className="text-lg font-semibold">
                {answeredCount}/{questions.length}
              </div>
            </div>
            {markedCount > 0 && (
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Marked</div>
                <div className="text-lg font-semibold text-warning">
                  {markedCount}
                </div>
              </div>
            )}
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
            <div className="md:hidden">
              <Drawer open={showQuestionMap} onOpenChange={setShowQuestionMap}>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm">Question Map</Button>
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
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Question {currentIndex + 1} of {questions.length}</span>
                <div className="flex items-center gap-2">
                  {markedCount > 0 && (
                    <Badge variant="outline" className="text-warning">
                      <Flag className="h-3 w-3 mr-1" />
                      {markedCount} marked
                    </Badge>
                  )}
                  <Badge variant="secondary">Untimed</Badge>
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
                onSelect={(key) => handleAnswer(currentQuestion.id, key)}
                showExplanation={showExplanations[currentQuestion.id] || false}
                explanation={currentQuestion.explanation}
                correctKey={currentQuestion.correct_answer}
                source={currentQuestion.source}
                questionId={currentQuestion.id}
              />

              {/* Feedback Card */}
              {showExplanations[currentQuestion.id] && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-base">Question Feedback</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!feedbackSubmitted[currentQuestion.id] ? (
                      <>
                        <div className="mb-4">
                          <div className="flex gap-3 mb-3">
                            <Button
                              variant={feedbackType[currentQuestion.id] === 'good' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handleFeedbackTypeChange(currentQuestion.id, 'good')}
                            >
                              👍 Looks good
                            </Button>
                            <Button
                              variant={feedbackType[currentQuestion.id] === 'improvement' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handleFeedbackTypeChange(currentQuestion.id, 'improvement')}
                            >
                              👎 Needs improvement
                            </Button>
                          </div>

                          {feedbackType[currentQuestion.id] === 'improvement' && (
                            <div className="space-y-3">
                              <div>
                                <Label className="text-sm font-medium">What's the issue? (select all that apply)</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {FEEDBACK_TAGS.map(tag => (
                                    <Button
                                      key={tag}
                                      variant={issueTypes[currentQuestion.id]?.includes(tag) ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => handleToggleFeedbackTag(currentQuestion.id, tag)}
                                    >
                                      {tag}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <Label htmlFor={`feedback-notes-${currentQuestion.id}`} className="text-sm">Additional details (optional)</Label>
                                <Textarea
                                  id={`feedback-notes-${currentQuestion.id}`}
                                  value={feedbackNotes[currentQuestion.id] || ''}
                                  onChange={(e) => handleFeedbackNotesChange(currentQuestion.id, e.target.value)}
                                  placeholder="Describe the issue in more detail..."
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          )}

                          {feedbackType[currentQuestion.id] && (
                            <div className="mt-3">
                              <Button
                                size="sm"
                                onClick={() => submitFeedback(currentQuestion.id)}
                                disabled={feedbackType[currentQuestion.id] === 'improvement' && (!issueTypes[currentQuestion.id]?.length)}
                              >
                                Submit Feedback
                              </Button>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        ✅ Feedback submitted. Thank you for helping us improve!
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2">
                  <MarkForReviewButton
                    currentQuestionId={currentQuestion.id}
                    source="reviewed"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/exams/practice')}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Config
                  </Button>
                  <Button 
                    variant="outline" 
                  onClick={endPractice}
                  className="text-warning"
                  >
                    End Practice
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={prevQuestion}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    onClick={nextQuestion}
                    className="flex items-center gap-2"
                  >
                    {currentIndex < questions.length - 1 ? (
                      <>
                        Next
                        <ArrowRight className="h-4 w-4" />
                      </>
                    ) : (
                      'Finish Practice'
                    )}
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
      <div className="sticky top-20 space-y-4">
        <Card>
          <CardContent className="py-4">
            <div className="text-sm font-medium mb-2">Question Map</div>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, i) => {
                const isCurrent = i === currentIndex;
                const isAnswered = !!answers[q.id];
                const isMarked = markedForReview.has(q.id);
                const isCorrect = isAnswered && answers[q.id] === q.correct_answer;
                
                let buttonClass = "h-8 w-8 rounded text-sm flex items-center justify-center border relative ";
                if (isCurrent) {
                  buttonClass += "bg-primary text-primary-foreground ring-2 ring-primary";
                } else if (isAnswered) {
                  buttonClass += isCorrect ? "bg-success/10 border-success/20 text-success" : "bg-destructive/10 border-destructive/20 text-destructive";
                } else {
                  buttonClass += "bg-muted border-muted-foreground/20 hover:bg-accent";
                }
                
                return (
                  <Button
                    key={q.id}
                    onClick={() => navigateToQuestion(i)}
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
          </CardContent>
        </Card>
      </div>
    </aside>
  </div>

      <FloatingSettings
        currentSettings={{
          exam: 'MRCEM Intermediate SBA' as const,
          count: questions.length,
          topic_id: '',
          difficulty: 'medium'
        }}
        onSettingsChange={(settings) => {
          // Navigate back to practice config with new settings
          navigate('/exams/practice', { 
            state: { exam: settings.exam, count: settings.count, topic: 'All areas', difficulty: settings.difficulty },
            replace: false 
          });
        }}
      />
    </div>
  );
}