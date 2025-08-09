import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CURRICULA, EXAMS, ExamName } from "@/lib/curricula";

interface Row { id: string; exam: string | null; stem: string | null; tags: string[] | null; topic: string | null; subtopic: string | null; reviewed_at: string | null }

const demo: Row[] = Array.from({ length: 5 }).map((_, i) => ({
  id: `demo-${i+1}`,
  exam: i % 2 ? 'MRCEM Intermediate SBA' : 'FRCEM SBA',
  stem: 'Guru‑reviewed: Early recognition of sepsis improves outcomes. Identify key features and initial management.',
  tags: ['sepsis','critical-care'],
  topic: 'Sepsis',
  subtopic: 'Resuscitation',
  reviewed_at: new Date().toISOString(),
}));

export default function QuestionBankPage() {
  const [exam, setExam] = useState<ExamName | "">("");
  const [area, setArea] = useState<string>("All areas");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const pageSize = 20;
  const areas = useMemo(() => (exam ? ["All areas", ...CURRICULA[exam]] : ["All areas"]) , [exam]);

  useEffect(() => {
    document.title = "Reviewed Question Bank • EM Gurus";
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let q = (supabase as any).from('reviewed_exam_questions')
          .select('id, exam, stem, tags, topic, subtopic, reviewed_at', { count: 'exact' })
          .order('reviewed_at', { ascending: false })
          .range((page-1)*pageSize, page*pageSize - 1);
        if (exam) q = q.eq('exam', exam as any);
        if (area && area !== 'All areas') q = q.or(`topic.eq.${area},subtopic.eq.${area}` as any);
        if (search) q = q.ilike('stem', `%${search}%`);
        const { data, error } = await q;
        if (error) throw error;
        if (!cancelled) setItems((data as any[]) || []);
      } catch (e) {
        console.warn('Bank fetch failed, using demo', e);
        if (!cancelled) setItems(demo);
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
          <Select value={exam} onValueChange={(v) => { setExam(v as ExamName); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Exam" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Exams</SelectItem>
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
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center text-muted-foreground py-10">No questions found.</div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <Button variant="outline" disabled={page===1} onClick={() => setPage(p=>Math.max(1,p-1))}>Previous</Button>
        <div className="text-sm text-muted-foreground">Page {page}</div>
        <Button variant="outline" onClick={() => setPage(p=>p+1)}>Next</Button>
      </div>
    </div>
  );
}
