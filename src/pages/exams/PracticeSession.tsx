import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import QuestionCard from "@/components/exams/QuestionCard";
import { Progress } from "@/components/ui/progress";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import MarkForReviewButton from "@/components/exams/MarkForReviewButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { mapEnumToLabel } from "@/lib/exams";

const letters = ['A','B','C','D','E'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface FullQuestion {
  id: string;
  stem: string;
  options: string[];
  correct_index: number;
  explanation?: string | null;
  exam?: string | null;
  topic?: string | null;
}

type OptWithIdx = { key: string; text: string; origIndex: number };

export default function PracticeSession() {
  const navigate = useNavigate();
  const { id: attemptId } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [idx, setIdx] = useState(0);
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [q, setQ] = useState<FullQuestion | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [answers, setAnswers] = useState<{ id: string; selected: string; correct: string; topic?: string | null }[]>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dispOptions, setDispOptions] = useState<OptWithIdx[]>([]);
  const [selectionMap, setSelectionMap] = useState<Record<string, string>>({});
  const [ended, setEnded] = useState(false);
  const [attemptData, setAttemptData] = useState<any>(null);
  const loggedRef = useRef(false);

  useEffect(() => {
    document.title = "Practice Session • EM Gurus";
    loadPracticeSession();
  }, [attemptId]);

  useEffect(() => {
    if (!questionIds.length) return;
    void loadQuestion(questionIds[idx]);
  }, [idx, questionIds.join(',')]);

  useEffect(() => {
    if (!q) { setDispOptions([]); return; }
    const arr = (q.options || []).map((t, i) => ({ text: t, origIndex: i }));
    const shuffled = shuffle(arr);
    const mapped: OptWithIdx[] = shuffled.map((o, idx) => ({ key: letters[idx] || String(idx+1), text: o.text, origIndex: o.origIndex }));
    setDispOptions(mapped);
  }, [q?.id]);

  const loadPracticeSession = async () => {
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

      // Load and randomize questions based on attempt configuration
      await loadAndRandomizeQuestions(attempt);
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

  const loadAndRandomizeQuestions = async (attempt: any) => {
    try {
      const config = attempt.breakdown || {};
      const enumVal = config.exam_type;
      const examLabel = mapEnumToLabel?.(enumVal) ?? 'MRCEM Intermediate SBA';
      const topic = config.topic;
      const requestedCount = attempt.total_questions || 25;

      // Build query based on filters
      let query = supabase
        .from('reviewed_exam_questions')
        .select('id')
        .eq('status','approved')
        .eq('exam', examLabel);

      if (topic && topic !== 'All areas') {
        query = query.eq('topic', topic);
      }

      const { data: questions, error } = await query.limit(requestedCount * 3); // Get extra to allow for randomization

      if (error) throw error;
      
      if (!questions?.length) {
        setQuestionIds([]);
        return;
      }

      // Randomize and take requested count
      const shuffled = shuffle(questions.map(q => q.id));
      const selectedIds = shuffled.slice(0, Math.min(requestedCount, shuffled.length));
      setQuestionIds(selectedIds);

      // Update attempt with question_ids
      await supabase
        .from('exam_attempts')
        .update({ question_ids: selectedIds })
        .eq('id', attemptId);

    } catch (err: any) {
      console.error('Question load failed', err);
      setQuestionIds([]);
    }
  };

  async function loadQuestion(id: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reviewed_exam_questions')
        .select('id, stem, options, correct_index, explanation, exam, topic')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      setQ(data as FullQuestion);
      setSelected(selectionMap[id] || "");
    } finally { 
      setLoading(false); 
    }
  }

  const correctKey = useMemo(() => {
    if (!q || !dispOptions.length) return letters[0];
    const pos = dispOptions.findIndex(o => o.origIndex === (q.correct_index ?? 0));
    return letters[Math.max(0, pos)];
  }, [q, dispOptions]);

  const options = useMemo(() => dispOptions.map(({ key, text }) => ({ key, text })), [dispOptions]);

  function submitAnswer() {
    if (!q || !selected) return;
    const next = answers.filter(a => a.id !== q.id).concat([{ id: q.id, selected, correct: correctKey, topic: q.topic }]);
    setAnswers(next);
    if (idx < questionIds.length - 1) {
      setIdx(idx + 1);
    } else {
      // finished: show summary
      setReviewMode(false);
      setEnded(true);
    }
  }

  const handleSelect = (val: string) => {
    setSelected(val);
    if (q) setSelectionMap((m) => ({ ...m, [q.id]: val }));
  };

  const score = useMemo(() => answers.reduce((acc, a) => acc + (a.selected === a.correct ? 1 : 0), 0), [answers]);
  const byTopic = useMemo(() => {
    const map: Record<string, { total: number; correct: number }> = {};
    answers.forEach(a => {
      const key = a.topic || 'General';
      map[key] = map[key] || { total: 0, correct: 0 };
      map[key].total += 1;
      if (a.selected === a.correct) map[key].correct += 1;
    });
    return map;
  }, [answers]);

  const finished = answers.length === questionIds.length;
  const answeredCount = useMemo(() => questionIds.filter((qid) => !!selectionMap[qid]).length, [questionIds, selectionMap]);
  const showSummary = ended || finished;

  // Log attempt when session ends
  useEffect(() => {
    if (!showSummary || loggedRef.current) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const duration = Math.floor((Date.now() - (attemptData?.started_at ? new Date(attemptData.started_at).getTime() : Date.now())) / 1000);
        
        // Update attempt with results
        await supabase
          .from('exam_attempts')
          .update({
            correct_count: score,
            total_attempted: answers.length,
            finished_at: new Date().toISOString(),
            duration_sec: duration,
            breakdown: byTopic,
          })
          .eq('id', attemptId);

        // Insert attempt items
        const items = answers.map((a, i) => ({
          attempt_id: attemptId,
          user_id: user.id,
          question_id: a.id,
          selected_key: a.selected,
          correct_key: a.correct,
          topic: a.topic || null,
          position: i + 1,
        }));
        
        if (items.length > 0) {
          await supabase.from('exam_attempt_items').insert(items);
        }

        loggedRef.current = true;
      } catch (e) {
        console.warn('Attempt logging failed', e);
      }
    })();
  }, [showSummary, score, answers, attemptId, byTopic, attemptData]);

  if (!questionIds.length && !loading) {
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

  if (loading) {
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

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mx-auto w-full md:max-w-5xl">
        {!showSummary ? (
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Practice Mode</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {q && (
                    <QuestionCard
                      key={q.id}
                      questionId={q.id}
                      stem={q.stem}
                      options={options}
                      selectedKey={selected}
                      onSelect={handleSelect}
                      showExplanation={false}
                      explanation={undefined}
                      source={`${q.exam || ''}${q.topic ? ' • ' + q.topic : ''}`}
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <Button variant="outline" onClick={() => navigate('/exams/practice')}>Back to Config</Button>
                    <div className="flex items-center gap-2">
                      <div className="md:hidden">
                        <Drawer>
                          <DrawerTrigger asChild>
                            <Button variant="outline" size="sm">Practice Tools</Button>
                          </DrawerTrigger>
                          <DrawerContent className="p-4 space-y-4">
                            <div>
                              <div className="text-sm font-medium mb-2">Progress</div>
                              <div className="text-sm mb-2">Question {idx + 1} of {questionIds.length}</div>
                              <Progress value={(answeredCount / questionIds.length) * 100} />
                            </div>
                            <div>
                              <div className="text-sm font-medium mb-2">Question Map</div>
                              <div className="grid grid-cols-8 gap-2">
                                {questionIds.map((qid, i) => {
                                  const isCurrent = i === idx;
                                  const entry = answers.find(a => a.id === qid);
                                  const hasSel = !!entry;
                                  const correct = hasSel && entry!.selected === entry!.correct;
                                  const base = "h-8 w-8 rounded text-sm flex items-center justify-center border";
                                  const state = isCurrent
                                    ? "bg-primary/10 ring-1 ring-primary"
                                    : hasSel
                                      ? (correct ? "bg-success/20 border-success text-success" : "bg-destructive/10 border-destructive text-destructive")
                                      : "bg-muted";
                                  return (
                                    <button
                                      key={qid}
                                      onClick={() => setIdx(i)}
                                      aria-label={`Go to question ${i+1}`}
                                      className={`${base} ${state} hover:bg-accent/10`}
                                    >
                                      {i+1}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </DrawerContent>
                        </Drawer>
                      </div>
                      <Button onClick={submitAnswer} disabled={!selected || loading}>
                        {idx < questionIds.length - 1 ? 'Next' : 'Finish'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <aside className="hidden md:block">
              <div className="sticky top-20 space-y-4">
                <Card>
                  <CardContent className="py-4">
                    <div className="text-sm font-medium mb-1">Progress</div>
                    <div className="text-sm mb-2">Question {idx + 1} of {questionIds.length}</div>
                    <Progress value={(answeredCount / questionIds.length) * 100} />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="text-sm font-medium mb-2">Question Map</div>
                    <div className="grid grid-cols-5 gap-2">
                      {questionIds.map((qid, i) => {
                        const isCurrent = i === idx;
                        const entry = answers.find(a => a.id === qid);
                        const hasSel = !!entry;
                        const correct = hasSel && entry!.selected === entry!.correct;
                        const base = "h-8 w-8 rounded text-sm flex items-center justify-center border";
                        const state = isCurrent
                          ? "bg-primary/10 ring-1 ring-primary"
                          : hasSel
                            ? (correct ? "bg-success/20 border-success text-success" : "bg-destructive/10 border-destructive text-destructive")
                            : "bg-muted";
                        return (
                          <button
                            key={qid}
                            onClick={() => setIdx(i)}
                            aria-label={`Go to question ${i+1}`}
                            className={`${base} ${state} hover:bg-accent/10`}
                          >
                            {i+1}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </aside>
          </div>
        ) : !reviewMode ? (
          <Card>
            <CardHeader>
              <CardTitle>Practice Complete!</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="text-lg font-semibold">Score: {score} / {answers.length}</div>
              <div className="text-sm text-muted-foreground">Attempts: {answers.length} / {questionIds.length}</div>
              <div className="grid gap-2">
                {Object.entries(byTopic).map(([t, v]) => (
                  <div key={t} className="text-sm">{t}: {v.correct}/{v.total}</div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => navigate('/exams/practice')}>Back to Practice</Button>
                <Button onClick={() => setReviewMode(true)}>Review Answers</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Review Answers</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {q && (
                <QuestionCard
                  key={q.id + '-review'}
                  questionId={q.id}
                  stem={q.stem}
                  options={options}
                  selectedKey={answers.find(a=>a.id===q.id)?.selected || ''}
                  onSelect={()=>{}}
                  showExplanation={true}
                  explanation={q.explanation || ''}
                  source={`${q.exam || ''}${q.topic ? ' • ' + q.topic : ''}`}
                  correctKey={correctKey}
                />
              )}
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setReviewMode(false)}>Summary</Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setIdx(Math.max(0, idx-1))} disabled={idx===0}>Previous</Button>
                  <Button onClick={() => setIdx(Math.min(questionIds.length-1, idx+1))} disabled={idx===questionIds.length-1}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}