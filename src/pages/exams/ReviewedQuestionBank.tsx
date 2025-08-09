import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

type ExamCode = "MRCEM_Primary" | "MRCEM_SBA" | "FRCEM_SBA";
const EXAM_LABELS: Record<ExamCode, string> = {
  MRCEM_Primary: "MRCEM Primary",
  MRCEM_SBA: "MRCEM SBA",
  FRCEM_SBA: "FRCEM SBA",
};

interface ReviewedRow {
  id: string;
  exam: ExamCode;
  topic: string;
  subtopic: string | null;
  difficulty: string | null;
  stem: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
}

interface SLO { id: string; code: string; title: string }

export default function ReviewedQuestionBank() {
  const [exam, setExam] = useState<ExamCode | "">("");
  const [sloId, setSloId] = useState<string | "">("");
  const [slos, setSlos] = useState<SLO[]>([]);
  const [skipRandom, setSkipRandom] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [items, setItems] = useState<ReviewedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewers, setReviewers] = useState<Record<string, string>>({});
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

  const visible = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(it => it.stem.toLowerCase().includes(q) || it.topic.toLowerCase().includes(q));
  }, [items, search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Random mode: ignore filters, pull a larger set and pick 10 client-side
        if (skipRandom) {
          const { data, error } = await supabase
            .from('reviewed_exam_questions' as any)
            .select('id, exam, topic, subtopic, difficulty, stem, reviewer_id, reviewed_at, status')
            .eq('status', 'approved')
            .limit(50);
          if (error) throw error;
          const all = (Array.isArray(data) ? (data as unknown as ReviewedRow[]) : []);
          // Shuffle and pick 10
          const shuffled = [...all].sort(() => Math.random() - 0.5).slice(0, 10);
          if (!cancelled) setItems(shuffled);
          // fetch reviewers
          const ids = Array.from(new Set(shuffled.map(d => d.reviewer_id).filter(Boolean))) as string[];
          if (ids.length) {
            const { data: g } = await supabase.from('gurus').select('id, name').in('id', ids);
            const map: Record<string, string> = Object.fromEntries((g || []).map((r: any) => [r.id, r.name]));
            if (!cancelled) setReviewers(map);
          }
          return;
        }

        // Filtered mode: build base query
        let base = supabase
          .from('reviewed_exam_questions' as any)
          .select('id, exam, topic, subtopic, difficulty, stem, reviewer_id, reviewed_at, status', { count: 'exact' })
          .eq('status', 'approved');
        if (exam) base = base.eq('exam', exam);

        if (sloId) {
          // find matching question ids via junction
          const { data: qs, error: qsErr } = await supabase
            .from('question_slos')
            .select('question_id')
            .eq('slo_id', sloId)
            .limit(1000);
          if (qsErr) throw qsErr;
          const ids = (qs || []).map((r: any) => r.question_id);
          if (!ids.length) {
            if (!cancelled) setItems([]);
            setReviewers({});
            return;
          }
          base = base.in('id', ids);
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await base
          .order('reviewed_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        const list = (Array.isArray(data) ? (data as unknown as ReviewedRow[]) : []);
        if (!cancelled) setItems(list);
        const ids = Array.from(new Set(list.map(d => d.reviewer_id).filter(Boolean))) as string[];
        if (ids.length) {
          const { data: g } = await supabase.from('gurus').select('id, name').in('id', ids);
          const map: Record<string, string> = Object.fromEntries((g || []).map((r: any) => [r.id, r.name]));
          if (!cancelled) setReviewers(map);
        } else {
          if (!cancelled) setReviewers({});
        }
      } catch (e) {
        console.error('Reviewed bank fetch failed', e);
        if (!cancelled) { setItems([]); setReviewers({}); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exam, sloId, page, skipRandom]);

  return (
    <div className="container mx-auto px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Reviewed Question Bank</h1>
      </header>

      <Card>
        <CardContent className="py-4 grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <Input placeholder="Search stem or topic" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <Select value={exam || "ALL"} onValueChange={(v) => { setExam(v === "ALL" ? "" : (v as ExamCode)); setPage(1); }} disabled={skipRandom}>
            <SelectTrigger><SelectValue placeholder="Exam" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Exams</SelectItem>
              {(Object.keys(EXAM_LABELS) as ExamCode[]).map((code) => (
                <SelectItem key={code} value={code}>{EXAM_LABELS[code]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sloId || "ALL"} onValueChange={(v) => { setSloId(v === "ALL" ? "" : v); setPage(1); }} disabled={skipRandom}>
            <SelectTrigger><SelectValue placeholder="SLO" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All SLOs</SelectItem>
              {slos.map((s) => (<SelectItem key={s.id} value={s.id}>{s.code} — {s.title}</SelectItem>))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch id="skip-random" checked={skipRandom} onCheckedChange={(v) => { setSkipRandom(v); setPage(1); }} />
            <Label htmlFor="skip-random">Skip/Random 10</Label>
          </div>

          <div className="md:col-span-2 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => { setExam(""); setSloId(""); setSearch(""); setSkipRandom(false); setPage(1); }}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 mt-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border animate-pulse bg-muted/40" />
          ))
        ) : visible.length ? (
          visible.map((it) => (
            <Card key={it.id} className="cursor-pointer hover:bg-accent/30" onClick={() => navigate(`/exams/reviewed/${it.id}`)}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between gap-3">
                  <span className="truncate">{it.stem.slice(0, 140)}</span>
                  <div className="text-xs text-muted-foreground">{EXAM_LABELS[it.exam]}</div>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                <span className="border rounded px-2 py-0.5">{it.topic}</span>
                {it.difficulty && <span className="border rounded px-2 py-0.5">{it.difficulty}</span>}
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
          <div className="text-center text-muted-foreground py-10">No reviewed questions yet.</div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <Button variant="outline" disabled={skipRandom || page===1} onClick={() => setPage(p=>Math.max(1,p-1))}>Previous</Button>
        <div className="text-sm text-muted-foreground">{skipRandom ? 'Random 10' : `Page ${page}`}</div>
        <Button variant="outline" disabled={skipRandom} onClick={() => setPage(p=>p+1)}>Next</Button>
      </div>
    </div>
  );
}
