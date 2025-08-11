import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { getJson } from "@/lib/functionsClient";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [items, setItems] = useState<ReviewedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewers, setReviewers] = useState<Record<string, string>>({});
  const [approvedCount, setApprovedCount] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [mode, setMode] = useState<'function' | 'direct'>('function');
  const [topicFilter, setTopicFilter] = useState<string | "">("");
  const [difficulty, setDifficulty] = useState<string | "">("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Reviewed Question Bank • EM Gurus";
    const desc = "Browse guru‑reviewed EM questions with exam and search filters.";
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

// (SLO-derived topic/difficulty removed for now)
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
        // Try public function first
        const res = await getJson('/public-reviewed-exams');
        let list = ((res.items || []) as any[]).map((row: any) => ({
          id: row.id,
          exam: (row.exam_type || row.exam) as ExamCode | string,
          stem: row.stem,
          reviewer_id: null,
          reviewed_at: row.created_at || null,
          topic: Array.isArray(row.tags) && row.tags.length ? row.tags[0] : null,
          tags: Array.isArray(row.tags) ? row.tags : null,
        })) as ReviewedRow[];
        const qtext = q.trim();
        if (exam) list = list.filter((r) => r.exam === exam);
        if (qtext) list = list.filter((r) => r.stem.toLowerCase().includes(qtext.toLowerCase()));
        if (topicFilter) list = list.filter((r) => (r.topic || '').toLowerCase() === topicFilter.toLowerCase());
        if (difficulty) {
          const pickDiff = (row: ReviewedRow) =>
            ((row as any).difficulty as string | undefined) ||
            (row.tags || []).find(t => ['easy','medium','hard'].includes(String(t).toLowerCase()));
          list = list.filter(r => (pickDiff(r) || '').toLowerCase() === difficulty.toLowerCase());
        }
        if (!cancelled) {
          setItems(list);
          setTotalCount(list.length);
          if (approvedCount === null) setApprovedCount(res.count ?? list.length);
          setReviewers({});
          setMode('function');
        }
      } catch {
        // Fallback to direct table query with filters
        let base = (supabase as any)
          .from('reviewed_exam_questions')
          .select('id, exam, stem, reviewer_id, reviewed_at, topic', { count: 'exact' })
          .eq('status', 'approved');
        if (exam) base = base.eq('exam', exam);
        if (topicFilter) base = base.eq('topic', topicFilter);
        if (q) base = base.ilike('stem', `%${q}%`);

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, count, error } = await base
          .order('reviewed_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to);
        if (error) throw error;
        let list = (Array.isArray(data) ? (data as unknown as ReviewedRow[]) : []);
        // Difficulty might not exist as a column; filter client-side if requested
        if (difficulty) list = list.filter(r => String((r as any).difficulty || '').toLowerCase() === difficulty.toLowerCase());
        if (!cancelled) {
          setItems(list);
          setTotalCount(difficulty || topicFilter ? list.length : (count ?? 0));
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exam, sloId, q, topicFilter, difficulty, page]);

  const FiltersPanel = () => {
    const topics = Array.from(new Set(items.map(i => i.topic).filter(Boolean))) as string[];
    return (
      <Card className="p-4 space-y-3">
        <div className="space-y-2">
          <div className="text-sm font-medium">Search</div>
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search questions..." />
        </div>
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
          <div className="text-sm font-medium">Topic</div>
          <Select value={topicFilter || "ALL"} onValueChange={(v) => { setTopicFilter(v === "ALL" ? "" : v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Topic" /></SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="ALL">All topics</SelectItem>
              {topics.map((t) => (<SelectItem key={t} value={t!}>{t}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium">Difficulty</div>
          <Select value={difficulty || "ALL"} onValueChange={(v) => { setDifficulty(v === "ALL" ? "" : v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All levels</SelectItem>
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Hard">Hard</SelectItem>
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
        <Button variant="outline" onClick={() => { setQ(""); setExam(""); setSloId(""); setTopicFilter(""); setDifficulty(""); setPage(1); }}>Reset</Button>
      </Card>
    );
  };

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
                    <CardContent className="text-sm text-muted-foreground flex flex-col gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {it.reviewed_at && (
                          <Badge variant="outline" className="text-xs">
                            Reviewed {formatDistanceToNow(new Date(it.reviewed_at), { addSuffix: true })}
                            {it.reviewer_id && (
                              <>
                                {" "}by{" "}
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="px-0"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/profile/${it.reviewer_id}`); }}
                                >
                                  {reviewers[it.reviewer_id] ? reviewers[it.reviewer_id].replace(/^Dr\s+/i,'') : 'Guru'}
                                </Button>
                              </>
                            )}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className="text-xs cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); setExam((it.exam as ExamCode) || ""); setPage(1); }}
                        >
                          {(EXAM_LABELS as any)[it.exam] || String(it.exam)}
                        </Badge>
                        {!!it.topic && (
                          <Badge
                            variant="secondary"
                            className="text-xs cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setTopicFilter(it.topic!); setPage(1); }}
                          >
                            {it.topic}
                          </Badge>
                        )}
                        {((it as any).difficulty || (it as any).level) && (
                          <Badge
                            variant="secondary"
                            className="text-xs cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setDifficulty(String((it as any).difficulty || (it as any).level)); setPage(1); }}
                          >
                            {(it as any).difficulty || (it as any).level}
                          </Badge>
                        )}
                      </div>
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
