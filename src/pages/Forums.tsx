import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Link, useSearchParams } from "react-router-dom";
import PageHero from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ForumsFilterPanel from "@/components/forums/ForumsFilterPanel";

const FORUMS_EDGE = "https://cgtvvpzrzwyvsbavboxa.supabase.co/functions/v1/forums-api";

interface Category { id: string; title: string; description: string | null }
interface ThreadRow {
  id: string;
  category_id: string;
  author_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: { id: string; name: string; avatar_url: string | null };
  reply_count?: number;
  topics?: string[]; // optional future support
}

const Forums = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const isNewOpen = searchParams.get('new') === '1';

  const [categories, setCategories] = useState<Category[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState<string>(searchParams.get('q') || "");
  const [section, setSection] = useState<string>(searchParams.get('section') || "");
  const [topic, setTopic] = useState<string>(searchParams.get('topic') || "");

  useEffect(() => {
    document.title = "Forums | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content','Browse all EMGurus forum threads. Filter by section.');
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, []);

  // Load categories and latest threads
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [catRes, thRes] = await Promise.all([
          fetch(`${FORUMS_EDGE}/api/forum/categories`),
          fetch(`${FORUMS_EDGE}/api/forum/threads`),
        ]);
        const cats = await catRes.json();
        const ths = await thRes.json();
        if (!catRes.ok) throw new Error(cats.error || 'Failed to load categories');
        if (!thRes.ok) throw new Error(ths.error || 'Failed to load threads');
        setCategories(cats.items || []);
        const list: ThreadRow[] = (ths.items || []).sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        setThreads(list);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Derived
  const categoryMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c.title])), [categories]);
  const topicsAll = useMemo(() => Array.from(new Set(threads.flatMap(t => t.topics || []))).sort(), [threads]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    q ? params.set('q', q) : params.delete('q');
    section ? params.set('section', section) : params.delete('section');
    topic ? params.set('topic', topic) : params.delete('topic');
    setSearchParams(params, { replace: true });
  }, [q, section, topic]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return threads.filter(t =>
      (!section || t.category_id === section) &&
      (!topic || (t.topics || []).includes(topic)) &&
      (!qq || t.title.toLowerCase().includes(qq) || t.content.toLowerCase().includes(qq))
    );
  }, [threads, q, section, topic]);

  return (
    <main>
      <PageHero
        title="EMGurus Forums"
        subtitle="All threads. Filter by section, or start a new discussion."
        align="center"
        ctas={[{ label: "Start a Thread", href: "?new=1", variant: "outline" }]}
      />

      <section className="container mx-auto px-4 py-8">
        <CreateThreadGlobal
          open={isNewOpen}
          onClose={() => { const p = new URLSearchParams(searchParams); p.delete('new'); setSearchParams(p); }}
        />

        <div className="lg:grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <ForumsFilterPanel
              q={q}
              section={section}
              sections={categories.map(c => ({ id: c.id, title: c.title }))}
              topics={topicsAll}
              onChange={(k, v) => {
                if (k === 'q') setQ(v);
                if (k === 'section') setSection(v);
                if (k === 'topic') setTopic(v);
              }}
              onReset={() => { setQ(''); setSection(''); setTopic(''); }}
            />
          </aside>

          {/* Main */}
          <div>
            {/* Filters Button (mobile only) */}
            <div className="mb-4 lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Filters</Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 sm:w-96">
                  <ForumsFilterPanel
                    q={q}
                    section={section}
                    sections={categories.map(c => ({ id: c.id, title: c.title }))}
                    topics={topicsAll}
                    onChange={(k, v) => {
                      if (k === 'q') setQ(v);
                      if (k === 'section') setSection(v);
                      if (k === 'topic') setTopic(v);
                    }}
                    onReset={() => { setQ(''); setSection(''); setTopic(''); }}
                  />
                </SheetContent>
              </Sheet>
            </div>

            {/* Active filters row */}
            {(section || topic) && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {section && (
                  <Button size="sm" variant="secondary" aria-pressed className="rounded-full" onClick={() => setSection("")}>Section ×</Button>
                )}
                {topic && (
                  <Button size="sm" variant="secondary" aria-pressed className="rounded-full" onClick={() => setTopic("")}>Topic: {topic} ×</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => { setQ(""); setSection(""); setTopic(""); }}>Clear all</Button>
              </div>
            )}

            {/* Results */}
            {loading ? (
              <div className="min-h-[30vh] flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
            ) : error ? (
              <div className="rounded-lg border bg-card p-6">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">No threads found. Try different filters.</div>
            ) : (
              <section className="space-y-4">
                {filtered.map((t) => (
                  <Link key={t.id} to={`/threads/${t.id}`} className="block group">
                    <Card className="p-5 border-2 transition hover:shadow-md hover:border-primary/20 rounded-xl">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">{t.title}</h2>
                          <p className="text-sm text-muted-foreground line-clamp-2">{t.content}</p>
                          <div className="flex flex-wrap items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                            {/* Section tag */}
                            <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setSection(t.category_id)}>
                              {categoryMap[t.category_id] || 'Section'}
                            </Badge>
                            {/* Topic tags if available */}
                            {(t.topics || []).slice(0, 4).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs cursor-pointer" onClick={() => setTopic(tag)}>
                                #{tag}
                              </Badge>
                            ))}
                            {(t.topics || []).length > 4 && (
                              <Badge variant="outline" className="text-xs">+{(t.topics || []).length - 4}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={t.author?.avatar_url || undefined} alt={t.author?.name || 'User'} />
                              <AvatarFallback>{(t.author?.name || 'U').slice(0,2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span>{t.author?.name || 'User'}</span>
                            <span>• {new Date(t.created_at).toLocaleDateString()}</span>
                            <span>• {t.reply_count || 0} replies</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </section>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

function CreateThreadGlobal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await fetch(`${FORUMS_EDGE}/api/forum/categories`);
        const data = await res.json();
        setCategories(data.items || []);
      } catch {}
    })();
  }, [open]);

  const disabled = title.trim().length < 5 || content.trim().length < 10 || !categoryId;

  const submit = async () => {
    try {
      setSaving(true);
      const res = await fetch(`${FORUMS_EDGE}/api/forum/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ category_id: categoryId, title, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create thread');
      toast({ title: 'Thread created' });
      setTitle("");
      setContent("");
      setCategoryId("");
      onClose();
    } catch (e: any) {
      toast({ title: 'Could not create thread', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new thread</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger aria-label="Section">
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent className="z-50">
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Title (min 5 chars)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={6} placeholder="Write your post (min 10 chars)" value={content} onChange={(e) => setContent(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={disabled || saving}>{saving ? 'Posting…' : 'Post'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Forums;
