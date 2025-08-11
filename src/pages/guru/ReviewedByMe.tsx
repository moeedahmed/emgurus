import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface Row {
  id: string;
  exam: string | null;
  stem: string;
  reviewed_at: string | null;
  topic?: string | null;
  difficulty?: string | null;
}

export default function ReviewedByMe() {
  const [guruId, setGuruId] = useState<string | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Reviewed by Me | Guru | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content','Your approved reviewed exam questions.');
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('user_id', user.id).maybeSingle();
      const name = (profile?.full_name || '').trim();
      const withoutDr = name.replace(/^Dr\s+/i, '');
      // Try exact, Dr prefix, and ilike contains
      let gId: string | null = null;
      const { data: exact } = await supabase.from('gurus').select('id, name').eq('name', name).maybeSingle();
      if (exact?.id) gId = exact.id as string;
      if (!gId) {
        const { data: drpref } = await supabase.from('gurus').select('id, name').eq('name', `Dr ${withoutDr}`).maybeSingle();
        if (drpref?.id) gId = drpref.id as string;
      }
      if (!gId && name) {
        const { data: anyMatch } = await supabase.from('gurus').select('id, name').ilike('name', `%${withoutDr}%`).limit(1);
        if (anyMatch && anyMatch[0]) gId = anyMatch[0].id as string;
      }
      if (gId) setGuruId(gId);
    })();
  }, []);

  useEffect(() => {
    if (!guruId) return;
    (async () => {
      setLoading(true);
      try {
        let base = (supabase as any)
          .from('reviewed_exam_questions')
          .select('id, exam, stem, reviewed_at, topic, difficulty')
          .eq('status', 'approved')
          .eq('reviewer_id', guruId);
        if (q.trim()) base = base.ilike('stem', `%${q.trim()}%`);
        const { data, error } = await base.order('reviewed_at', { ascending: false }).limit(50);
        if (error) throw error;
        setItems((data || []) as Row[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [guruId, q]);

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Reviewed by Me</h1>
        <p className="text-muted-foreground">All questions you have approved.</p>
      </header>

      <div className="mb-4 max-w-sm">
        <Input placeholder="Search reviewed questions..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (<Card key={i} className="h-24 animate-pulse" />))
        ) : items.length ? items.map((it) => (
          <Card key={it.id} className="hover:bg-accent/30 cursor-pointer" role="button" onClick={() => navigate(`/exams/reviewed/${it.id}`)}>
            <CardHeader>
              <CardTitle className="text-base">
                <span className="line-clamp-2">{it.stem.slice(0, 200)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
              {it.reviewed_at && (
                <Badge variant="outline" className="text-xs">Reviewed {formatDistanceToNow(new Date(it.reviewed_at), { addSuffix: true })}</Badge>
              )}
              {it.exam && <Badge variant="secondary" className="text-xs">{String(it.exam)}</Badge>}
              {it.topic && <Badge variant="secondary" className="text-xs">{it.topic}</Badge>}
              {it.difficulty && <Badge variant="secondary" className="text-xs">{it.difficulty}</Badge>}
            </CardContent>
          </Card>
        )) : (
          <Card className="p-6 text-center"><div className="text-muted-foreground">No reviewed questions yet.</div></Card>
        )}
      </div>
    </main>
  );
}
