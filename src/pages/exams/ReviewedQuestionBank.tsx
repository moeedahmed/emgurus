import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
  exam: ExamCode | string;
  stem: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  topic?: string | null;
  tags?: string[] | null;
}


interface SLO { id: string; code: string; title: string }

export default function ReviewedQuestionBank() {
  const [exam, setExam] = useState<ExamCode | "">("");
  const [sloId, setSloId] = useState<string | "">("");
  const [slos, setSlos] = useState<SLO[]>([]);
  const [topic, setTopic] = useState<string | "">("");
  const [topics, setTopics] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string | "">("");
  const [difficulties, setDifficulties] = useState<string[]>(["easy","medium","hard"]);
  const [sloQuestionIds, setSloQuestionIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [items, setItems] = useState<ReviewedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewers, setReviewers] = useState<Record<string, string>>({});
  const [approvedCount, setApprovedCount] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [mode, setMode] = useState<'function' | 'direct'>('function');
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Reviewed Question Bank • EM Gurus";
    const desc = "Browse guru‑reviewed EM questions with exam, curriculum, topic, and difficulty filters.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content', desc);
  }, []);

  useEffect(() => {
    // Load Curriculum (SLOs) once
    (async () => {
      const { data } = await supabase.from('curriculum_slos').select('id, code, title').order('code');
      setSlos(Array.isArray(data) ? data as SLO[] : []);
    })();
  }, []);

  // Load question IDs linked to selected curriculum (SLO)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sloId) { setSloQuestionIds([]); return; }
      const { data, error } = await (supabase as any)
        .from('question_slos')
        .select('question_id')
        .eq('slo_id', sloId);
      if (!error && !cancelled) setSloQuestionIds((data || []).map((r: any) => r.question_id));
    })();
    return () => { cancelled = true; };
  }, [sloId]);

  // Derive Topics and Difficulties options based on current exam/curriculum
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // If curriculum selected but no questions map to it, clear
        if (sloId && !sloQuestionIds.length) { setTopics([]); return; }
        let q = (supabase as any)
          .from('reviewed_exam_questions')
          .select('id, topic, difficulty')
          .eq('status', 'approved');
        if (exam) q = q.eq('exam', exam);
        if (sloId && sloQuestionIds.length) q = q.in('id', sloQuestionIds);
        const { data } = await q.limit(1000);
        const tset = new Set<string>();
        const dset = new Set<string>();
        (data || []).forEach((r: any) => {
          if (r.topic) tset.add(r.topic);
          if (r.difficulty) dset.add(r.difficulty);
        });
        const t = Array.from(tset).sort((a,b)=>a.localeCompare(b));
        const d = Array.from(dset).length ? Array.from(dset) : difficulties;
        if (!cancelled) { setTopics(t); setDifficulties(d as string[]); }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [exam, sloId, sloQuestionIds.length]);
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

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = (page - 1) * pageSize;
  const visible = mode === 'function' ? items.slice(offset, offset + pageSize) : items;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [totalPages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        try {
          const res = await getJson('/public-reviewed-exams');
          // If advanced filters are set, prefer direct DB query for accuracy
          if (sloId || topic || difficulty) { throw new Error('force-direct'); }
          let list = ((res.items || []) as any[]).map((q: any) => ({
            id: q.id,
            exam: (q.exam_type || q.exam) as ExamCode | string,
            stem: q.stem,
            reviewer_id: null,
            reviewed_at: q.created_at || null,
            topic: Array.isArray(q.tags) && q.tags.length ? q.tags[0] : null,
            tags: Array.isArray(q.tags) ? q.tags : null,
          })) as ReviewedRow[];
          if (exam) list = list.filter((r) => r.exam === exam);
          if (!cancelled) {
            setItems(list);
            setTotalCount(res.count ?? list.length);
            if (approvedCount === null) setApprovedCount(res.count ?? list.length);
            setReviewers({});
            setMode('function');
          }
        } catch {
          // Fallback to direct table query with filters
          // If curriculum is selected but no question IDs match, short-circuit
          if (sloId && !sloQuestionIds.length) {
            if (!cancelled) { setItems([]); setTotalCount(0); setMode('direct'); }
          } else {
            let base = (supabase as any)
              .from('reviewed_exam_questions')
              .select('id, exam, stem, reviewer_id, reviewed_at, topic, difficulty', { count: 'exact' })
              .eq('status', 'approved');
            if (exam) base = base.eq('exam', exam);
            if (sloId && sloQuestionIds.length) base = base.in('id', sloQuestionIds);
            if (topic) base = base.eq('topic', topic);
            if (difficulty) base = base.eq('difficulty', difficulty);

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
              setMode('direct');
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
        }
      } catch (e) {
        console.error('Reviewed bank fetch failed', e);
        if (!cancelled) { setItems([]); setReviewers({}); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exam, sloId, topic, difficulty, page]);

  const FiltersPanel = () => (
    <Card className="p-4 space-y-3">
      <div className="space-y-2">
        <div className="text-sm font-medium">Exam</div>
        <Select value={exam || "ALL"} onValueChange={(v) => { setExam(v === "ALL" ? "" : (v as ExamCode)); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Exam" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All exams</SelectItem>
            {(Object.keys(EXAM_LABELS) as ExamCode[]).map((code) => (
              <SelectItem key={code} value={code}>{EXAM_LABELS[code]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium">Curriculum</div>
        <Select value={sloId || "ALL"} onValueChange={(v) => { setSloId(v === "ALL" ? "" : v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Curriculum" /></SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="ALL">All curriculum</SelectItem>
            {slos.map((s) => (<SelectItem key={s.id} value={s.id}>{s.code} — {s.title}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium">Topic</div>
        <Select value={topic || "ALL"} onValueChange={(v) => { setTopic(v === "ALL" ? "" : v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Topic" /></SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="ALL">All topics</SelectItem>
            {topics.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium">Difficulty</div>
        <Select value={difficulty || "ALL"} onValueChange={(v) => { setDifficulty(v === "ALL" ? "" : v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All levels</SelectItem>
            {difficulties.map((d) => (<SelectItem key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <Button variant="outline" onClick={() => { setExam(""); setSloId(""); setTopic(""); setDifficulty(""); setPage(1); }}>Reset</Button>
    </Card>
  );

  return (
    <main>
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">Reviewed Question Bank</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <section className="lg:col-span-8">
            <div className="mb-4 lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Filters</Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 sm:w-96">
                  <FiltersPanel />
                </SheetContent>
              </Sheet>
            </div>

            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="h-24 animate-pulse" />
                ))
              ) : approvedCount === 0 ? (
                <Card className="p-6 text-center"><div className="text-muted-foreground">No reviewed questions yet. Ask an admin to seed EM questions.</div></Card>
              ) : visible.length ? (
                visible.map((it, idx) => (
                  <Card
                    key={it.id}
                    className="hover:bg-accent/30 cursor-pointer"
                    role="button"
                    onClick={() => navigate(`/exams/reviewed/${it.id}`, { state: { ids: visible.map(v => v.id), index: idx } })}
                  >
                    <CardHeader>
                      <CardTitle className="text-base">
                        <span className="line-clamp-2">{it.stem.slice(0, 200)}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                      {it.reviewed_at && (
                        <span className="border rounded px-2 py-0.5">Reviewed {formatDistanceToNow(new Date(it.reviewed_at), { addSuffix: true })}</span>
                      )}
                      <span className="border rounded px-2 py-0.5">Exam: {(EXAM_LABELS as any)[it.exam] || String(it.exam)}</span>
                      {!!it.topic && <span className="border rounded px-2 py-0.5">Topic: {it.topic}</span>}
                      {(it as any).difficulty && <span className="border rounded px-2 py-0.5">Difficulty: {(it as any).difficulty}</span>}
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
              <div className="text-sm text-muted-foreground">Page {page} / {totalPages}</div>
              <Button variant="outline" disabled={page>=totalPages} onClick={() => setPage(p=>Math.min(totalPages, p+1))}>Next</Button>
            </div>
          </section>

          <aside className="lg:col-span-4 hidden lg:block">
            <div className="lg:sticky lg:top-20">
              <div className="max-h-[calc(100vh-6rem)] overflow-auto pr-2">
                <FiltersPanel />
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
