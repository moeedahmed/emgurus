import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QuestionCard from "@/components/exams/QuestionCard";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
const letters = ['A','B','C','D','E'];
const FEEDBACK_TAGS = ["Looks good","Wrong answer","Ambiguous","Outdated","Typo"] as const;

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
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState<any>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [reviewerName, setReviewerName] = useState<string | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [notes, setNotes] = useState("");
  const [issueTypes, setIssueTypes] = useState<string[]>([]);
  const [showMeta, setShowMeta] = useState(false);
  const tickRef = useRef<number | null>(null);
  const ids: string[] = location?.state?.ids || [];
  const index: number = location?.state?.index ?? (ids.indexOf(id as string) || 0);
  const SESSION_KEY = 'emgurus.reviewed.session';
  const [ended, setEnded] = useState(false);
  const [summary, setSummary] = useState<{ score: number; attempted: number; total: number; byTopic: Record<string, { total: number; correct: number }>; durationSec: number; questionIds: string[] }>({ score: 0, attempted: 0, total: 0, byTopic: {}, durationSec: 0, questionIds: [] });
  const loggedRef = useRef(false);
  const [isMember, setIsMember] = useState<boolean>(true);
  const [paywalled, setPaywalled] = useState<boolean>(false);
  const [needsFeedback, setNeedsFeedback] = useState<boolean>(false);
  const [feedbackGiven, setFeedbackGiven] = useState<boolean>(false);

  useEffect(() => {
    document.title = "Practice Mode • EM Gurus";
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        const uid = u?.id;
        if (!uid) {
          setIsMember(false);
          const used = Number(localStorage.getItem('free_reviewed_used') || '0');
          if (used >= 10) setPaywalled(true);
          return;
        }
        const { data: prof } = await supabase.from('profiles').select('subscription_tier').eq('user_id', uid).maybeSingle();
        const tier = (prof as any)?.subscription_tier || 'free';
        const member = String(tier).toLowerCase() !== 'free';
        setIsMember(member);
        if (!member) {
          const { count } = await (supabase as any)
            .from('exam_attempts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', uid)
            .eq('source', 'reviewed');
          if ((count ?? 0) >= 100) setPaywalled(true);
        }
      } catch {}
    })();
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
        // Practice mode is ephemeral: do not restore prior selections
        setSelectedKey("");
        setShowExplanation(false);
        setTimeSpent(0);
        setNotes("");
        setIssueTypes([]);

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

  const handleSelect = (k: string) => {
    if (showExplanation || !q) return;
    setSelectedKey(k);
    setShowExplanation(true);
    if (!isMember) { setNeedsFeedback(true); setFeedbackGiven(false); }
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      const store = raw ? JSON.parse(raw) : {};
      store[q.id] = {
        last_selected: k,
        is_correct: k === correctKey,
        topic: q.topic || 'General'
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(store));
    } catch {}
    setTimeout(() => { (document.getElementById('practice-feedback-live') as HTMLElement | null)?.focus?.(); }, 0);
  };

