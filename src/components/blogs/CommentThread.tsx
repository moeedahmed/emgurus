import { useMemo, useState } from "react";
import { commentOnPost } from "@/lib/blogsApi";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentNode {
  id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  author?: { user_id: string; full_name: string; avatar_url: string | null } | null;
  replies?: CommentNode[];
}

export default function CommentThread({
  postId,
  comments,
  onNewComment,
}: {
  postId: string;
  comments: CommentNode[];
  onNewComment: (c: CommentNode) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const roots = useMemo(() => comments.filter(c => !c.parent_id), [comments]);

  const submit = async (parent?: string | null) => {
    const content = (parent ? text.trim() : text.trim());
    if (!content) return;
    try {
      setBusy(true);
      await commentOnPost(postId, content, parent ?? null);
      const c: CommentNode = {
        id: `temp-${Date.now()}`,
        author_id: "me",
        parent_id: parent ?? null,
        content,
        created_at: new Date().toISOString(),
        replies: [],
      };
      onNewComment(c);
      setText("");
      setReplyTo(null);
      toast.success("Comment added");
    } catch (e: any) {
      toast.error(e.message || "Failed to comment");
    } finally {
      setBusy(false);
    }
  };

  const Item = ({ c }: { c: CommentNode }) => (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8">
        <AvatarImage src={c.author?.avatar_url || undefined} alt={c.author?.full_name || "user"} />
        <AvatarFallback>{(c.author?.full_name || "?").slice(0,2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="text-sm font-medium">{c.author?.full_name || "User"}</div>
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{c.content}</div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <button onClick={() => setReplyTo(c.id)} className="hover:underline">Reply</button>
        </div>
        {c.replies && c.replies.length > 0 && (
          <div className="mt-3 space-y-4 border-l pl-4">
            {c.replies.map(r => <Item key={r.id} c={r} />)}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment" />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={() => submit(null)} disabled={busy}>Comment</Button>
        </div>
      </div>
      <div className="space-y-6">
        {roots.map((c) => (
          <div key={c.id} className="space-y-2">
            <Item c={c} />
            {replyTo === c.id && (
              <div className="ml-11">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply" />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => submit(c.id)} disabled={busy}>Reply</Button>
                  <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
