import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { getJson } from "@/lib/functionsClient";

type ExamCode = "MRCEM_Primary" | "MRCEM_SBA" | "FRCEM_SBA";
const EXAM_LABELS: Record<ExamCode, string> = {
  MRCEM_Primary: "MRCEM Primary",
  MRCEM_SBA: "MRCEM SBA",
  FRCEM_SBA: "FRCEM SBA",
};

interface ReviewedRow {
  id: string;
  exam: ExamCode;
  stem: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
}

interface SLO { id: string; code: string; title: string }

export default function ReviewedQuestionBank() {
  const [exam, setExam] = useState<ExamCode | "">("");
  const [sloId, setSloId] = useState<string | "">("");
  const [slos, setSlos] = useState<SLO[]>([]);
const [page, setPage] = useState(1);
const pageSize = 10;

  const [items, setItems] = useState<ReviewedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewers, setReviewers] = useState<Record<string, string>>({});
  const [approvedCount, setApprovedCount] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Reviewed Question Bank • EM Gurus";
    const desc = "Browse guru‑reviewed EM questions with exam and SLO filters.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content', desc);
  }, []);

  useEffect(() => {
    // Load SLOs once
    (async () => {
      const { data } = await supabase.from('curriculum_slos').select('id, code, title').order('code');
      setSlos(Array.isArray(data) ? data as SLO[] : []);
    })();
  }, []);

  // Count check and log
  useEffect(() => {
    (async () => {
      try {
        const { count, error } = await (supabase as any)
          .from('reviewed_exam_questions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved');
        if (error) throw error;
        console.log('AI_REVIEWED_COUNT', count ?? 0);
        setApprovedCount(count ?? 0);
      } catch (e) {
        console.warn('AI_REVIEWED_COUNT failed', e);
        setApprovedCount(0);
      }
    })();
  }, []);

  const visible = items;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        try {
          const res = await getJson('/public-reviewed-exams');
          let list = ((res.items || []) as any[]).map((q: any) => ({
            id: q.id,
            exam: (q.exam || q.exam_type) as ExamCode,
            stem: q.stem,
            reviewer_id: null,
            reviewed_at: q.created_at || null,
          })) as ReviewedRow[];
          if (exam) list = list.filter((r) => r.exam === exam);
          if (!cancelled) {
            setItems(list);
            setTotalCount(res.count ?? list.length);
            if (approvedCount === null) setApprovedCount(res.count ?? list.length);
            setReviewers({});
          }
        } catch {
          // Fallback to direct table query as before
          let base = (supabase as any)
            .from('reviewed_exam_questions')
            .select('id, exam, stem, reviewer_id, reviewed_at', { count: 'exact' })
            .eq('status', 'approved');
          if (exam) base = base.eq('exam', exam);

          const from = (page - 1) * pageSize;
          const to = from + pageSize - 1;
          const { data, count, error } = await base
            .order('reviewed_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to);
          if (error) throw error;
          const list = (Array.isArray(data) ? (data as unknown as ReviewedRow[]) : []);
          if (!cancelled) {
            setItems(list);
            setTotalCount(count ?? 0);
          }
          const ids = Array.from(new Set(list.map(d => d.reviewer_id).filter(Boolean))) as string[];
          if (ids.length) {
            const { data: g } = await supabase.from('gurus').select('id, name').in('id', ids);
            const map: Record<string, string> = Object.fromEntries((g || []).map((r: any) => [r.id, r.name]));
            if (!cancelled) setReviewers(map);
          } else {
            if (!cancelled) setReviewers({});
          }
        }
      } catch (e) {
        console.error('Reviewed bank fetch failed', e);
        if (!cancelled) { setItems([]); setReviewers({}); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exam, sloId, page]);

  return (
    <div className="container mx-auto px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Reviewed Question Bank</h1>
      </header>

      <Card>
        <CardContent className="py-4 grid gap-3 md:grid-cols-6">
          <Select value={exam || "ALL"} onValueChange={(v) => { setExam(v === "ALL" ? "" : (v as ExamCode)); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Exam" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All exams</SelectItem>
              {(Object.keys(EXAM_LABELS) as ExamCode[]).map((code) => (
                <SelectItem key={code} value={code}>{EXAM_LABELS[code]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sloId || "ALL"} onValueChange={(v) => { setSloId(v === "ALL" ? "" : v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="SLO" /></SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="ALL">All SLOs</SelectItem>
              {slos.map((s) => (<SelectItem key={s.id} value={s.code}>{s.code} — {s.title}</SelectItem>))}
            </SelectContent>
          </Select>

          <div className="md:col-span-4 flex items-center justify-end">
            <Button variant="outline" onClick={() => { setExam(""); setSloId(""); setPage(1); }}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border animate-pulse bg-muted/40" />
          ))
        ) : approvedCount === 0 ? (
          <Card className="p-6 text-center">
            <div className="text-muted-foreground">
              No reviewed questions yet. Ask an admin to seed EM questions (MRCEM Primary/SBA, FRCEM SBA).
            </div>
          </Card>
        ) : visible.length ? (
          visible.map((it, idx) => (
            <Card key={it.id} className="hover:bg-accent/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between gap-3">
                  <span className="truncate">{it.stem.slice(0, 140)}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{EXAM_LABELS[it.exam]}</span>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/exams/reviewed/${it.id}`, { state: { ids: visible.map(v => v.id), index: idx } })}>Open</Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                {it.reviewed_at && (
                  <span className="border rounded px-2 py-0.5">Reviewed {formatDistanceToNow(new Date(it.reviewed_at), { addSuffix: true })}</span>
                )}
                {it.reviewer_id && (
                  <span className="border rounded px-2 py-0.5">Reviewer: {reviewers[it.reviewer_id] || '—'}</span>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="p-6 text-center"><div className="text-muted-foreground">No results match your filters.</div></Card>
        )}
      </div>

      <div className="flex items-center justify-center mt-4 gap-4">
        <Button variant="outline" disabled={page===1} onClick={() => setPage(p=>Math.max(1,p-1))}>Previous</Button>
        <div className="text-sm text-muted-foreground">Page {page}</div>
        <Button variant="outline" onClick={() => setPage(p=>p+1)}>Next</Button>
      </div>
    </div>
  );
}
