import { useEffect, useMemo, useState } from "react";
import { commentOnPost } from "@/lib/blogsApi";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import AuthGate from "@/components/auth/AuthGate";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  const roots = useMemo(() => comments.filter(c => !c.parent_id && !deletedIds.has(c.id)), [comments, deletedIds]);

  const submit = async (parent?: string | null) => {
    const content = (parent ? text.trim() : text.trim());
    if (!content) return;
    if (!userId) {
      toast.error("Please log in to comment");
      return;
    }
    // Check email verification
    if (!user?.email_confirmed_at) {
      toast.error("Please verify your email to comment");
      return;
    }
    try {
      setBusy(true);
      await commentOnPost(postId, content, parent ?? null);
      const c: CommentNode = {
        id: `temp-${Date.now()}`,
        author_id: userId,
        parent_id: parent ?? null,
        content,
        created_at: new Date().toISOString(),
      };
      onNewComment(c);
      setText("");
      setReplyTo(null);
    } catch (e) {
      console.error(e);
      toast.error("Failed to post comment");
    } finally {
      setBusy(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase.from('blog_comments').delete().eq('id', commentId).eq('author_id', userId);
      if (error) throw error;
      setDeletedIds(prev => new Set([...prev, commentId]));
      toast.success('Comment deleted');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete comment');
    }
  };

  const buildTree = (cs: CommentNode[]): CommentNode[] => {
    const map = new Map<string, CommentNode>();
    cs.forEach(c => map.set(c.id, { ...c, replies: [] }));
    cs.forEach(c => {
      if (c.parent_id && map.has(c.parent_id)) {
        const parent = map.get(c.parent_id)!;
        parent.replies = parent.replies || [];
        parent.replies.push(map.get(c.id)!);
      }
    });
    return cs.filter(c => !c.parent_id);
  };

  const tree = useMemo(() => buildTree(comments), [comments]);

  const Item = ({ c }: { c: CommentNode }) => {
    const isOwner = userId && c.author_id === userId;
    return (
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={c.author?.avatar_url || undefined} />
          <AvatarFallback>{c.author?.full_name?.charAt(0) || '?'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{c.author?.full_name || 'Anonymous'}</span>
            <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
          </div>
          <p className="text-sm mb-2">{c.content}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setReplyTo(c.id)}>Reply</Button>
            {isOwner && (
              <Button size="sm" variant="ghost" onClick={() => deleteComment(c.id)}>Delete</Button>
            )}
          </div>
          {c.replies && c.replies.length > 0 && (
            <div className="mt-3 space-y-4 border-l pl-4">
              {c.replies.filter(r => !deletedIds.has(r.id)).map(r => <Item key={r.id} c={r} />)}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <AuthGate fallback={
        <div className="text-center text-muted-foreground py-4">
          Sign in to join the discussion
        </div>
      }>
        <div className="flex items-start gap-2">
          <Textarea 
            className="flex-1" 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder={user?.email_confirmed_at ? "Add a comment" : "Verify your email to comment"}
            disabled={!user?.email_confirmed_at}
          />
          <Button 
            size="sm" 
            onClick={() => submit(null)} 
            disabled={busy || !user?.email_confirmed_at}
          >
            Comment
          </Button>
        </div>
      </AuthGate>
      <div className="space-y-6">
        {roots.map((c) => (
          <div key={c.id} className="space-y-2">
            <Item c={c} />
            {replyTo === c.id && (
              <AuthGate>
                <div className="ml-11">
                  <Textarea 
                    value={text} 
                    onChange={(e) => setText(e.target.value)} 
                    placeholder={user?.email_confirmed_at ? "Write a reply" : "Verify your email to reply"}
                    disabled={!user?.email_confirmed_at}
                  />
                  <div className="mt-2 flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => submit(c.id)} 
                      disabled={busy || !user?.email_confirmed_at}
                    >
                      Reply
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>Cancel</Button>
                  </div>
                </div>
              </AuthGate>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}