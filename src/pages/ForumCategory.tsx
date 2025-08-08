import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const FORUMS_EDGE = "https://cgtvvpzrzwyvsbavboxa.supabase.co/functions/v1/forums-api";

interface ThreadRow {
  id: string; title: string; content: string; author_id: string; created_at: string; updated_at: string;
}
interface Category { id: string; title: string; description: string | null; }

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
        <section className="space-y-3">
          {threads.map(t => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link to={`/threads/${t.id}`} className="text-lg font-semibold hover:underline">{t.title}</Link>
                  <p className="text-sm text-muted-foreground line-clamp-2">{t.content}</p>
                  <div className="text-xs text-muted-foreground pt-1">{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <Link to={`/threads/${t.id}`}><Button variant="outline">Open</Button></Link>
                </div>
              </div>
            </Card>
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
