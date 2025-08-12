import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRICULA, EXAMS, ExamName } from "@/lib/curricula";

export default function ExamsProgressMatrix() {
  const { user } = useAuth();
  const [exam, setExam] = useState<ExamName | "">("");
  const [range, setRange] = useState<'30'|'90'|'all'>("30");
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setRows([]); return; }
      const since = range === 'all' ? null : new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await (supabase as any)
        .from('exam_attempts')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(500);
      const filtered = (data as any[] || []).filter(a => !since || (a.started_at && a.started_at >= since));
      setRows(filtered);
    })();
    return () => { cancelled = true; };
  }, [user?.id, range]);

  const topics = useMemo(() => {
    const agg: Record<string, { total: number, correct: number }> = {};
    rows.forEach(a => {
      const b = a.breakdown || {};
      Object.keys(b).forEach(t => {
        const v = b[t];
        agg[t] = agg[t] || { total: 0, correct: 0 };
        agg[t].total += Number(v.total || 0);
        agg[t].correct += Number(v.correct || 0);
      });
    });
    const arr = Object.entries(agg).map(([t, v]) => ({ topic: t, attempts: v.total, acc: v.total? Math.round((v.correct/v.total)*100):0 }));
    return arr.sort((a,b)=>a.topic.localeCompare(b.topic));
  }, [rows]);

  const areas = exam ? CURRICULA[exam] : [];
  const coveragePct = useMemo(() => {
    if (!exam) return 0;
    const set = new Set(topics.map(t => t.topic));
    const total = areas.length || 1;
    const covered = areas.filter(a => set.has(a)).length;
    return Math.round((covered/total)*100);
  }, [exam, topics]);

  return (
    <div className="p-4 grid gap-4">
      <div>
        <h3 className="text-lg font-semibold">Progress</h3>
        <p className="text-sm text-muted-foreground">Accuracy by topic and curriculum coverage.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <div className="text-sm font-medium mb-1">Exam</div>
          <Select value={exam || undefined as any} onValueChange={(v)=>setExam(v as ExamName)}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              {EXAMS.map(e => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Range</div>
          <Select value={range} onValueChange={(v)=>setRange(v as any)}>
            <SelectTrigger><SelectValue placeholder="30 days" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end"><div className="text-sm text-muted-foreground">Curriculum coverage: {exam ? `${coveragePct}%` : '—'}</div></div>
      </div>

      <TableCard
        title="Topic mastery"
        columns={[
          { key: 'topic', header: 'Topic' },
          { key: 'attempts', header: 'Attempts' },
          { key: 'acc', header: 'Accuracy %' },
        ] as any}
        rows={topics.map((t, i) => ({ id: i, ...t })) as any}
        emptyText="No practice yet."
      />

      <div className="text-sm"><a className="underline" href={`/exams?mode=practice${exam ? `&exam=${encodeURIComponent(exam)}` : ''}${topics[0] ? `&topic=${encodeURIComponent(topics[0].topic)}` : ''}`}>Do 20 Easy Respiratory Qs</a></div>
    </div>
  );
}
