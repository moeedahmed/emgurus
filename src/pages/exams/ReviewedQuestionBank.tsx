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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  const [qDebounced, setQDebounced] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const [items, setItems] = useState<ReviewedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewers, setReviewers] = useState<Record<string, string>>({});
  const [approvedCount, setApprovedCount] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [mode, setMode] = useState<'function' | 'direct'>('function');
  const [topicFilter, setTopicFilter] = useState<string | "">("");
  const [difficulty, setDifficulty] = useState<string | "">("");
  const [reviewerProfiles, setReviewerProfiles] = useState<Record<string, { id: string; name: string; avatar_url?: string }>>({});
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

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
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
  const visible = items;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [totalPages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const ctrl = new AbortController();
        const timer = window.setTimeout(() => ctrl.abort(), 5000);
        try {
          const params = new URLSearchParams();
          params.set('limit', String(pageSize));
          params.set('offset', String(offset));
          if (exam) params.set('exam', String(exam));
          const qtext = qDebounced.trim();
          if (qtext) params.set('q', qtext);
          const res = await getJson(`/public-reviewed-exams?${params.toString()}`, { signal: ctrl.signal } as any);
          const list = ((res.items || []) as any[]).map((row: any) => ({
            id: row.id,
            exam: (row.exam_type || row.exam) as ExamCode | string,
            stem: row.stem,
            reviewer_id: null,
            reviewed_at: row.reviewed_at || row.created_at || null,
            topic: (Array.isArray(row.tags) && row.tags.length ? row.tags[0] : null) as any,
            tags: (Array.isArray(row.tags) ? row.tags : null) as any,
          })) as ReviewedRow[];
          if (!cancelled) {
            setItems(list);
            setTotalCount(Number.isFinite(res.count) ? res.count : (page * pageSize + list.length));
            setMode('function');
            setReviewers({});
          }
        } catch {
          // Fallback to direct table query with filters and pagination
          let base = (supabase as any)
            .from('reviewed_exam_questions')
            .select('id, exam, stem, reviewer_id, reviewed_at, topic', { count: 'exact' })
            .eq('status', 'approved');
          if (exam) base = base.eq('exam', exam);
          const qtext = qDebounced.trim();
          if (qtext) base = base.ilike('stem', `%${qtext}%`);

          const from = offset;
          const to = from + pageSize - 1;
          const { data, count, error } = await base
            .order('reviewed_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to);
          if (error) throw error;
          let list = (Array.isArray(data) ? (data as unknown as ReviewedRow[]) : []);
          if (!cancelled) {
            setItems(list);
            setTotalCount(count ?? (page * pageSize + list.length));
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
          window.clearTimeout(timer);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exam, qDebounced, page, pageSize]);

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
        <div className="sticky top-20 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border mb-4">
          <h1 className="text-2xl font-semibold py-2">Reviewed Question Bank</h1>
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
              ) : (approvedCount === 0 && page === 1) ? (
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
                                  className="px-0 gap-1 inline-flex items-center"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const pid = reviewerProfiles[it.reviewer_id!]?.id || it.reviewer_id!;
                                    navigate(`/profile/${pid}`);
                                  }}
                                >
                                  <Avatar className="h-4 w-4">
                                    <AvatarImage src={reviewerProfiles[it.reviewer_id!]?.avatar_url || undefined} alt={reviewerProfiles[it.reviewer_id!]?.name || reviewers[it.reviewer_id!] || 'Guru'} />
                                    <AvatarFallback>GU</AvatarFallback>
                                  </Avatar>
                                  {(reviewerProfiles[it.reviewer_id!]?.name || reviewers[it.reviewer_id!] || 'Guru').replace(/^Dr\s+/i,'')}
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
              <Button variant="outline" disabled={page===1 || loading} onClick={() => setPage(p=>Math.max(1,p-1))}>Previous</Button>
              <div className="text-sm text-muted-foreground">Page {page}{totalCount ? ` / ${Math.max(1, Math.ceil(totalCount / pageSize))}` : ''}</div>
              <Button variant="outline" disabled={loading || (items.length < pageSize && !loading)} onClick={() => setPage(p=>p+1)}>Next</Button>
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
