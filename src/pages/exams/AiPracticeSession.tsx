import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import QuestionCard from "@/components/exams/QuestionCard";
import FloatingSettings from "@/components/exams/FloatingSettings";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExamName } from "@/lib/curricula";

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
          exam_type: exam, 
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
            source: 'ai_practice',
            mode: 'practice',
            total_questions: total,
            question_ids: [questionUuid] // Use proper UUID
          })
          .select('id')
          .single();
        
        if (attemptError) throw attemptError;
        setAttemptId(attempt.id);
        toast({ title: 'Attempt saved', description: 'Your practice session has been logged.' });
      }
      
      // Store AI question in ai_exam_questions for proper tracking
      try {
        // Create AI exam session if needed
        let sessionId = '';
        const { data: session, error: sessionError } = await supabase
          .from('ai_exam_sessions')
          .insert({
            user_id: user.id,
            exam_type: exam.replace(/\s+/g, '_').replace(/\+/g, '_').toUpperCase() as any
          })
          .select('id')
          .single();
          
        if (sessionError) throw sessionError;
        sessionId = session.id;

        // Insert AI question with proper structure
        await supabase
          .from('ai_exam_questions')
          .insert({
            id: questionUuid,
            session_id: sessionId,
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

  function updateSettings(newSettings: { exam: ExamName; count: number; topic: string; difficulty: string }) {
    setCurrentSettings(newSettings);
    // Update search params without navigation
    const params = new URLSearchParams(window.location.search);
    params.set('exam', newSettings.exam);
    params.set('count', String(newSettings.count));
    if (newSettings.topic !== 'All areas') {
      params.set('topic', newSettings.topic);
    } else {
      params.delete('topic');
    }
    params.set('difficulty', newSettings.difficulty);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }

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

  function showFinalScore() {
    if (!attemptId) {
      navigate('/exams');
      return;
    }
    
    // Get final stats
    supabase
      .from('exam_attempt_items')
      .select('selected_key, correct_key')
      .eq('attempt_id', attemptId)
      .then(({ data }) => {
        const correctCount = data?.filter(item => 
          item.selected_key?.toUpperCase() === item.correct_key?.toUpperCase()
        ).length || 0;
        
        const percentage = Math.round((correctCount / total) * 100);
        
        toast({
          title: 'Session Complete!',
          description: `You scored ${correctCount}/${total} (${percentage}%)`,
          duration: 5000
        });
        
        // Update final attempt record
        supabase
          .from('exam_attempts')
          .update({ finished_at: new Date().toISOString() })
          .eq('id', attemptId)
          .then(() => {
            setTimeout(() => navigate('/dashboard/exams/attempts'), 2000);
          });
      });
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
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Practice: Question {idx + 1} of {total}</CardTitle>
          <div className="text-sm text-muted-foreground">{exam} • {topic || 'All topics'} • {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <div className="font-medium">Error: {error}</div>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => generate(idx)}>
                Retry
              </Button>
            </div>
          )}
          
          {q && (
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
              />
              {show && (
                <div className="mt-4 p-3 border rounded-md bg-muted/30">
                  <div className="font-medium mb-2">Feedback on this AI question:</div>
                  <div className="flex gap-2 flex-wrap">
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
            </>
          )}
          
          {!q && !error && (
            <div className="text-sm text-muted-foreground">{loading ? 'Generating question…' : 'No question yet.'}</div>
          )}
          
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate('/exams/ai-practice')}>Edit selection</Button>
              {error && (
                <Button variant="ghost" onClick={() => generate(idx)} disabled={loading}>Retry</Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={prev} disabled={idx === 0}>Previous</Button>
              {!show ? (
                <Button onClick={submit} disabled={!q || !selected || loading}>Submit</Button>
              ) : (
                <Button onClick={next}>{idx < total - 1 ? 'Next' : 'Finish'}</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <FloatingSettings
        currentExam={currentSettings.exam}
        currentCount={currentSettings.count}
        currentTopic={currentSettings.topic}
        currentDifficulty={currentSettings.difficulty}
        onUpdate={updateSettings}
      />
    </div>
  );
}
