import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const FORUMS_EDGE = "https://cgtvvpzrzwyvsbavboxa.supabase.co/functions/v1/forums-api";

interface ThreadRow { id: string; title: string; content: string; author_id: string; category_id: string; created_at: string; updated_at: string; }
interface ReplyRow { id: string; thread_id: string; author_id: string; content: string; created_at: string; likes_count?: number; }

export default function ThreadView() {
  const { thread_id } = useParams<{ thread_id: string }>();
  const [thread, setThread] = useState<ThreadRow | null>(null);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);
  const { session } = useAuth();

  useEffect(() => {
    document.title = "Thread | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content','View thread and replies. Join the discussion.');
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, []);

  const load = async () => {
    if (!thread_id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${FORUMS_EDGE}/api/forum/threads/${thread_id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load thread');
      setThread(data.thread);
      const sorted = (data.replies || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setReplies(sorted);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [thread_id]);

  const submitReply = async () => {
    if (!thread_id) return;
    try {
      setPosting(true);
      const res = await fetch(`${FORUMS_EDGE}/api/forum/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ thread_id, content: reply }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to post reply');
      setReply("");
      toast({ title: 'Reply posted' });
      await load();
    } catch (e: any) {
      toast({ title: 'Could not post reply', description: e.message });
    } finally {
      setPosting(false);
    }
  };

  const like = async (replyId: string) => {
    // likes disabled in favor of reactions; no-op for now
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-4">{thread ? (<Link to={`/forums/${thread.category_id}`} className="text-sm no-underline text-foreground/70 hover:text-foreground">← Back to Section</Link>) : (<Link to="/forums" className="text-sm no-underline text-foreground/70 hover:text-foreground">← Back to Forums</Link>)}</div>
      {loading ? (
        <div className="min-h-[30vh] flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>
      ) : error ? (
        <div className="rounded-lg border bg-card p-6">{error}</div>
      ) : thread ? (
        <article className="space-y-4">
          <Card className="p-6">
            <h1 className="text-2xl font-bold mb-2">{thread.title}</h1>
            <div className="text-xs text-muted-foreground mb-3">Posted {new Date(thread.created_at).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            <p className="whitespace-pre-wrap leading-relaxed">{thread.content}</p>
          </Card>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Replies</h2>
            {replies.length === 0 ? (
              <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">No replies yet.</div>
            ) : (
              replies.map(r => (
                <Card key={r.id} className="p-4">
                  <div className="text-sm whitespace-pre-wrap">{r.content}</div>
                  <div className="pt-2 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </Card>
              ))
            )}
          </section>

          <section className="mt-4">
            <h3 className="text-base font-semibold mb-2">Add a reply</h3>
            <div className="grid gap-2">
              <Textarea rows={5} placeholder="Write your reply" value={reply} onChange={(e) => setReply(e.target.value)} />
              <div>
                <Button onClick={submitReply} disabled={posting || reply.trim().length === 0}>{posting ? 'Posting…' : 'Post Reply'}</Button>
              </div>
            </div>
          </section>
        </article>
      ) : null}
    </main>
  );
}
