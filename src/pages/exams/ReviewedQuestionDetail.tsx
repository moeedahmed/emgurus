import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QuestionCard from "@/components/exams/QuestionCard";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const letters = ['A','B','C','D','E'];

type SessionRow = {
  id: string;
  user_id: string;
  question_id: string;
  exam: string;
  attempts: number;
  is_flagged: boolean;
  notes: string | null;
  last_selected: string | null;
  is_correct: boolean;
  time_spent_seconds: number;
};

export default function ReviewedQuestionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState<any>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [reviewerName, setReviewerName] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isFlagged, setIsFlagged] = useState(false);
  const [notes, setNotes] = useState("");
  const [timeSpent, setTimeSpent] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const tickRef = useRef<number | null>(null);
  const latestRef = useRef({ attempts: 0, isFlagged: false, notes: "", selectedKey: "", showExplanation: false, correctKey: "", timeSpent: 0 });
  const ids: string[] = location?.state?.ids || [];
  const index: number = location?.state?.index ?? (ids.indexOf(id as string) || 0);

  useEffect(() => {
    document.title = "Reviewed Question • EM Gurus";
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from('reviewed_exam_questions')
          .select('*')
          .eq('id', id)
          .eq('status', 'approved')
          .maybeSingle();
        if (error) throw error;
        const row = data as any;
        if (!cancelled) setQ(row);
        if (row?.reviewer_id) {
          const { data: g } = await supabase.from('gurus').select('id, name').eq('id', row.reviewer_id).maybeSingle();
          if (!cancelled) setReviewerName((g as any)?.name || null);
        }
        // Load session state
        if (user && row) {
          const { data: sess } = await (supabase as any)
            .from('user_question_sessions')
            .select('*')
            .eq('user_id', user.id)
            .eq('question_id', row.id)
            .maybeSingle();
          if (sess) {
            setSessionId(sess.id);
            setAttempts(sess.attempts || 0);
            setIsFlagged(!!sess.is_flagged);
            setNotes(sess.notes || "");
            setTimeSpent(sess.time_spent_seconds || 0);
            setSelectedKey(sess.last_selected || "");
            setShowExplanation(!!sess.is_correct); // if correct already, show
          } else {
            const { data: ins, error: insErr } = await (supabase as any)
              .from('user_question_sessions')
              .insert({ user_id: user.id, question_id: row.id, exam: row.exam })
              .select('*')
              .maybeSingle();
            if (!insErr && ins) setSessionId(ins.id);
          }
        } else if (row) {
          // anon localStorage
          const key = 'emgurus.reviewed.session';
          const raw = localStorage.getItem(key);
          const store = raw ? JSON.parse(raw) : {};
          const s = store[row.id] || {};
          setAttempts(s.attempts || 0);
          setIsFlagged(!!s.is_flagged);
          setNotes(s.notes || "");
          setTimeSpent(s.time_spent_seconds || 0);
          setSelectedKey(s.last_selected || "");
          setShowExplanation(!!s.is_correct);
        }
      } catch (e) {
        console.error('Reviewed question fetch failed', e);
        if (!cancelled) setQ(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, user]);


  const options = useMemo(() => {
    const arr: string[] = Array.isArray(q?.options) ? q.options : [];
    return arr.map((text, idx) => ({ key: letters[idx] || String(idx+1), text }));
  }, [q]);

  const correctKey = useMemo(() => letters[(q?.correct_index ?? 0)] || 'A', [q]);

  // keep latest snapshot for safe persistence
  useEffect(() => {
    latestRef.current = {
      attempts,
      isFlagged,
      notes,
      selectedKey,
      showExplanation,
      correctKey,
      timeSpent,
    } as any;
  }, [attempts, isFlagged, notes, selectedKey, showExplanation, correctKey, timeSpent]);

  const totalQuestions = ids.length || 1;
  const answeredCount = useMemo(() => {
    if (!ids.length) return (showExplanation || !!selectedKey) ? 1 : 0;
    let count = 0;
    try {
      const raw = localStorage.getItem('emgurus.reviewed.session');
      const store = raw ? JSON.parse(raw) : {};
      ids.forEach((qid, i) => {
        if (i < index && store[qid]?.last_selected) count += 1;
      });
    } catch {}
    return count + ((showExplanation || !!selectedKey) ? 1 : 0);
  }, [ids, index, selectedKey, showExplanation]);

  const formatMMSS = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleSelect = async (k: string) => {
    if (showExplanation) return;
    setSelectedKey(k);
    setShowExplanation(true);
    setAttempts((a) => a + 1);
    if (user && q) {
      await (supabase as any)
        .from('user_question_sessions')
        .update({ attempts: attempts + 1, last_selected: k, is_correct: k === correctKey, last_action_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('question_id', q.id);
    } else if (q) {
      const key = 'emgurus.reviewed.session';
      const raw = localStorage.getItem(key);
      const store = raw ? JSON.parse(raw) : {};
      const cur = store[q.id] || {};
      store[q.id] = { ...cur, attempts: (cur.attempts || 0) + 1, last_selected: k, is_correct: k === correctKey };
      localStorage.setItem(key, JSON.stringify(store));
    }
    setTimeout(() => { document.getElementById('explanation-heading')?.focus(); }, 0);
  };


  const persistNow = async () => {
    if (!q) return;
    const snap = latestRef.current;
    if (user) {
      await (supabase as any)
        .from('user_question_sessions')
        .update({
          time_spent_seconds: snap.timeSpent,
          last_action_at: new Date().toISOString(),
          last_selected: snap.selectedKey,
          attempts: snap.attempts,
          is_flagged: snap.isFlagged,
          notes: snap.notes,
          is_correct: snap.showExplanation && snap.selectedKey === snap.correctKey,
        })
        .eq('user_id', user.id)
        .eq('question_id', q.id);
    } else {
      const key = 'emgurus.reviewed.session';
      const raw = localStorage.getItem(key);
      const store = raw ? JSON.parse(raw) : {};
      store[q.id] = {
        time_spent_seconds: snap.timeSpent,
        last_selected: snap.selectedKey,
        attempts: snap.attempts,
        is_flagged: snap.isFlagged,
        notes: snap.notes,
        is_correct: snap.showExplanation && snap.selectedKey === snap.correctKey,
      };
      localStorage.setItem(key, JSON.stringify(store));
    }
  };

  const saveFlag = async (v: boolean) => {
    setIsFlagged(v);
    if (user && q) {
      await (supabase as any)
        .from('user_question_sessions')
        .update({ is_flagged: v, last_action_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('question_id', q.id);
    } else if (q) {
      const key = 'emgurus.reviewed.session';
      const raw = localStorage.getItem(key);
      const store = raw ? JSON.parse(raw) : {};
      const cur = store[q.id] || {};
      store[q.id] = { ...cur, is_flagged: v };
      localStorage.setItem(key, JSON.stringify(store));
    }
  };

  const saveNotes = async (v: string) => {
    setNotes(v);
    if (user && q) {
      await (supabase as any)
        .from('user_question_sessions')
        .update({ notes: v, last_action_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('question_id', q.id);
    } else if (q) {
      const key = 'emgurus.reviewed.session';
      const raw = localStorage.getItem(key);
      const store = raw ? JSON.parse(raw) : {};
      const cur = store[q.id] || {};
      store[q.id] = { ...cur, notes: v };
      localStorage.setItem(key, JSON.stringify(store));
    }
  };

  // Timer
  useEffect(() => {
    let active = true;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        void persistNow();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    tickRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible' && active) {
        setTimeSpent((s) => s + 1);
      }
    }, 1000);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVis);
      if (tickRef.current) clearInterval(tickRef.current);
      void persistNow();
    };
  }, []);

  // Persist every ~5s
  useEffect(() => {
    if (!q) return;
    if (timeSpent % 5 !== 0) return;
    const persist = async () => {
      if (user) {
        await (supabase as any)
          .from('user_question_sessions')
          .update({ time_spent_seconds: timeSpent, last_action_at: new Date().toISOString(), last_selected: selectedKey, attempts, is_flagged: isFlagged, notes, is_correct: showExplanation && selectedKey === correctKey })
          .eq('user_id', user.id)
          .eq('question_id', q.id);
      } else {
        const key = 'emgurus.reviewed.session';
        const raw = localStorage.getItem(key);
        const store = raw ? JSON.parse(raw) : {};
        store[q.id] = { time_spent_seconds: timeSpent, last_selected: selectedKey, attempts, is_flagged: isFlagged, notes, is_correct: showExplanation && selectedKey === correctKey };
        localStorage.setItem(key, JSON.stringify(store));
      }
    };
    persist();
  }, [timeSpent]);

  // Navigation helpers
  const goPrev = () => {
    if (!ids.length) return;
    const prevIdx = Math.max(0, index - 1);
    navigate(`/exams/reviewed/${ids[prevIdx]}`, { state: { ids, index: prevIdx } });
  };
  const goNext = () => {
    if (!ids.length) return;
    const nextIdx = Math.min(ids.length - 1, index + 1);
    navigate(`/exams/reviewed/${ids[nextIdx]}`, { state: { ids, index: nextIdx } });
  };

  // Check answer handler
  const handleCheck = async () => {
    setShowExplanation(true);
    setAttempts((a) => a + 1);
    if (user && q) {
      await (supabase as any)
        .from('user_question_sessions')
        .update({ attempts: attempts + 1, last_selected: selectedKey, is_correct: selectedKey === correctKey, last_action_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('question_id', q.id);
    } else if (q) {
      const key = 'emgurus.reviewed.session';
      const raw = localStorage.getItem(key);
      const store = raw ? JSON.parse(raw) : {};
      const cur = store[q.id] || {};
      store[q.id] = { ...cur, attempts: (cur.attempts || 0) + 1, last_selected: selectedKey, is_correct: selectedKey === correctKey };
      localStorage.setItem(key, JSON.stringify(store));
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '5') {
        const idx = parseInt(e.key, 10) - 1;
        const k = letters[idx];
        if (k && !showExplanation) { void handleSelect(k); }
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 'ArrowRight') {
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedKey, showExplanation, ids, index]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Button variant="outline" onClick={() => navigate('/exams/reviewed')}>Back to list</Button>

      {loading ? (
        <div className="h-40 rounded-xl border animate-pulse bg-muted/40 mt-4" />
      ) : q ? (
        <div className="mt-4 grid gap-6 md:grid-cols-3">
          {/* Mobile top bar */}
          <div className="md:hidden">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="progress">
                <AccordionTrigger>Progress</AccordionTrigger>
                <AccordionContent>
                  <div className="text-sm mb-2">Question {ids.length ? index + 1 : 1}{ids.length ? ` of ${ids.length}` : ''}</div>
                  <Progress value={ids.length ? ((index+1)/ids.length)*100 : 100} />
                  <div className="text-xs text-muted-foreground mt-1">{answeredCount} / {totalQuestions} answered</div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="timer">
                <AccordionTrigger>Timer</AccordionTrigger>
                <AccordionContent>
                  <div aria-live="polite" role="status" className="text-sm font-medium">{formatMMSS(timeSpent)}</div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="notes">
                <AccordionTrigger>My Notes & Flags</AccordionTrigger>
                <AccordionContent>
                  <div className="flex items-center gap-2 mb-3">
                    <Switch id="mark-m" checked={isFlagged} onCheckedChange={saveFlag} />
                    <Label htmlFor="mark-m">Mark for review</Label>
                  </div>
                  <Label htmlFor="notes-m" className="text-sm">Notes</Label>
                  <Textarea id="notes-m" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={(e) => void saveNotes(e.target.value)} placeholder="Your quick notes..." className="mt-1" />
                  <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={() => void saveNotes(notes)}>Save note</Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Left/main */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Reviewed Question</CardTitle>
              </CardHeader>
              <CardContent>
                <QuestionCard
                  stem={q.stem}
                  options={options}
                  selectedKey={selectedKey}
                  onSelect={handleSelect}
                  showExplanation={showExplanation}
                  explanation={q.explanation || "Explanation: This is a temporary explanation preview. The correct answer is highlighted above."}
                  source={`${q.exam} • ${q.topic}${q.subtopic ? ' — ' + q.subtopic : ''}`}
                  correctKey={correctKey}
                  lockSelection={showExplanation}
                />


                <div className="mt-4 flex items-center gap-3">
                  <Button variant="outline" onClick={goPrev} disabled={!ids.length || index===0}>Previous</Button>
                  <Button variant="outline" onClick={goNext} disabled={!ids.length || index===ids.length-1}>Next</Button>
                </div>


                <div className="mt-6 text-sm text-muted-foreground flex flex-wrap gap-2">
                  {q.difficulty && <span className="border rounded px-2 py-0.5">{q.difficulty}</span>}
                  {q.reviewed_at && <span className="border rounded px-2 py-0.5">Reviewed {new Date(q.reviewed_at).toLocaleDateString()}</span>}
                  <span className="border rounded px-2 py-0.5">Reviewer: {reviewerName || '—'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar */}
          <aside className="hidden md:block md:col-span-1">
            <div className="sticky top-20 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm mb-2">Question {ids.length ? index + 1 : 1}{ids.length ? ` of ${ids.length}` : ''}</div>
                  <Progress value={ids.length ? ((index+1)/ids.length)*100 : 100} />
                  <div className="text-xs text-muted-foreground mt-1">{answeredCount} / {totalQuestions} answered</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Timer</CardTitle>
                </CardHeader>
                <CardContent>
                  <div aria-live="polite" role="status" className="text-lg font-semibold">{formatMMSS(timeSpent)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">My Notes & Flags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-3">
                    <Switch id="mark" checked={isFlagged} onCheckedChange={saveFlag} />
                    <Label htmlFor="mark">Mark for review</Label>
                  </div>
                  <Label htmlFor="notes" className="text-sm">Notes</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={(e) => void saveNotes(e.target.value)} placeholder="Your quick notes..." className="mt-1" />
                  <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={() => void saveNotes(notes)}>Save note</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-10">Question not found.</div>
      )}
    </div>
  );
}
