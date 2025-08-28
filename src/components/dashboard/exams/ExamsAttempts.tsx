import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogIn } from "lucide-react";

export default function ExamsAttempts() {
  const { user } = useAuth();
  const [mode, setMode] = useState<'practice'|'exam'>('practice');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);

  const practiceLink = (() => {
    if (!active) return '/exams';
    const firstExam = questions?.[0]?.exam as string | undefined;
    // pick weakest topic from breakdown if available
    let topic: string | undefined;
    try {
      const b = active?.breakdown || {};
      const entries = Object.entries(b) as any[];
      if (entries.length) {
        entries.sort((a: any, b: any) => (a[1].correct/(a[1].total||1)) - (b[1].correct/(b[1].total||1)));
        topic = entries[0]?.[0];
      }
    } catch {}
    const params = new URLSearchParams();
    params.set('mode', 'practice');
    if (firstExam) params.set('exam', String(firstExam));
    if (topic) params.set('topic', topic);
    return `/exams?${params.toString()}`;
  })();
  
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { 
        setRows([]);
        setLoading(false);
        return; 
      }
      setLoading(true);
      try {
        const { data } = await (supabase as any)
          .from('exam_attempts')
          .select('*')
          .eq('user_id', user.id)
          .eq('mode', mode)
          .order('started_at', { ascending: false })
          .limit(100);
        if (!cancelled) setRows((data as any[]) || []);
      } catch (error) {
        console.error('Failed to load exam attempts:', error);
        if (!cancelled) setRows([]);
      } finally { 
        if (!cancelled) setLoading(false); 
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, mode]);

  // Show auth prompt if user is not logged in
  if (!user) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="py-8 text-center">
            <LogIn className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
            <p className="text-muted-foreground mb-4">
              Please sign in to view your exam attempts and track your progress.
            </p>
            <Button onClick={() => window.location.href = '/auth'}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openView = async (attempt: any) => {
    setActive(attempt); setOpen(true); setItems([]); setQuestions([]);
    try {
      const { data: it } = await (supabase as any)
        .from('exam_attempt_items')
        .select('*')
        .eq('attempt_id', attempt.id)
        .order('position', { ascending: true });
      setItems((it as any[]) || []);
      const qids = attempt.question_ids || [];
      if (qids.length && attempt.source !== 'ai_practice') {
        // Only try to fetch from reviewed_exam_questions for non-AI sessions
        const { data: qs } = await (supabase as any)
          .from('reviewed_exam_questions')
          .select('id, stem, explanation, correct_index, exam, topic')
          .in('id', qids);
        setQuestions((qs as any[]) || []);
      }
    } catch {}
  };

  const cols = [
    { key: 'started_at', header: 'Date', render: (r: any) => new Date(r.started_at || r.created_at).toLocaleString() },
    { key: 'source', header: 'Source', render: (r: any) => r.source === 'ai_practice' ? 'AI Practice' : 'Reviewed' },
    { key: 'total_questions', header: 'Questions', render: (r: any) => r.total_questions || r.total_attempted || 0 },
    { key: 'score', header: 'Score', render: (r: any) => (r.mode === 'exam' ? `${r.correct_count}/${r.total_attempted}` : `${r.correct_count || 0}/${r.total_attempted || r.total_questions || 0}`) },
    { key: 'duration_sec', header: 'Time', render: (r: any) => `${Math.round((r.duration_sec||0)/60)} min` },
    { key: 'topics', header: 'Topics', render: (r: any) => {
      const b = r.breakdown || {}; const k = Object.keys(b).slice(0,3); return k.map(t => <span key={t} className="mr-2 inline-block text-xs px-2 py-0.5 rounded border">{t}</span>);
    }},
    { key: 'view', header: 'View', render: (r: any) => <Button size="sm" variant="outline" onClick={() => openView(r)}>View</Button> },
  ];

  return (
    <div className="p-4 grid gap-4">
      <div>
        <h3 className="text-lg font-semibold">Attempts</h3>
        <p className="text-sm text-muted-foreground">All your practice and exam sessions.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant={mode==='practice'? 'default':'outline'} onClick={()=>setMode('practice')}>Practice Sessions</Button>
        <Button size="sm" variant={mode==='exam'? 'default':'outline'} onClick={()=>setMode('exam')}>Exam Sessions</Button>
      </div>
      <TableCard title="Sessions" columns={cols as any} rows={rows} isLoading={loading} emptyText="No sessions yet." />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Session Review</DialogTitle></DialogHeader>
          {!items.length ? (
            <div className="text-sm text-muted-foreground">Selections unavailable for this session.</div>
          ) : (
            <div className="space-y-4 max-h-[70vh] overflow-auto pr-2">
              {items.map((it, idx) => {
                const q = questions.find(q => q.id === it.question_id);
                const ck = typeof q?.correct_index === 'number' ? String.fromCharCode(65 + q.correct_index) : it.correct_key;
                const isAI = active?.source === 'ai_practice';
                return (
                  <div key={it.id} className="rounded border p-3">
                    <div className="text-sm font-medium mb-1">
                      {idx+1}. {isAI ? `AI Generated Question (${it.topic || 'General'})` : (q?.stem || '').slice(0,200)}
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Your: {it.selected_key} • Correct: {ck} 
                      {isAI && <span className="ml-2 text-primary">• AI Practice</span>}
                    </div>
                    {q?.explanation && <div className="text-sm text-muted-foreground">{(q.explanation || '').slice(0,240)}…</div>}
                    {isAI && !q?.explanation && <div className="text-sm text-muted-foreground italic">AI question details not stored for review</div>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <a href={practiceLink} className="underline text-sm">Re-practice similar set</a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
