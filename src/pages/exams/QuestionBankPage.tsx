import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CURRICULA, EXAMS, ExamName } from "@/lib/curricula";
import { toast } from "@/hooks/use-toast";
interface ReviewedQuestionRow { id: string; exam: string | null; stem: string | null; tags: string[] | null; topic: string | null; subtopic: string | null; reviewed_at: string | null; reviewer_id: string | null }

const demo: ReviewedQuestionRow[] = Array.from({ length: 5 }).map((_, i) => ({
  id: `demo-${i+1}`,
  exam: i % 2 ? 'MRCEM Intermediate SBA' : 'FRCEM SBA',
  stem: 'Guru‑reviewed: Early recognition of sepsis improves outcomes. Identify key features and initial management.',
  tags: ['sepsis','critical-care'],
  topic: 'Sepsis',
  subtopic: 'Resuscitation',
  reviewed_at: new Date().toISOString(),
  reviewer_id: null,
}));

// Map human-readable exam names to backend enum codes
// This aligns the UI selection with the review_exam_questions.exam_type values
// Keep the literal types so Supabase types infer correctly
export type ExamCode = "MRCEM_PRIMARY" | "MRCEM_SBA" | "FRCEM_SBA" | "FCPS_PART1" | "FCPS_IMM" | "FCPS_PART2" | "OTHER";
export const EXAM_CODE_MAP: Record<ExamName, ExamCode> = {
  "MRCEM Primary": "MRCEM_PRIMARY",
  "MRCEM Intermediate SBA": "MRCEM_SBA",
  "FRCEM SBA": "FRCEM_SBA",
  "FCPS Part 1 – Pakistan": "FCPS_PART1",
  "FCPS IMM – Pakistan": "FCPS_IMM",
  "FCPS Part 2 – Pakistan": "FCPS_PART2",
  "Other": "OTHER",
};

function toReviewedRow(d: unknown): ReviewedQuestionRow {
  const o = (d ?? {}) as Record<string, unknown>;
  const toStr = (v: unknown) => (typeof v === 'string' ? v : null);
  return {
    id: String(o['id'] ?? `row-${Math.random().toString(36).slice(2)}`),
    exam: toStr(o['exam']) ?? toStr(o['exam_type']),
    stem: toStr(o['stem']) ?? toStr(o['question']),
    tags: Array.isArray(o['tags']) ? (o['tags'] as string[]) : null,
    topic: toStr(o['topic']),
    subtopic: toStr(o['subtopic']),
    reviewed_at: toStr(o['reviewed_at']),
    reviewer_id: toStr(o['reviewer_id']),
  };
}


export default function QuestionBankPage() {
  const [exam, setExam] = useState<ExamName | "">("");
  const [area, setArea] = useState<string>("All areas");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ReviewedQuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewers, setReviewers] = useState<Record<string, string>>({});
  const [totalCount, setTotalCount] = useState(0);
  const navigate = useNavigate();

  const pageSize = 20;
  const areas = useMemo(() => (exam ? ["All areas", ...CURRICULA[exam]] : ["All areas"]) , [exam]);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount]);

  useEffect(() => {
    document.title = "Reviewed Question Bank • EM Gurus";
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let q = supabase
          .from('review_exam_questions')
          .select('id, exam_type, question, tags, topic, reviewed_at, reviewer_id', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range((page-1)*pageSize, page*pageSize - 1);
        if (exam) q = q.eq('exam_type', EXAM_CODE_MAP[exam]);
        if (area && area !== 'All areas') q = q.eq('topic', area);
        if (search) q = q.ilike('question', `%${search}%`);
        const { data, count, error } = await q;
        if (error) throw error;
        const list: ReviewedQuestionRow[] = (Array.isArray(data) ? data : []).map((d) => toReviewedRow(d));
        if (!cancelled) setTotalCount(count ?? 0);
        // Fetch reviewer names if present
        const ids = Array.from(new Set(list.map((d) => d.reviewer_id).filter(Boolean))) as string[];
        if (ids.length) {
          const { data: gurus, error: gErr } = await supabase
            .from('gurus')
            .select('id, name')
            .in('id', ids);
          if (!gErr && Array.isArray(gurus)) {
            const gurusArr = gurus as Array<{ id: string; name: string }>;
            const map: Record<string, string> = Object.fromEntries(gurusArr.map((g) => [g.id, g.name]));
            if (!cancelled) setReviewers(map);
          }
        }
        if (!cancelled) setItems(list);
      } catch (e) {
        console.warn('Bank fetch failed, using demo', e);
        const message = e instanceof Error ? e.message : 'Unknown error';
        toast({
          variant: "destructive",
          title: "Failed to load reviewed questions",
          description: message,
        });
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exam, area, search, page]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardContent className="py-4 grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2"><Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Select value={exam || "ALL"} onValueChange={(v) => { setExam(v === "ALL" ? "" : (v as ExamName)); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Exam" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Exams</SelectItem>
              {EXAMS.map(e => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={area} onValueChange={(v) => { setArea(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Curriculum" /></SelectTrigger>
            <SelectContent>
              {areas.map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
            </SelectContent>
          </Select>
          <div className="md:col-span-2 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => { setExam(""); setArea("All areas"); setSearch(""); setPage(1); }}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 mt-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border animate-pulse bg-muted/40" />
          ))
        ) : items.length ? (
          items.map((it) => (
            <Card key={it.id} className="cursor-pointer hover:bg-accent/30" onClick={() => navigate(`/exams/question/${it.id}`)}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="truncate">{it.stem?.slice(0, 160) || 'Question'}</span>
                  <div className="text-xs text-muted-foreground">Guru‑reviewed</div>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                <span className="border rounded px-2 py-0.5">{it.exam || 'Unknown'}</span>
                {it.topic && <span className="border rounded px-2 py-0.5">{it.topic}</span>}
                {it.subtopic && <span className="border rounded px-2 py-0.5">{it.subtopic}</span>}
                {(it.tags || []).slice(0,3).map(t => (<span key={t} className="border rounded px-2 py-0.5">{t}</span>))}
                {it.reviewed_at && (
                  <span className="border rounded px-2 py-0.5">Reviewed {new Date(it.reviewed_at).toLocaleDateString()}</span>
                )}
                {it.reviewer_id && (
                  <span className="border rounded px-2 py-0.5">Reviewer: {reviewers[it.reviewer_id] || '—'}</span>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center text-muted-foreground py-10">No questions found.</div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <Button variant="outline" disabled={page===1} onClick={() => setPage(p=>Math.max(1,p-1))}>Previous</Button>
        <div className="text-sm text-muted-foreground">Page {page} / {totalPages}</div>
        <Button variant="outline" disabled={page>=totalPages} onClick={() => setPage(p=>Math.min(totalPages, p+1))}>Next</Button>
      </div>
    </div>
  );
}
