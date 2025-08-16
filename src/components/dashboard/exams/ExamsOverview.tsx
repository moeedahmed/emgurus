import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendCard from "@/components/dashboard/TrendCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ExamsOverview() {
  const { user, loading: userLoading } = useAuth();
  const [range, setRange] = useState<30 | 90>(30);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (userLoading) {
    return <div className="p-4">Loading overview…</div>;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { 
        setAttempts([]);
        setError(null);
        return; 
      }
      setLoading(true);
      setError(null);
      try {
        const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();
        const { data, error: supabaseError } = await supabase
          .from('exam_attempts')
          .select('*')
          .eq('user_id', user.id)
          .gte('started_at', since)
          .order('started_at', { ascending: false })
          .limit(500);
        
        if (supabaseError) throw supabaseError;
        if (!cancelled) setAttempts((data as any[]) || []);
      } catch (err) {
        console.error('Failed to load exam attempts:', err);
        if (!cancelled) {
          setError('Failed to load exam data');
          setAttempts([]);
        }
      } finally { 
        if (!cancelled) setLoading(false); 
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, range]);

  const totals = useMemo(() => {
    try {
      const safeAttempts = Array.isArray(attempts) ? attempts : [];
      const totalSessions = safeAttempts.length;
      const examOnly = safeAttempts.filter(a => a && a.mode === 'exam');
      const avgScore = examOnly.length ? Math.round(examOnly.reduce((s, a) => s + (Number(a.correct_count) || 0) / Math.max(1, Number(a.total_attempted) || Number(a.total_questions) || 1), 0) / examOnly.length * 100) : 0;
      const questionsAttempted = safeAttempts.reduce((s, a) => s + (Number(a.total_attempted) || Number(a.total_questions) || 0), 0);
      const timeSpent = safeAttempts.reduce((s, a) => s + (Number(a.duration_sec) || 0), 0);
      return { totalSessions, avgScore, questionsAttempted, timeSpent };
    } catch {
      return { totalSessions: 0, avgScore: 0, questionsAttempted: 0, timeSpent: 0 };
    }
  }, [attempts]);

  const series = useMemo(() => {
    // Simple daily counts
    const map: Record<string, number> = {};
    attempts.forEach(a => {
      const d = new Date(a.started_at || a.created_at).toISOString().slice(0,10);
      map[d] = (map[d] || 0) + 1;
    });
    const days = Array.from({ length: range }).map((_, i) => {
      const d = new Date(Date.now() - (range-1-i)*24*60*60*1000);
      const key = d.toISOString().slice(0,10);
      return { date: d.toLocaleDateString(), value: map[key] || 0 };
    });
    return days;
  }, [attempts, range]);

  // Accuracy by exam via first question of each attempt
  const [accByExam, setAccByExam] = useState<Array<{ exam: string, accuracy: number }>>([]);
  useEffect(() => {
    (async () => {
      if (!attempts.length) { setAccByExam([]); return; }
      try {
        const firstIds = Array.from(new Set(attempts.map(a => (a.question_ids || [])[0]).filter(Boolean)));
        if (!firstIds.length) { setAccByExam([]); return; }
        const { data: rows } = await (supabase as any)
          .from('reviewed_exam_questions')
          .select('id, exam')
          .in('id', firstIds);
        const examMap: Record<string,string> = Object.fromEntries(((rows as any[])||[]).map(r => [r.id, r.exam || '—']));
        const byExam: Record<string, { at: number, correct: number }> = {};
        attempts.forEach(a => {
          const first = (a.question_ids || [])[0];
          const ex = examMap[first] || '—';
          const corr = Number(a.correct_count || 0);
          const tot = Number(a.total_attempted || a.total_questions || 0);
          if (!byExam[ex]) byExam[ex] = { at: 0, correct: 0 };
          byExam[ex].at += tot;
          byExam[ex].correct += corr;
        });
        const arr = Object.entries(byExam).map(([exam, v]) => ({ exam, accuracy: v.at ? Math.round((v.correct / v.at) * 100) : 0 }));
        setAccByExam(arr.sort((a,b)=>b.accuracy-a.accuracy));
      } catch { setAccByExam([]); }
    })();
  }, [attempts]);

  // Weak topics from breakdown JSON
  const weakTopics = useMemo(() => {
    const agg: Record<string, { total: number, correct: number }> = {};
    attempts.forEach(a => {
      const b = a.breakdown || {};
      Object.keys(b).forEach(t => {
        const v = b[t];
        agg[t] = agg[t] || { total: 0, correct: 0 };
        agg[t].total += Number(v.total || 0);
        agg[t].correct += Number(v.correct || 0);
      });
    });
    const scored = Object.entries(agg).map(([t, v]) => ({ topic: t, acc: v.total ? Math.round((v.correct/v.total)*100) : 0, total: v.total }));
    return scored.sort((a,b)=>a.acc-b.acc).slice(0,3);
  }, [attempts]);

  if (error) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
        <p className="text-amber-800 dark:text-amber-200">
          Overview currently unavailable. Please retry or reload.
        </p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 grid gap-4">
      <div>
        <h3 className="text-lg font-semibold">Overview</h3>
        <p className="text-sm text-muted-foreground">Your exam practice at a glance.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total sessions" value={totals.totalSessions} isLoading={loading} />
        <KpiCard title="Avg score (exam)" value={`${totals.avgScore}%`} isLoading={loading} />
        <KpiCard title="Questions attempted" value={totals.questionsAttempted} isLoading={loading} />
        <KpiCard title="Time spent" value={`${Math.round(totals.timeSpent/60)} min`} isLoading={loading} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Sessions</div>
          <div className="flex gap-2">
            <Button variant={range===30?"default":"outline"} size="sm" onClick={()=>setRange(30)}>30d</Button>
            <Button variant={range===90?"default":"outline"} size="sm" onClick={()=>setRange(90)}>90d</Button>
          </div>
        </div>
        <TrendCard title={`Sessions (${range}d)`} series={series} rangeLabel={`Last ${range} days`} isLoading={loading} />
        {!attempts.length && (
          <div className="text-sm text-muted-foreground mt-2">No data yet. <a className="underline" href="/exams">Go to Exams</a></div>
        )}
      </div>
      {!!accByExam.length && (
        <div>
          <div className="text-sm font-medium mb-2">Accuracy by exam</div>
          <div className="flex flex-wrap gap-2">
            {accByExam.map(e => (
              <Badge key={e.exam} variant="secondary">{e.exam}: {e.accuracy}%</Badge>
            ))}
          </div>
        </div>
      )}
      {!!weakTopics.length && (
        <div>
          <div className="text-sm font-medium mb-2">Weak topics</div>
          <div className="flex flex-wrap gap-2">
            {weakTopics.map(w => (
              <Badge key={w.topic} variant="outline">{w.topic} • {w.acc}% ({w.total} Qs)</Badge>
            ))}
          </div>
          <div className="mt-2 text-sm"><a className="underline" href={`/exams?mode=practice${weakTopics[0] ? `&topic=${encodeURIComponent(weakTopics[0].topic)}` : ''}`}>Practice these topics</a></div>
        </div>
      )}
    </div>
  );
}
