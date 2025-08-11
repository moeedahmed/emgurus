import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const UserProgress = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeMs, setTimeMs] = useState(0);
  const [topics, setTopics] = useState<{ topic: string; attempts: number; correct: number }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    document.title = "Your Progress | EMGurus";
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (!user) { setLoading(false); return; }
        const since = new Date(Date.now() - 30*24*60*60*1000).toISOString();
        const { data: evs, error } = await (supabase as any)
          .from('user_question_events')
          .select('question_id, outcome, time_ms, created_at')
          .gte('created_at', since);
        if (error) throw error;
        const a = (evs || []).length;
        const c = (evs || []).filter((e: any) => e.outcome === 'correct').length;
        const t = (evs || []).reduce((s: number, e: any) => s + (e.time_ms || 0), 0);
        if (!cancel) { setAttempts(a); setCorrect(c); setTimeMs(t); }

        const ids = Array.from(new Set((evs || []).map((e: any) => e.question_id)));
        let topicById: Record<string, string> = {};
        if (ids.length) {
          const { data: qs } = await (supabase as any)
            .from('reviewed_exam_questions')
            .select('id, topic')
            .in('id', ids);
          (qs || []).forEach((q: any) => { topicById[q.id] = q.topic || '—'; });
        }
        const groups: Record<string, { attempts: number; correct: number }> = {};
        (evs || []).forEach((e: any) => {
          const topic = topicById[e.question_id] || '—';
          groups[topic] = groups[topic] || { attempts: 0, correct: 0 };
          groups[topic].attempts += 1;
          if (e.outcome === 'correct') groups[topic].correct += 1;
        });
        const rows = Object.entries(groups)
          .map(([topic, v]) => ({ topic, attempts: v.attempts, correct: v.correct }))
          .sort((x, y) => y.attempts - x.attempts)
          .slice(0, 5);
        if (!cancel) setTopics(rows);

        // Recent exam attempts
        const { data: rec } = await (supabase as any)
          .from('exam_attempts')
          .select('created_at, correct_count, total_attempted, total_questions, duration_sec, mode, source')
          .order('created_at', { ascending: false })
          .limit(10);
        if (!cancel) setRecent(rec || []);
      } catch (e) {
        console.warn('Progress load failed', e);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [user]);

  const accuracy = useMemo(() => attempts ? Math.round((correct / attempts) * 100) : 0, [attempts, correct]);
  const minutes = useMemo(() => Math.round(timeMs / 60000), [timeMs]);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Track Progress</h1>
      <p className="text-muted-foreground mb-6">Reviewed Bank Progress — Last 30 days</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader><CardTitle>Questions Attempted</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{loading ? '—' : attempts}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Accuracy</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{loading ? '—' : `${accuracy}%`}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Time on Task</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{loading ? '—' : `${minutes} min`}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Top Topics by Accuracy</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Accuracy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3}>Loading…</TableCell></TableRow>
              ) : topics.length ? (
                topics.map((r) => {
                  const acc = r.attempts ? Math.round((r.correct / r.attempts) * 100) : 0;
                  return (
                    <TableRow key={r.topic}>
                      <TableCell>{r.topic}</TableCell>
                      <TableCell>{r.attempts}</TableCell>
                      <TableCell>{acc}%</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow><TableCell colSpan={3}>No data yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Recent Exam Attempts</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
              ) : recent.length ? (
                recent.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell>{r.correct_count} / {r.total_attempted}</TableCell>
                    <TableCell>{r.total_attempted} / {r.total_questions}</TableCell>
                    <TableCell>{Math.round((r.duration_sec || 0) / 60)} min</TableCell>
                    <TableCell className="capitalize">{r.mode}</TableCell>
                    <TableCell className="uppercase text-xs tracking-wide">{r.source}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6}>No attempts yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
};

export default UserProgress;