const handleToggleTag = (tag: string) => {
    setIssueTypes((prev) => {
      const next = prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag];
      if (!isMember && needsFeedback) setFeedbackGiven(next.length > 0);
      return next;
    });
  };

  const sendFeedback = async (customComment?: string) => {
    if (!q) return;
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to send feedback.', variant: 'destructive' });
      return;
    }
    try {
      const comment = customComment ?? ((issueTypes.length ? `[${issueTypes.join(', ')}] ` : '') + (notes || ''));
      await supabase.from('exam_question_flags').insert({
        question_id: q.id,
        question_source: `${q.exam || 'Reviewed'}${q.topic ? ' • ' + q.topic : ''}`,
        flagged_by: user.id,
        comment: comment || null,
      } as any);
      toast({ title: 'Thanks—your feedback was sent' });
      setIssueTypes([]);
      setNotes('');
      setFeedbackGiven(true);
      setNeedsFeedback(false);
      try {
        if (!user) return;
        const used = Number(localStorage.getItem('free_reviewed_used') || '0');
        localStorage.setItem('free_reviewed_used', String(used + 1));
      } catch {}
    } catch (e: any) {
      toast({ title: 'Failed to send feedback', description: e.message, variant: 'destructive' });
    }
  };

  const handleReset = () => {
    if (!q) return;
    setSelectedKey("");
    setShowExplanation(false);
    setNotes("");
    setIssueTypes([]);
    // Only clear the current question from session storage
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      const store = raw ? JSON.parse(raw) : {};
      if (q.id && store[q.id]) { delete store[q.id]; }
      localStorage.setItem(SESSION_KEY, JSON.stringify(store));
    } catch {}
    toast({ title: 'Question reset', description: 'Your selection for this question was cleared.' });
  };

  const endPractice = () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      const store = raw ? JSON.parse(raw) : {};
      const qids: string[] = (ids.length ? ids : Object.keys(store));
      const attempted = qids.filter((qid) => store[qid]?.last_selected).length;
      let score = 0;
      const byTopic: Record<string, { total: number; correct: number }> = {};
      qids.forEach((qid) => {
        const entry = store[qid];
        if (entry && entry.last_selected) {
          const t = entry.topic || 'General';
          byTopic[t] = byTopic[t] || { total: 0, correct: 0 };
          byTopic[t].total += 1;
          if (entry.is_correct) { byTopic[t].correct += 1; score += 1; }
        }
      });
      setSummary({ score, attempted, total: qids.length, byTopic, durationSec: timeSpent, questionIds: qids });
      setEnded(true);
    } catch {
      const qids: string[] = ids;
      setSummary({ score: 0, attempted: 0, total: qids.length, byTopic: {}, durationSec: timeSpent, questionIds: qids });
      setEnded(true);
    }
  };

  // Timer
  useEffect(() => {
    let active = true;
    const onVis = () => {};
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
    };
  }, []);

  useEffect(() => {
    if (!ended || loggedRef.current) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const payload = {
        user_id: user.id,
        mode: 'practice',
        source: 'reviewed',
        question_ids: summary.questionIds,
        correct_count: summary.score,
        total_attempted: summary.attempted,
        total_questions: summary.total,
        started_at: new Date(Date.now() - summary.durationSec * 1000).toISOString(),
        finished_at: new Date().toISOString(),
        duration_sec: summary.durationSec,
        breakdown: summary.byTopic,
      } as any;
      try {
        const { data: attemptIns, error: attErr } = await (supabase as any)
          .from('exam_attempts')
          .insert(payload)
          .select('id')
          .single();
        if (!attErr && attemptIns?.id) {
          // Build items from localStorage + fetch correct answers
          const qids = summary.questionIds;
          let store: any = {};
          try { store = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}'); } catch {}
          const { data: rows } = await (supabase as any)
            .from('reviewed_exam_questions')
            .select('id, correct_index, topic')
            .in('id', qids);
          const map: Record<string, any> = Object.fromEntries(((rows as any[]) || []).map(r => [r.id, r]));
          const items = qids.map((qid, idx) => {
            const sel = store?.[qid]?.last_selected || null;
            if (!sel) return null;
            const ci = map[qid]?.correct_index ?? 0;
            const ck = letters[ci] || 'A';
            const t = store?.[qid]?.topic || map[qid]?.topic || null;
            return {
              attempt_id: attemptIns.id,
              user_id: user.id,
              question_id: qid,
              selected_key: sel,
              correct_key: ck,
              topic: t,
              position: idx + 1,
            } as any;
          }).filter(Boolean);
          if (items.length) {
            try { await (supabase as any).from('exam_attempt_items').insert(items as any); } catch (e) { console.warn('exam_attempt_items insert skipped', e); }
          }
        }
      } catch (e) { console.warn('exam_attempts insert skipped', e); }
      loggedRef.current = true;
    })();
  }, [ended, summary]);

  // Navigation helpers
  const goPrev = () => {
    if (!ids.length) return;
    const prevIdx = Math.max(0, index - 1);
    navigate(`/exams/practice/${ids[prevIdx]}`, { state: { ids, index: prevIdx } });
  };
