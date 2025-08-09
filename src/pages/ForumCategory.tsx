import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const FORUMS_EDGE = "https://cgtvvpzrzwyvsbavboxa.supabase.co/functions/v1/forums-api";

interface ThreadRow {
  id: string; title: string; content: string; author_id: string; created_at: string; updated_at: string;
  author?: { id: string; name: string; avatar_url: string | null };
  reply_count?: number;
}
interface Category { id: string; title: string; description: string | null; }

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ForumCategory() {
  const { category_id } = useParams<{ category_id: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Forum Threads | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content','Browse forum threads in this category.');
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, []);

  const load = async () => {
    if (!category_id) return;
    setLoading(true);
    setError(null);
    try {
      const [catRes, thRes] = await Promise.all([
        fetch(`${FORUMS_EDGE}/api/forum/categories`),
        fetch(`${FORUMS_EDGE}/api/forum/threads?category_id=${category_id}`)
      ]);
      const cat = await catRes.json();
      const th = await thRes.json();
      if (!catRes.ok) throw new Error(cat.error || 'Failed to load categories');
      if (!thRes.ok) throw new Error(th.error || 'Failed to load threads');
      const c: Category | undefined = (cat.items || []).find((x: Category) => x.id === category_id);
      setCategory(c || null);
      const list: ThreadRow[] = (th.items || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setThreads(list);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [category_id]);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <Link to="/forums" className="text-sm no-underline text-foreground/70 hover:text-foreground">← Back to Forums</Link>
      </div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{category?.title || 'Threads'}</h1>
          {category?.description && (
            <p className="text-muted-foreground">{category.description}</p>
          )}
        </div>
        <CreateThreadButton categoryId={category_id!} onCreated={load} />
      </header>

      {loading ? (
        <div className="min-h-[30vh] flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>
      ) : error ? (
        <div className="rounded-lg border bg-card p-6">{error}</div>
      ) : threads.length === 0 ? (
        <div className="rounded-lg border bg-card p-6">No threads yet — be the first to start one!</div>
      ) : (
        <section className="space-y-4 sm:space-y-5">
          {threads.map(t => (
            <Link key={t.id} to={`/threads/${t.id}`} className="block group">
              <Card className="p-5 sm:p-6 border-2 transition hover:shadow-md hover:border-primary/20 rounded-xl">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">{t.title}</h2>
                    <p className="text-sm text-muted-foreground line-clamp-2">{t.content}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={t.author?.avatar_url || undefined} alt={t.author?.name || 'User'} />
                        <AvatarFallback>{(t.author?.name || 'U').slice(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <Link to={t.author ? `/profile/${t.author.id}` : '#'} className="text-xs underline" onClick={(e)=>e.stopPropagation()}>
                        {t.author?.name || 'User'}
                      </Link>
                      <span className="text-xs text-muted-foreground">• {formatDateTime(t.created_at)}</span>
                      <span className="text-xs text-muted-foreground">• {t.reply_count || 0} replies</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

function CreateThreadButton({ categoryId, onCreated }: { categoryId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const { session } = useAuth();

  const disabled = useMemo(() => title.trim().length < 5 || content.trim().length < 10, [title, content]);

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
      setOpen(false);
      setTitle("");
      setContent("");
      onCreated();
    } catch (e: any) {
      toast({ title: 'Could not create thread', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Thread</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new thread</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Input placeholder="Title (min 5 chars)" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Textarea rows={6} placeholder="Write your post (min 10 chars)" value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={disabled || saving}>{saving ? 'Posting…' : 'Post'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
