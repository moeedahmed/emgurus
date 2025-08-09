import { useEffect, useState, useMemo } from "react";
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
import { supabase } from "@/integrations/supabase/client";

const FORUMS_EDGE = "https://cgtvvpzrzwyvsbavboxa.supabase.co/functions/v1/forums-api";

interface Category { id: string; title: string; description: string | null; }

const Forums = () => {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const isNewOpen = searchParams.get('new') === '1';
  useEffect(() => {
    document.title = "Forums | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content','Browse EMGurus forum categories: Study Tips, EM Exams, Clinical Scenarios.');
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${FORUMS_EDGE}/api/forum/categories`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load categories');
        setItems(data.items || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="container mx-auto px-4 py-8">
      <PageHero
        title="EM Gurus Forums"
        subtitle="Discuss by topic or exam. Join the EM community."
        align="left"
        ctas={[{ label: "Start a Thread", href: "?new=1", variant: "outline" }]}
      />

      <CreateThreadGlobal
        open={isNewOpen}
        onClose={() => { const p = new URLSearchParams(searchParams); p.delete('new'); setSearchParams(p); }}
      />

      <h2 className="mt-8 mb-4 text-lg font-semibold">Sections</h2>
      {loading ? (
        <div className="min-h-[30vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : error ? (
        <div className="rounded-lg border bg-card p-6">{error}</div>
      ) : (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Link key={c.id} to={`/forums/${c.id}`} className="block group">
              <Card className="p-6 flex flex-col border-2 transition hover:shadow-md hover:border-primary/20 rounded-xl">
                <h2 className="text-xl font-semibold mb-1 group-hover:text-primary transition-colors">{c.title}</h2>
                <p className="text-muted-foreground flex-1">{c.description || 'Discussion category'}</p>
              </Card>
            </Link>
          ))}
        </section>
      )}
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
            <SelectContent>
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
