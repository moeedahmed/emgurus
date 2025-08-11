import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import QuestionCard from "@/components/exams/QuestionCard";
import { Progress } from "@/components/ui/progress";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";

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

export default function ReviewedExamSession() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const ids: string[] = Array.isArray(location?.state?.ids) ? location.state.ids : [];

  const [idx, setIdx] = useState(0);
  const [order, setOrder] = useState<string[]>([]);
  const [q, setQ] = useState<FullQuestion | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [answers, setAnswers] = useState<{ id: string; selected: string; correct: string; topic?: string | null }[]>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dispOptions, setDispOptions] = useState<OptWithIdx[]>([]);
  const [selectionMap, setSelectionMap] = useState<Record<string, string>>({});
  const [timeSec, setTimeSec] = useState(0);
  const limitSec = typeof location?.state?.limitSec === 'number' ? location.state.limitSec as number : undefined;
  const [timeUp, setTimeUp] = useState(false);
  const startedAtRef = useRef<number>(Date.now());
  const [ended, setEnded] = useState(false);
  const loggedRef = useRef(false);

  useEffect(() => {
    document.title = "Exam Mode • Reviewed Bank";
  }, []);

  useEffect(() => {
    if (!ids.length) return;
    // Initialize a fresh random order for this session
    setOrder(shuffle(ids));
    setIdx(0);
  }, [ids.join(',')]);

  useEffect(() => {
    if (!order.length) return;
    void load(order[idx]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, order.join(',')]);

  async function load(id: string) {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('reviewed_exam_questions')
        .select('id, stem, options, correct_index, explanation, exam, topic')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      setQ(data as FullQuestion);
      setSelected(selectionMap[id] || "");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!q) { setDispOptions([]); return; }
    const arr = (q.options || []).map((t, i) => ({ text: t, origIndex: i }));
    const shuffled = shuffle(arr);
    const mapped: OptWithIdx[] = shuffled.map((o, idx) => ({ key: letters[idx] || String(idx+1), text: o.text, origIndex: o.origIndex }));
    setDispOptions(mapped);
  }, [q?.id]);

  const correctKey = useMemo(() => {
    if (!q || !dispOptions.length) return letters[0];
    const pos = dispOptions.findIndex(o => o.origIndex === (q.correct_index ?? 0));
    return letters[Math.max(0, pos)];
  }, [q, dispOptions]);

  const options = useMemo(() => dispOptions.map(({ key, text }) => ({ key, text })), [dispOptions]);

  function submit() {
    if (!q || !selected) return;
    const next = answers.filter(a => a.id !== q.id).concat([{ id: q.id, selected, correct: correctKey, topic: q.topic }]);
    setAnswers(next);
    if (idx < order.length - 1) {
      setIdx(idx + 1);
    } else {
      // finished or early end: show summary
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

  if (!ids.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No selection. Go back to Reviewed Bank and pick a list.</CardContent>
        </Card>
      </div>
    );
  }

  const finished = answers.length === order.length;
  const answeredCount = useMemo(() => order.filter((qid) => !!selectionMap[qid]).length, [order, selectionMap]);

  // Timer: count up by default; if limit provided, count down and stop at 0
  const formatMMSS = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  useEffect(() => {
    const id = window.setInterval(() => {
      setTimeSec((t) => {
        const next = t + 1;
        if (limitSec && next >= limitSec) {
          setTimeUp(true);
          return limitSec;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [limitSec]);

  const timeDisplay = limitSec ? formatMMSS(Math.max(0, (limitSec - timeSec))) : formatMMSS(timeSec);
  const showSummary = ended || finished || timeUp;

  useEffect(() => {
    if (!showSummary || loggedRef.current) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const payload = {
        user_id: user.id,
        mode: 'exam',
        source: 'reviewed',
        question_ids: order,
        correct_count: score,
        total_attempted: answers.length,
        total_questions: order.length,
        started_at: new Date(Date.now() - timeSec * 1000).toISOString(),
        finished_at: new Date().toISOString(),
        duration_sec: timeSec,
        breakdown: byTopic,
      } as any;
      try {
        await (supabase as any).from('exam_attempts').insert(payload);
      } catch (e) {
        console.warn('exam_attempts insert skipped', e);
      }
      loggedRef.current = true;
    })();
  }, [showSummary]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mx-auto w-full md:max-w-5xl">
        {!showSummary ? (
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Exam Mode • Question {idx + 1} of {order.length}</CardTitle>
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
                    <Button variant="outline" onClick={() => setEnded(true)}>End Exam</Button>
                    <div className="flex items-center gap-2">
                      <div className="md:hidden">
                        <Drawer>
                          <DrawerTrigger asChild>
                            <Button variant="outline" size="sm">Exam Tools</Button>
                          </DrawerTrigger>
                          <DrawerContent className="p-4 space-y-4">
                            <div>
                              <div className="text-sm font-medium mb-2">Timer</div>
                              <div aria-live="polite" role="status" className="text-lg font-semibold">{timeDisplay}</div>
                            </div>
                            <div>
                              <div className="text-sm font-medium mb-2">Progress</div>
                              <div className="text-sm mb-2">Question {idx + 1} of {order.length}</div>
                              <Progress value={(answeredCount / order.length) * 100} />
                            </div>
                            <div>
                              <div className="text-sm font-medium mb-2">Question Map</div>
                              <div className="grid grid-cols-8 gap-2">
                                {order.map((qid, i) => {
                                  const isCurrent = i === idx;
                                  const entry = answers.find(a => a.id === qid);
                                  const hasSel = !!entry;
                                  const correct = hasSel && entry!.selected === entry!.correct;
                                  const base = "h-8 w-8 rounded text-sm flex items-center justify-center border";
                                  const state = isCurrent
                                    ? "bg-primary/10 ring-1 ring-primary"
                                    : hasSel
                                      ? (correct ? "bg-primary/20 border-primary text-primary" : "bg-destructive/10 border-destructive text-destructive")
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
                      <Button onClick={submit} disabled={!selected || loading}>{idx < order.length - 1 ? 'Next' : 'Finish'}</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <aside className="hidden md:block">
              <div className="sticky top-20 space-y-4">
                <Card>
                  <CardContent className="py-4">
                    <div className="text-sm font-medium mb-1">Timer</div>
                    <div aria-live="polite" role="status" className="text-xl font-semibold">{timeDisplay}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="text-sm font-medium mb-1">Progress</div>
                    <div className="text-sm mb-2">Question {idx + 1} of {order.length}</div>
                    <Progress value={(answeredCount / order.length) * 100} />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="text-sm font-medium mb-2">Question Map</div>
                    <div className="grid grid-cols-5 gap-2">
                      {order.map((qid, i) => {
                        const isCurrent = i === idx;
                        const entry = answers.find(a => a.id === qid);
                        const hasSel = !!entry;
                        const correct = hasSel && entry!.selected === entry!.correct;
                        const base = "h-8 w-8 rounded text-sm flex items-center justify-center border";
                        const state = isCurrent
                          ? "bg-primary/10 ring-1 ring-primary"
                          : hasSel
                            ? (correct ? "bg-primary/20 border-primary text-primary" : "bg-destructive/10 border-destructive text-destructive")
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
              <CardTitle>Exam Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="text-lg font-semibold">Score: {score} / {answers.length}</div>
              <div className="text-sm text-muted-foreground">Attempts: {answers.length} / {order.length} • Time: {timeDisplay}</div>
              <div className="grid gap-2">
                {Object.entries(byTopic).map(([t, v]) => (
                  <div key={t} className="text-sm">{t}: {v.correct}/{v.total}</div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => navigate('/exams')}>Back to Exams</Button>
                <Button onClick={() => setReviewMode(true)}>Review answers</Button>
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
                  <Button onClick={() => setIdx(Math.min(order.length-1, idx+1))} disabled={idx===order.length-1}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
