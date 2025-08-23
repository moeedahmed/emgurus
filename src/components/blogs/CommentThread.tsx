import { useEffect, useMemo, useState } from "react";
import { commentOnPost } from "@/lib/blogsApi";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface CommentNode {
  id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  author?: { user_id: string; full_name: string; avatar_url: string | null } | null;
  replies?: CommentNode[];
  reactions?: { up: number; down: number };
  user_reaction?: string | null;
}

export default function CommentThread({
  postId,
  comments: initialComments = [],
  onCommentsChange,
}: {
  postId: string;
  comments?: CommentNode[];
  onCommentsChange?: (comments: CommentNode[]) => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentNode[]>(initialComments);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [feedbackModal, setFeedbackModal] = useState<{ commentId: string; open: boolean }>({ commentId: "", open: false });
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Set<string>>(new Set());

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  const loadComments = async () => {
    try {
      const response = await fetch(`/functions/v1/blogs-api/api/blogs/${postId}/comments`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
        onCommentsChange?.(data.comments || []);
      }
    } catch (error) {
      console.error("Failed to load comments:", error);
    }
  };

  const roots = useMemo(() => comments.filter(c => !c.parent_id && !deletedIds.has(c.id)), [comments, deletedIds]);

  const submit = async (parent?: string | null) => {
    const content = text.trim();
    if (!content) return;
    if (!user?.id) {
      toast.error("Please log in to comment");
      return;
    }
    if (!user?.email_confirmed_at) {
      toast.error("Please verify your email to comment");
      return;
    }
    
    // Optimistic update - add comment instantly
    const optimisticComment = {
      id: `temp-${Date.now()}`,
      author_id: user.id,
      parent_id: parent,
      content,
      created_at: new Date().toISOString(),
      author: {
        user_id: user.id,
        full_name: user.user_metadata?.full_name || 'You',
        avatar_url: user.user_metadata?.avatar_url || null
      },
      replies: [],
      reactions: { up: 0, down: 0 },
      user_reaction: null
    };
    
    const updatedComments = [...comments, optimisticComment];
    setComments(updatedComments);
    onCommentsChange?.(updatedComments);
    setText("");
    setReplyTo(null);
    
    try {
      setBusy(true);
      const response = await fetch(`/functions/v1/blogs-api/api/blogs/${postId}/comment`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ content, parent_id: parent })
      });
      
      if (response.ok) {
        await loadComments(); // Reload to get real data
        toast.success("Comment posted");
      } else {
        // Revert optimistic update on error
        setComments(comments);
        onCommentsChange?.(comments);
        const error = await response.json();
        toast.error(error.error || "Failed to post comment");
      }
    } catch (e) {
      // Revert optimistic update on error
      setComments(comments);
      onCommentsChange?.(comments);
      console.error(e);
      toast.error("Failed to post comment");
    } finally {
      setBusy(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const response = await fetch(`/functions/v1/blogs-api/api/blogs/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        }
      });
      
      if (response.ok) {
        setDeletedIds(prev => new Set([...prev, commentId]));
        await loadComments(); // Reload comments
        toast.success('Comment deleted');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete comment');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete comment');
    }
  };

  const reactToComment = async (commentId: string, type: "up" | "down") => {
    if (!user?.id) {
      toast.error("Please log in to react");
      return;
    }

    if (type === "down") {
      setFeedbackModal({ commentId, open: true });
      return;
    }

    try {
      const response = await fetch(`/functions/v1/blogs-api/api/blogs/comments/${commentId}/react`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ type })
      });
      
      if (response.ok) {
        await loadComments(); // Reload to get updated reaction counts
      } else {
        toast.error("Failed to react");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to react");
    }
  };

  const submitFeedback = async () => {
    if (!feedbackReason && !feedbackText.trim()) {
      toast.error("Please select a reason or provide feedback");
      return;
    }

    try {
      const feedbackMessage = feedbackReason === "other" 
        ? feedbackText.trim() 
        : `${feedbackReason}${feedbackText.trim() ? `: ${feedbackText.trim()}` : ""}`;

      const response = await fetch(`/functions/v1/blogs-api/api/blogs/comments/${feedbackModal.commentId}/react`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ type: "down", feedback: feedbackMessage })
      });
      
      if (response.ok) {
        setFeedbackModal({ commentId: "", open: false });
        setFeedbackReason("");
        setFeedbackText("");
        setFeedbackSubmitted(prev => new Set([...prev, feedbackModal.commentId]));
        await loadComments();
        toast.success("Feedback submitted");
      } else {
        toast.error("Failed to submit feedback");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to submit feedback");
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
    const isOwner = user?.id && c.author_id === user.id;
    const reactions = c.reactions || { up: 0, down: 0 };
    const hasFeedback = feedbackSubmitted.has(c.id);
    
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
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => setReplyTo(c.id)}>Reply</Button>
            {isOwner && (
              <Button size="sm" variant="ghost" onClick={() => deleteComment(c.id)}>Delete</Button>
            )}
            
            {/* Reaction buttons */}
            <div className="flex items-center gap-1 ml-2">
              <Button
                size="sm"
                variant={c.user_reaction === "up" ? "default" : "ghost"}
                onClick={() => reactToComment(c.id, "up")}
                className="h-7 px-2"
              >
                <ThumbsUp className="h-3 w-3 mr-1" />
                {reactions.up > 0 && <span className="text-xs">{reactions.up}</span>}
              </Button>
              <Button
                size="sm"
                variant={c.user_reaction === "down" ? "default" : "ghost"}
                onClick={() => reactToComment(c.id, "down")}
                className="h-7 px-2"
                disabled={hasFeedback}
              >
                <ThumbsDown className="h-3 w-3 mr-1" />
                {reactions.down > 0 && <span className="text-xs">{reactions.down}</span>}
              </Button>
            </div>
          </div>
          {hasFeedback && (
            <p className="text-xs text-muted-foreground mt-2">
              ✓ Feedback sent
            </p>
          )}
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
    <>
      <div className="space-y-6">
        {user ? (
          <div className="flex items-start gap-2">
            {busy ? (
              <div className="flex-1 p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-muted-foreground">Posting comment...</span>
                </div>
              </div>
            ) : (
              <>
                <Textarea 
                  className="flex-1 rounded-2xl" 
                  value={text} 
                  onChange={(e) => setText(e.target.value)} 
                  placeholder={user?.email_confirmed_at ? "Add a comment" : "Verify your email to comment"}
                  disabled={!user?.email_confirmed_at}
                />
                <Button 
                  size="sm" 
                  onClick={() => submit(null)} 
                  disabled={busy || !user?.email_confirmed_at}
                  className="rounded-2xl"
                >
                  Comment
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-4">
            Sign in to join the discussion
          </div>
        )}
        
        <div className="space-y-6">
          {roots.map((c) => (
            <div key={c.id} className="space-y-2">
              <Item c={c} />
              {replyTo === c.id && user && (
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
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Feedback Modal */}
      <Dialog open={feedbackModal.open} onOpenChange={(open) => setFeedbackModal({ ...feedbackModal, open })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Why are you giving this a thumbs down?</DialogTitle>
            <DialogDescription>
              Help us improve by letting us know what's wrong with this comment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={feedbackReason} onValueChange={setFeedbackReason}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unclear" id="unclear" />
                <Label htmlFor="unclear">Unclear or confusing</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="factually wrong" id="wrong" />
                <Label htmlFor="wrong">Factually incorrect</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="inappropriate" id="inappropriate" />
                <Label htmlFor="inappropriate">Inappropriate content</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="other" />
                <Label htmlFor="other">Other</Label>
              </div>
            </RadioGroup>
            
            <div className="space-y-2">
              <Label htmlFor="feedback">Additional feedback (optional)</Label>
              <Textarea
                id="feedback"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Please explain what's wrong..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackModal({ commentId: "", open: false })}>
              Cancel
            </Button>
            <Button onClick={submitFeedback}>Submit Feedback</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}