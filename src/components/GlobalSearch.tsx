import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getJson } from "@/lib/functionsClient";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon, BookOpen, FileQuestion, Users } from "lucide-react";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type BlogItem = { id: string; title: string; slug: string; excerpt?: string | null };

type ReviewedItem = { id: string; stem: string; exam_type?: string | null };

type GuruItem = { id: string; full_name: string; specialty?: string | null };

export default function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [questions, setQuestions] = useState<ReviewedItem[]>([]);
  const [gurus, setGurus] = useState<GuruItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) { setQ(""); setBlogs([]); setQuestions([]); setGurus([]); }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) { setBlogs([]); setQuestions([]); setGurus([]); return; }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const [blogsRes, reviewedRes, gurusRes] = await Promise.all([
          getJson('/public-blogs').catch(() => ({ items: [] })),
          getJson(`/public-reviewed-exams?q=${encodeURIComponent(term)}&limit=10`).catch(() => ({ items: [] })),
          getJson(`/consultations-api/api/gurus?q=${encodeURIComponent(term)}`).catch(() => ({ items: [] })),
        ]);
        if (cancelled) return;
        const blogItems: BlogItem[] = (blogsRes.items || []).filter((b: any) =>
          String(b.title || '').toLowerCase().includes(term.toLowerCase()) ||
          String(b.excerpt || '').toLowerCase().includes(term.toLowerCase())
        ).slice(0, 10).map((b: any) => ({ id: b.id, title: b.title, slug: b.slug, excerpt: b.excerpt || null }));
        setBlogs(blogItems);
        const qItems: ReviewedItem[] = (reviewedRes.items || []).map((r: any) => ({ id: r.id, stem: r.stem, exam_type: r.exam_type || null }));
        setQuestions(qItems);
        const gItems: GuruItem[] = (gurusRes.items || gurusRes || []).slice(0, 10).map((g: any) => ({ id: g.id || g.user_id, full_name: g.full_name || g.name || 'Guru', specialty: g.specialty || null }));
        setGurus(gItems);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(run, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open]);

  const hasResults = useMemo(() => blogs.length + questions.length + gurus.length > 0, [blogs, questions, gurus]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Search EMGurus</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search blogs, reviewed questions, or gurus"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onOpenChange(false); }}
          />
        </div>
        <div className="max-h-80 overflow-auto space-y-6">
          {loading && <div className="text-sm text-muted-foreground">Searching…</div>}
          {!loading && !hasResults && q.trim().length >= 2 && (
            <div className="text-sm text-muted-foreground">No results found.</div>
          )}
          {blogs.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><BookOpen className="h-4 w-4" /> Blogs</div>
              <ul className="space-y-1">
                {blogs.map((b) => (
                  <li key={b.id}>
                    <button className="w-full text-left rounded-md px-2 py-1 hover:bg-accent" onClick={() => { onOpenChange(false); navigate(`/blogs/${b.slug}`); }}>
                      <div className="font-medium">{b.title}</div>
                      {b.excerpt && <div className="text-xs text-muted-foreground line-clamp-1">{b.excerpt}</div>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {questions.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><FileQuestion className="h-4 w-4" /> Reviewed Questions</div>
              <ul className="space-y-1">
                {questions.map((r) => (
                  <li key={r.id}>
                    <button className="w-full text-left rounded-md px-2 py-1 hover:bg-accent" onClick={() => { onOpenChange(false); navigate(`/exams/reviewed/${r.id}`); }}>
                      <div className="text-sm line-clamp-1">{r.stem}</div>
                      {r.exam_type && <div className="text-xs text-muted-foreground">{r.exam_type}</div>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {gurus.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4" /> Gurus</div>
              <ul className="space-y-1">
                {gurus.map((g) => (
                  <li key={g.id}>
                    <button className="w-full text-left rounded-md px-2 py-1 hover:bg-accent" onClick={() => { onOpenChange(false); navigate(`/profile/${g.id}`); }}>
                      <div className="font-medium">{g.full_name}</div>
                      {g.specialty && <div className="text-xs text-muted-foreground">{g.specialty}</div>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
