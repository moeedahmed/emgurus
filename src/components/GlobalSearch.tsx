import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getJson } from "@/lib/functionsClient";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon, BookOpen, FileQuestion, Users, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type BlogItem = { id: string; title: string; slug: string; excerpt?: string | null };

type ReviewedItem = { id: string; stem: string; exam_type?: string | null };

type GuruItem = { id: string; full_name: string; specialty?: string | null };

type ForumItem = { id: string; title: string; content?: string | null };


export default function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [questions, setQuestions] = useState<ReviewedItem[]>([]);
  const [gurus, setGurus] = useState<GuruItem[]>([]);
  const [forums, setForums] = useState<ForumItem[]>([]);
  
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) { setQ(""); setBlogs([]); setQuestions([]); setGurus([]); setForums([]); }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) { setBlogs([]); setQuestions([]); setGurus([]); setForums([]); return; }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const FORUMS_EDGE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/forums-api`;
        const [blogsData, reviewedData, gurusRes, forumsRes] = await Promise.all([
          // Blogs: query directly with RLS (published)
          supabase
            .from("blog_posts")
            .select("id, title, slug, description")
            .eq("status", "published")
            .or(`title.ilike.%${term}%,description.ilike.%${term}%`)
            .order("created_at", { ascending: false })
            .limit(10),
          (async () => {
            try {
              const { data } = await supabase.rpc("list_public_reviewed_questions", { p_q: term, p_limit: 10, p_offset: 0 });
              return data || [];
            } catch { return [] as any[]; }
          })(),
          // Gurus via public edge function (already CORS *):
          getJson(`/consultations-api/api/gurus?q=${encodeURIComponent(term)}`).catch(() => ({ items: [] })),
          // Forums: fetch threads and filter client-side
          fetch(`${FORUMS_EDGE}/api/forum/threads`).then(r => r.json()).catch(() => ({ items: [] })),
        ]);
        if (cancelled) return;
        const blogItems: BlogItem[] = ((blogsData as any)?.data || []).map((b: any) => ({ id: b.id, title: b.title, slug: b.slug, excerpt: b.description || null }));
        setBlogs(blogItems);
        const qItems: ReviewedItem[] = Array.isArray(reviewedData)
          ? (reviewedData as any[]).map((r: any) => ({ id: r.id, stem: r.stem, exam_type: r.exam_type || null }))
          : [];
        setQuestions(qItems);
        const gItems: GuruItem[] = (((gurusRes as any)?.items || gurusRes || []) as any[]).slice(0, 10).map((g: any) => ({ id: g.id || g.user_id, full_name: g.full_name || g.name || 'Guru', specialty: g.specialty || null }));
        setGurus(gItems);
        const forumItems: ForumItem[] = (((forumsRes as any)?.items || []) as any[])
          .filter((t: any) => String(t.title||"").toLowerCase().includes(term.toLowerCase()) || String(t.content||"").toLowerCase().includes(term.toLowerCase()))
          .slice(0, 10)
          .map((t: any) => ({ id: t.id, title: t.title, content: t.content }));
        setForums(forumItems);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(run, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open]);

  const hasResults = useMemo(() => blogs.length + questions.length + gurus.length + forums.length > 0, [blogs, questions, gurus, forums]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Search EM Gurus</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search blogs, forums, reviewed questions, and gurus"
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
          {forums.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><MessageSquare className="h-4 w-4" /> Forums</div>
              <ul className="space-y-1">
                {forums.map((f) => (
                  <li key={f.id}>
                    <button className="w-full text-left rounded-md px-2 py-1 hover:bg-accent" onClick={() => { onOpenChange(false); navigate(`/threads/${f.id}`); }}>
                      <div className="font-medium">{f.title}</div>
                      {f.content && <div className="text-xs text-muted-foreground line-clamp-1">{f.content}</div>}
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