const goNext = async () => {
    if (!ids.length) return;
    if (!isMember && needsFeedback && !feedbackGiven) {
      if (issueTypes.length > 0) {
        await sendFeedback();
      } else {
        return; // block next until feedback is selected
      }
    }
  const nextIdx = Math.min(ids.length - 1, index + 1);
    navigate(`/exams/practice/${ids[nextIdx]}`, { state: { ids, index: nextIdx } });
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
      <Button variant="outline" onClick={() => navigate('/exams')}>Back to exams</Button>
      {/* Mobile progress at top */}
      <div className="md:hidden sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border mt-2">
        <div className="px-1 py-2">
          <div className="text-xs text-muted-foreground mb-1">Question {ids.length ? index + 1 : 1}{ids.length ? ` of ${ids.length}` : ''}</div>
          <Progress value={ids.length ? ((index+1)/ids.length)*100 : 100} />
        </div>
      </div>

      {paywalled ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Upgrade to continue</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-sm">You've reached the free reviewed-questions limit.</div>
            <a href="/pricing"><Button>Exam Membership</Button></a>
          </CardContent>
        </Card>
      ) : ended ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Practice Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="text-lg font-semibold">Score: {summary.score} / {summary.attempted}</div>
            <div className="text-sm text-muted-foreground">Attempts: {summary.attempted} / {summary.total} • Time: {formatMMSS(summary.durationSec)}</div>
            <div className="grid gap-2">
              {Object.entries(summary.byTopic).map(([t, v]) => (
                <div key={t} className="text-sm">{t}: {v.correct}/{v.total}</div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => navigate('/exams')}>Back to Exams</Button>
              <Button onClick={() => setEnded(false)}>Continue Practice</Button>
            </div>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="h-40 rounded-xl border animate-pulse bg-muted/40 mt-4" />
      ) : q ? (
        <div className="mt-4 grid gap-6 md:grid-cols-3">

          {/* Left/main */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Practice Mode</CardTitle>
              </CardHeader>
              <CardContent>
                <QuestionCard
                  stem={q.stem}
                  options={options}
                  selectedKey={selectedKey}
                  onSelect={handleSelect}
                  showExplanation={showExplanation}
                  explanation={q.explanation || "Explanation: This is a temporary explanation preview. The correct answer is highlighted above."}
                  source={q.source || undefined}
                  correctKey={correctKey}
                  lockSelection={showExplanation}
                />

                {/* Feedback below the question for both mobile and desktop */}
                {showExplanation && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-base">Feedback</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {FEEDBACK_TAGS.map(tag => (
                          <Button
                            key={tag}
                            variant={issueTypes.includes(tag) ? 'default' : 'outline'}
                            size="sm"
                            aria-pressed={issueTypes.includes(tag)}
                            onClick={() => handleToggleTag(tag)}
                          >
                            {tag}
                          </Button>
                        ))}
                      </div>
                      <Label htmlFor="notes-main" className="text-sm">Describe (optional)</Label>
                      <Textarea id="notes-main" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a short note…" className="mt-1" />
                      <div className="mt-3 flex items-center gap-2">
                        <Button size="sm" onClick={() => sendFeedback()}>Send</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={goPrev} disabled={!ids.length || index===0 || (needsFeedback && !feedbackGiven)}>Previous</Button>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={goNext} disabled={!ids.length || index===ids.length-1 || (needsFeedback && !feedbackGiven)}>Next</Button>
                      {(!isMember && needsFeedback && !feedbackGiven) && (
                        <span id="practice-feedback-live" className="text-xs text-muted-foreground">Please select a feedback tag to unlock Next. Feedback on each question is mandatory for free users.</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleReset}>Reset</Button>
                    <Button variant="outline" onClick={endPractice} disabled={needsFeedback && !feedbackGiven}>End Practice</Button>
                  </div>
                </div>
              </CardContent>

              <CardContent>
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={() => setShowMeta(v => !v)}>
                    {showMeta ? 'Hide details' : 'Show details'}
                  </Button>
                </div>
                {showMeta && (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {q.exam && <Badge variant="secondary">{q.exam}</Badge>}
                      {q.topic && <Badge variant="secondary">{q.topic}</Badge>}
                      {q.subtopic && <Badge variant="outline">{q.subtopic}</Badge>}
                      {q.difficulty && <Badge variant="outline">{q.difficulty}</Badge>}
                      {q.reviewed_at && <Badge variant="outline">Reviewed {new Date(q.reviewed_at).toLocaleDateString()}</Badge>}
                      <a href={q.reviewer_id ? `/profile/${q.reviewer_id}` : undefined} className="no-underline">
                        <Badge variant="secondary">Reviewer: {reviewerName || '—'}</Badge>
                      </a>
                    </div>
                    {q.source && <div className="mt-2 text-sm text-muted-foreground">Source: {q.source}</div>}
                  </>
                )}
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
              {/* Feedback moved below the question; sidebar version removed */}
            </div>
          </aside>
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-10">Question not found.</div>
      )}

    </div>
  );
}
