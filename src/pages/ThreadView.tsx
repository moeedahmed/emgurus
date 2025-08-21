import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const FORUMS_EDGE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/forums-api`;

interface ThreadRow { id: string; title: string; content: string; author_id: string; category_id: string; created_at: string; updated_at: string; }
interface ReplyRow { id: string; thread_id: string; author_id: string; content: string; created_at: string; likes_count?: number; reaction_counts?: Record<string, number>; user_reactions?: string[]; }

export default function ThreadView() {
  const { thread_id } = useParams<{ thread_id: string }>();
  const [thread, setThread] = useState<ThreadRow | null>(null);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);
  const { session } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const quoteReply = (content: string) => {
    const quoted = `> ${content.replace(/\n/g, '\n> ')}\n\n`;
    setReply(prev => (prev ? prev + '\n\n' : '') + quoted);
    // focus after DOM updates
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  useEffect(() => {
    const title = thread?.title ? `${thread.title} | EMGurus` : 'Thread | EMGurus';
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    const desc = thread?.content ? thread.content.slice(0, 150) : 'View thread and replies. Join the discussion.';
    meta.setAttribute('content', desc);
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, [thread]);

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
    if (!session?.access_token) {
      toast({ title: 'Sign in required', description: 'Please sign in to post a reply.' });
      return;
    }
    if (reply.trim().length < 10) {
      toast({ title: 'Reply too short', description: 'Please write at least 10 characters.' });
      return;
    }
    try {
      setPosting(true);
      const res = await fetch(`${FORUMS_EDGE}/api/forum/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ thread_id, content: reply }),
      });
      if (res.status === 401) {
        toast({ title: 'Sign in required', description: 'Please sign in to post a reply.' });
        return;
      }
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

  const forumReactions = [
    { key: 'like', emoji: '👍', label: 'Like' },
    { key: 'love', emoji: '❤️', label: 'Love' },
    { key: 'insightful', emoji: '💡', label: 'Insightful' },
    { key: 'curious', emoji: '🤔', label: 'Curious' },
  ] as const;

  const hasReacted = (r: ReplyRow, key: string) => (r.user_reactions || []).includes(key);

  const onReact = async (replyId: string, key: string) => {
    try {
      const reacted = replies.find(r => r.id === replyId && hasReacted(r, key));
      // optimistic update
      setReplies(prev => prev.map(r => {
        if (r.id !== replyId) return r;
        const counts = { ...(r.reaction_counts || {}) };
        const user = new Set(r.user_reactions || []);
        if (reacted) {
          counts[key] = Math.max(0, (counts[key] || 0) - 1);
          user.delete(key);
        } else {
          counts[key] = (counts[key] || 0) + 1;
          user.add(key);
        }
        const likes_count = counts['like'] || counts['thumbs_up'] || r.likes_count || 0;
        return { ...r, reaction_counts: counts, user_reactions: Array.from(user), likes_count };
      }));

      const res = await fetch(`${FORUMS_EDGE}/api/forum/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ reply_id: replyId, reaction: key, toggle: true }),
      });
      if (res.status === 401) {
        toast({ title: 'Sign in required', description: 'Please sign in to react to replies.' });
        await load(); // rollback state
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to react');
      }
    } catch (e: any) {
      toast({ title: 'Could not add reaction', description: e.message });
      await load(); // rollback
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-4"><Button variant="outline" asChild><Link to="/forums">Back to Forums</Link></Button></div>
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
                  <div className="mt-2 flex items-center gap-3 flex-wrap">
                    {forumReactions.map(fr => (
                      <Button
                        key={fr.key}
                        variant="ghost"
                        size="sm"
                        onClick={() => onReact(r.id, fr.key)}
                        aria-label={fr.label}
                        className={hasReacted(r, fr.key) ? 'opacity-100' : 'opacity-75'}
                      >
                        <span role="img" aria-label={fr.label}>{fr.emoji}</span>
                        <span className="ml-1 text-xs text-muted-foreground">{(r.reaction_counts?.[fr.key] || 0)}</span>
                      </Button>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => quoteReply(r.content)} aria-label="Reply to this reply">
                      Reply
                    </Button>
                  </div>
                  <div className="pt-2 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </Card>
              ))
            )}
          </section>

          <section className="mt-4">
            <h3 className="text-base font-semibold mb-2">Add a reply</h3>
            {!session ? (
              <div className="rounded-lg border bg-card p-4 text-sm">
                Please sign in to post a reply. <Link to="/auth" className="underline">Sign in</Link>
              </div>
            ) : (
              <div className="grid gap-2">
                <Textarea ref={textareaRef} rows={5} placeholder="Write your reply" value={reply} onChange={(e) => setReply(e.target.value)} />
                <div>
                  <Button onClick={submitReply} disabled={posting || reply.trim().length === 0}>{posting ? 'Posting…' : 'Post Reply'}</Button>
                </div>
              </div>
            )}
          </section>
        </article>
      ) : null}
    </main>
  );
}
