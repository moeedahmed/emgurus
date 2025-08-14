import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import QuestionCard from "@/components/exams/QuestionCard";
import StickyOptionsBar from "@/components/exams/StickyOptionsBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EXAMS, ExamName } from "@/lib/curricula";
import { mapLabelToEnum } from "@/lib/exams";
import { recordNotification } from "@/components/ui/ToastOrNotice";

interface GeneratedQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string; E?: string };
  correct: string;
  explanation: string;
  reference?: string;
  topic?: string;
  subtopic?: string;
}

export default function AiPracticeSession() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { toast } = useToast();

  // Get session ID from URL params
  const sessionId = window.location.pathname.split('/').pop();
  const exam = search.get("exam");
  const topic = search.get("topic");
  const difficulty = search.get("difficulty") || "medium";
  const total = useMemo(() => {
    const n = Number(search.get("count") || 10);
    return Math.max(1, Math.min(100, isNaN(n) ? 10 : n));
  }, [search]);

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string>("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [questions, setQuestions] = useState<(GeneratedQuestion | null)[]>([]);
  const [attemptId, setAttemptId] = useState<string>("");
  const [storedQuestions, setStoredQuestions] = useState<{ [key: number]: string }>({});
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [currentSettings, setCurrentSettings] = useState({
    exam: exam as ExamName,
    count: total,
    topic: topic || "All areas",
    difficulty
  });

  useEffect(() => {
    document.title = "AI Practice Session • EM Gurus";
  }, []);

  // Check auth and redirect if missing required params
  useEffect(() => {
    const checkAuth = async () => {
      if (!exam) {
        navigate('/exams/ai-practice');
        return;
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate(`/auth?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      
      // Generate first question on mount
      if (!questions[0]) void generate(0);
    };
    
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam]);

  const q = questions[idx] || null;

  async function generate(index: number) {
    if (!exam) return;
    
    try {
      setLoading(true);
      setError("");
      const { data, error: apiError } = await supabase.functions.invoke('ai-exams-api', {
        body: { 
          action: 'practice_generate', 
          exam_type: mapLabelToEnum(exam), 
          topic: topic || undefined,
          difficulty,
          count: 1
        }
      });
      
      if (apiError) throw apiError;
      
      const items = data?.items || [];
      if (!items[0]) throw new Error('No question generated');
      
      const saved = items[0];
      setQuestions((prev) => {
        const next = prev.slice();
        next[index] = saved;
        return next;
      });
      setSelected("");
      setShow(false);
    } catch (err: any) {
      console.error('Generate question failed', err);
      const errorMsg = err?.message || String(err);
      setError(errorMsg);
      toast({
        title: 'AI Generation failed',
        description: errorMsg,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!q || !selected) return;
    
    try {
      setLoading(true);
      
      // Generate a proper UUID for this AI question
      const questionUuid = crypto.randomUUID();
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('User not authenticated');
      
      // Create exam attempt if not exists
      if (!attemptId) {
        const { data: attempt, error: attemptError } = await supabase
          .from('exam_attempts')
          .insert({
            user_id: user.id,
            source: 'ai',
            mode: 'practice',
            total_questions: total,
            question_ids: [questionUuid], // Use proper UUID
            breakdown: {
              exam_type: mapLabelToEnum(exam),
              topic: topic,
              difficulty: difficulty
            }
          })
          .select('id')
          .single();
        
        if (attemptError) throw attemptError;
        setAttemptId(attempt.id);
        toast({ title: 'Attempt saved', description: 'Your practice session has been logged.' });
      }
      
      // Store AI question in ai_exam_questions for proper tracking
      try {
        // Use existing session ID from URL
        const currentSessionId = window.location.pathname.split('/').pop();
        if (!currentSessionId) throw new Error('No session ID found');

        // Insert AI question with proper structure
        await supabase
          .from('ai_exam_questions')
          .insert({
            id: questionUuid,
            session_id: currentSessionId,
            question: q.question,
            options: q.options,
            correct_answer: q.correct,
            explanation: q.explanation,
            topic: q.topic || topic || 'General',
            subtopic: q.subtopic
          });
          
        // Store question ID for later reference
        setStoredQuestions(prev => ({ ...prev, [idx]: questionUuid }));
      } catch (questionInsertError) {
        console.warn('Failed to insert AI question:', questionInsertError);
        // Continue anyway - we'll use a simpler approach
      }

      // Log attempt item with proper UUID
      const isCorrect = selected.toUpperCase() === q.correct.toUpperCase();
      await supabase
        .from('exam_attempt_items')
        .insert({
          attempt_id: attemptId,
          question_id: questionUuid,
          user_id: user.id,
          selected_key: selected,
          correct_key: q.correct,
          topic: q.topic || topic || 'General',
          position: idx + 1
        });

      // Update attempt with current progress
      const { data: attemptItems } = await supabase
        .from('exam_attempt_items')
        .select('selected_key, correct_key')
        .eq('attempt_id', attemptId);
      
      const correctCount = attemptItems?.filter(item => 
        item.selected_key?.toUpperCase() === item.correct_key?.toUpperCase()
      ).length || 0;
      
      await supabase
        .from('exam_attempts')
        .update({
          total_attempted: idx + 1,
          correct_count: correctCount,
          duration_sec: Math.floor((Date.now() - Date.now()) / 1000), // Simple duration for now
          question_ids: [...(attemptItems?.map(() => questionUuid) || []), questionUuid]
        })
        .eq('id', attemptId);
      
      setShow(true);
    } catch (err: any) {
      console.error('Submit failed', err);
      toast({ title: 'Submit failed', description: String(err?.message || err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const updateSettings = (newExam: string, newTopic: string, newDifficulty: string, newCount: number) => {
    const hasChanges = newExam !== exam || newTopic !== (topic || "All areas") || newDifficulty !== difficulty || newCount !== total;
    
    if (hasChanges && confirm("Changing settings will generate a new question. Continue?")) {
      const params = new URLSearchParams();
      params.set('exam', newExam);
      params.set('count', String(newCount));
      if (newTopic !== 'All areas') params.set('topic', newTopic);
      params.set('difficulty', newDifficulty);
      
      window.history.replaceState({}, '', `/exams/ai-practice/session/${sessionId}?${params.toString()}`);
      setCurrentSettings({ exam: newExam as ExamName, count: newCount, topic: newTopic, difficulty: newDifficulty });
      setSelected("");
      generate(idx);
    }
  };

  const handleEditSelection = () => {
    navigate('/exams/ai-practice?' + search.toString());
  };

  const handleEndEarly = () => {
    setShowEndDialog(true);
  };

  const confirmEndEarly = async () => {
    setShowEndDialog(false);
    
    // Get current score for early end
    try {
      const { data } = await supabase
        .from('exam_attempt_items')
        .select('selected_key, correct_key')
        .eq('attempt_id', attemptId);
      
      const correctCount = data?.filter(item => 
        item.selected_key?.toUpperCase() === item.correct_key?.toUpperCase()
      ).length || 0;
      
      const answeredCount = data?.length || 0;
      const scoreText = `${correctCount}/${answeredCount}`;
      
      toast({
        title: 'Session Complete!',
        description: `You scored ${scoreText} correct`,
        duration: 5000
      });
      
      const user = (await supabase.auth.getUser()).data.user;
      await recordNotification(user?.id, 'AI Practice complete', `You scored ${scoreText}`, '/dashboard?view=exams&tab=attempts');
      
      // Update attempt as finished
      await supabase
        .from('exam_attempts')
        .update({ finished_at: new Date().toISOString() })
        .eq('id', attemptId);
        
    } catch (err) {
      console.error('Error getting final score:', err);
      toast({
        title: 'Session Complete!',
        description: 'Practice session ended early.',
        duration: 3000
      });
    }
    
    // Navigate safely - no 404
    navigate('/exams/ai-practice', { replace: true });
  };

  async function submitFeedback(feedbackType: string) {
    try {
      const questionId = storedQuestions[idx];
      if (!questionId) return;
      
      await supabase
        .from('ai_exam_answers')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          question_id: questionId,
          selected_answer: selected,
          is_correct: selected.toUpperCase() === q?.correct.toUpperCase(),
          feedback: feedbackType as any
        });
        
      toast({
        title: 'Feedback submitted',
        description: 'Thank you for your feedback!',
      });
    } catch (err) {
      console.error('Feedback submission failed:', err);
    }
  }

  function next() {
    if (idx < total - 1) {
      const nextIdx = idx + 1;
      setIdx(nextIdx);
      setSelected("");
      setShow(false);
      if (!questions[nextIdx]) void generate(nextIdx);
    } else {
      // Show final score before navigating
      showFinalScore();
    }
  }

  async function showFinalScore() {
    if (!attemptId) {
      navigate('/exams');
      return;
    }
    
    try {
      // Get final stats
      const { data } = await supabase
        .from('exam_attempt_items')
        .select('selected_key, correct_key')
        .eq('attempt_id', attemptId);
        
      const correctCount = data?.filter(item => 
        item.selected_key?.toUpperCase() === item.correct_key?.toUpperCase()
      ).length || 0;
      
      const percentage = Math.round((correctCount / total) * 100);
      const scoreText = `${correctCount}/${total}`;
      
      toast({
        title: 'Session Complete!',
        description: `You scored ${scoreText} (${percentage}%)`,
        duration: 5000
      });
      
      const user = (await supabase.auth.getUser()).data.user;
      await recordNotification(user?.id, 'AI Practice complete', `You scored ${scoreText}`, '/dashboard?view=exams&tab=attempts');
      
      // Update final attempt record
      await supabase
        .from('exam_attempts')
        .update({ finished_at: new Date().toISOString() })
        .eq('id', attemptId);
        
      setTimeout(() => navigate('/exams/ai-practice', { replace: true }), 2000);
    } catch (err) {
      console.error('Error showing final score:', err);
      navigate('/exams/ai-practice', { replace: true });
    }
  }

  function prev() {
    if (idx > 0) {
      setIdx(idx - 1);
      setSelected("");
      setShow(false);
    }
  }

  if (!exam) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardContent className="py-8 text-center">
            <div className="mb-3 font-medium">Missing configuration</div>
            <Button variant="outline" onClick={() => navigate('/exams/ai-practice')}>Back to setup</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Options Bar */}
      {exam && EXAMS.includes(exam as ExamName) && (
        <StickyOptionsBar
          currentExam={exam}
          currentTopic={topic || "All areas"}
          currentDifficulty={difficulty}
          currentCount={total}
          questionIndex={idx}
          totalQuestions={total}
          onUpdate={updateSettings}
          onEditSelection={handleEditSelection}
        />
      )}

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {!exam || !EXAMS.includes(exam as ExamName) ? (
          <Card>
            <CardContent className="py-8 text-center">
              <h2 className="text-xl font-semibold mb-4">Missing Configuration</h2>
              <p className="text-muted-foreground mb-4">
                Essential exam configuration is missing. Please go back and select your exam settings.
              </p>
              <Button onClick={() => navigate('/exams/ai-practice')}>
                Configure Settings
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {error && (
              <Card className="border-destructive">
                <CardContent className="py-4">
                  <p className="text-destructive">{error}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2" 
                    onClick={() => { setError(""); generate(idx); }}
                  >
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )}

            {q ? (
              <>
                <div className="p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm mb-4">
                  <div className="font-medium mb-1">⚠️ AI Generated Content - Experimental</div>
                  <div>This content is AI-generated and may not always be accurate. Please exercise your judgment and provide feedback if you notice any issues.</div>
                </div>
                
                <QuestionCard
                  stem={q.question}
                  options={Object.entries(q.options).map(([key, text]) => ({ key, text }))}
                  selectedKey={selected}
                  onSelect={setSelected}
                  showExplanation={show}
                  explanation={q.explanation}
                  source={q.reference}
                  correctKey={q.correct}
                  questionId={`ai-${idx}`}
                />

                <Card>
                  <CardContent className="py-4">
                    {/* Mobile-friendly action buttons */}
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                      {/* Left row */}
                      <div className="col-span-2 sm:col-auto flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleEditSelection}
                        >
                          Edit Selection
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={handleEndEarly}
                        >
                          End Early
                        </Button>
                      </div>
                      {/* Right row */}
                      <div className="col-span-2 sm:ml-auto flex gap-2 justify-end">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={idx === 0} 
                          onClick={prev}
                        >
                          Previous
                        </Button>
                        {!show ? (
                          <Button 
                            onClick={submit} 
                            disabled={!q || !selected || loading}
                            size="sm"
                          >
                            {loading ? 'Submitting…' : 'Submit'}
                          </Button>
                        ) : (
                          <Button onClick={next} size="sm">
                            {idx < total - 1 ? 'Next' : 'Finish'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {show && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-3">
                          Was this AI-generated question helpful?
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => submitFeedback('accurate')}>
                            👍 Accurate
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => submitFeedback('inaccurate')}>
                            👎 Inaccurate
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => submitFeedback('too_easy')}>
                            😴 Too Easy
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => submitFeedback('too_hard')}>
                            🤯 Too Hard
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => submitFeedback('irrelevant')}>
                            🚫 Irrelevant
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : loading ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Generating question {idx + 1} of {total}...</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <h2 className="text-xl font-semibold mb-4">Ready to Start</h2>
                  <p className="text-muted-foreground mb-4">
                    Click "Generate" to create your first AI question.
                  </p>
                  <Button onClick={() => generate(0)} disabled={loading}>
                    Generate Question
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        
        {/* End Early Confirmation Dialog */}
        <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>End Practice Session Early?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>You're currently on question {idx + 1} of {total}. Are you sure you want to end your practice session now?</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowEndDialog(false)}>
                  Continue Practice
                </Button>
                <Button variant="destructive" onClick={confirmEndEarly}>
                  End Session
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
