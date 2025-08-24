import { useEffect, useMemo, useState } from "react";
import { commentOnPost } from "@/lib/blogsApi";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { callFunction } from "@/lib/functionsUrl";
import { useAuth } from "@/contexts/AuthContext";
import { ThumbsUp, Edit2, Loader2 } from "lucide-react";

interface CommentNode {
  id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at?: string;
  author?: { user_id: string; full_name: string; avatar_url: string | null } | null;
  replies?: CommentNode[];
  reactions?: { up: number };
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
  const [loading, setLoading] = useState(false);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [reactingIds, setReactingIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialComments.length > 0) {
      setComments(initialComments);
    } else {
      loadComments();
    }
  }, [postId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      setErrors(prev => ({ ...prev, load: '' }));
      
      const data = await callFunction(`/blogs-api/api/blogs/${postId}/comments`, undefined, !!user, 'GET');
      setComments(data.comments || []);
      onCommentsChange?.(data.comments || []);
    } catch (error: any) {
      console.error("Failed to load comments:", error);
      let errorMsg = 'Failed to load comments - please try again';
      
      // Parse specific error messages from backend
      if (error.message?.includes('Post not found')) {
        errorMsg = 'Post not found or not published';
      } else if (error.message?.includes('Authentication required')) {
        errorMsg = 'Authentication required';
      }
      
      setErrors(prev => ({ ...prev, load: errorMsg }));
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const roots = useMemo(() => comments.filter(c => !c.parent_id), [comments]);

  const submitComment = async (content: string, parentId?: string | null) => {
    if (!content.trim()) return;
    if (!user?.id) {
      toast.error("Please log in to comment");
      return;
    }
    if (!user?.email_confirmed_at) {
      toast.error("Please verify your email to comment");
      return;
    }
    
    // Clear any previous errors
    setErrors(prev => ({ ...prev, submit: '' }));
    
    // Optimistic update
    const optimisticComment = {
      id: `temp-${Date.now()}`,
      author_id: user.id,
      parent_id: parentId || null,
      content: content.trim(),
      created_at: new Date().toISOString(),
      author: {
        user_id: user.id,
        full_name: user.user_metadata?.full_name || 'You',
        avatar_url: user.user_metadata?.avatar_url || null
      },
      replies: [],
      reactions: { up: 0 },
      user_reaction: null
    };
    
    const updatedComments = [...comments, optimisticComment];
    setComments(updatedComments);
    onCommentsChange?.(updatedComments);
    
    // Clear inputs
    if (parentId) {
      setReplyTexts(prev => ({ ...prev, [parentId]: '' }));
      setReplyingTo(prev => ({ ...prev, [parentId]: false }));
    } else {
      setText("");
    }
    
    try {
      setBusy(true);
      
      await callFunction(`/blogs-api/api/blogs/${postId}/comment`, { 
        content: content.trim(), 
        parent_id: parentId 
      });
      
      await loadComments();
      toast.success("Comment posted");
    } catch (error: any) {
      // Revert optimistic update
      setComments(comments);
      onCommentsChange?.(comments);
      
      let errorMsg = "Failed to post comment";
      if (error.message?.includes('Authentication required')) {
        errorMsg = 'Please log in to comment';
      } else if (error.message?.includes('Replies to replies not allowed')) {
        errorMsg = 'Replies to replies not allowed';
      } else if (error.message?.includes('Post not found')) {
        errorMsg = 'Post not found or not published';
      }
      
      setErrors(prev => ({ ...prev, submit: errorMsg }));
      toast.error(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    setDeletingIds(prev => new Set([...prev, commentId]));
    setErrors(prev => ({ ...prev, [commentId]: '' }));
    
    // Optimistic update - remove comment
    const originalComments = [...comments];
    const updatedComments = comments.filter(c => c.id !== commentId);
    setComments(updatedComments);
    onCommentsChange?.(updatedComments);
    
    try {
      await callFunction(`/blogs-api/api/blogs/comments/${commentId}`, undefined, true, 'DELETE');
      toast.success('Comment deleted');
      await loadComments(); // Reload to ensure consistency
    } catch (error: any) {
      // Revert optimistic update
      setComments(originalComments);
      onCommentsChange?.(originalComments);
      
      let errorMsg = 'Failed to delete comment';
      if (error.message?.includes('Authentication required')) {
        errorMsg = 'Authentication required';
      } else if (error.message?.includes('Not found')) {
        errorMsg = 'Comment not found';
      }
      
      setErrors(prev => ({ ...prev, [commentId]: errorMsg }));
      toast.error(errorMsg);
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    }
  };

  const reactToComment = async (commentId: string) => {
    if (!user?.id) {
      toast.error("Please log in to react");
      return;
    }

    setReactingIds(prev => new Set([...prev, commentId]));
    setErrors(prev => ({ ...prev, [commentId]: '' }));

    // Optimistic update
    const originalComments = [...comments];
    const updatedComments = comments.map(c => {
      if (c.id === commentId) {
        const wasLiked = c.user_reaction === "up";
        return {
          ...c,
          reactions: { up: (c.reactions?.up || 0) + (wasLiked ? -1 : 1) },
          user_reaction: wasLiked ? null : "up"
        };
      }
      return c;
    });
    setComments(updatedComments);
    onCommentsChange?.(updatedComments);

    try {
      await callFunction(`/blogs-api/api/blogs/comments/${commentId}/react`, { type: "up" });
      await loadComments(); // Get real data
    } catch (error: any) {
      // Revert optimistic update
      setComments(originalComments);
      onCommentsChange?.(originalComments);
      
      let errorMsg = "Failed to react";
      if (error.message?.includes('Authentication required')) {
        errorMsg = 'Please log in to react';
      }
      
      setErrors(prev => ({ ...prev, [commentId]: errorMsg }));
      toast.error(errorMsg);
    } finally {
      setReactingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    }
  };

  const editComment = async (commentId: string, newContent: string) => {
    if (!newContent.trim()) {
      setErrors(prev => ({ ...prev, [commentId]: 'Comment cannot be empty' }));
      return;
    }

    setErrors(prev => ({ ...prev, [commentId]: '' }));
    
    // Optimistic update
    const originalComments = [...comments];
    const updatedComments = comments.map(c => 
      c.id === commentId 
        ? { ...c, content: newContent.trim(), updated_at: new Date().toISOString() }
        : c
    );
    setComments(updatedComments);
    onCommentsChange?.(updatedComments);
    setEditingId(null);

    try {
      await callFunction(`/blogs-api/api/blogs/comments/${commentId}`, { content: newContent.trim() }, true, 'PUT');
      toast.success("Comment updated");
      await loadComments(); // Get real data
    } catch (error: any) {
      // Revert optimistic update
      setComments(originalComments);
      onCommentsChange?.(originalComments);
      setEditingId(commentId);
      
      let errorMsg = "Failed to update comment";
      if (error.message?.includes('Authentication required')) {
        errorMsg = 'Authentication required';
      } else if (error.message?.includes('Not found')) {
        errorMsg = 'Comment not found';
      }
      
      setErrors(prev => ({ ...prev, [commentId]: errorMsg }));
      toast.error(errorMsg);
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

  const startReply = (commentId: string) => {
    setReplyingTo(prev => ({ ...prev, [commentId]: true }));
    setReplyTexts(prev => ({ ...prev, [commentId]: prev[commentId] || '' }));
  };

  const cancelReply = (commentId: string) => {
    setReplyingTo(prev => ({ ...prev, [commentId]: false }));
    setReplyTexts(prev => ({ ...prev, [commentId]: '' }));
  };

  const startEdit = (comment: CommentNode) => {
    setEditingId(comment.id);
    setEditText(comment.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const Item = ({ c }: { c: CommentNode }) => {
    const isOwner = user?.id && c.author_id === user.id;
    const reactions = c.reactions || { up: 0 };
    const isDeleting = deletingIds.has(c.id);
    const isReacting = reactingIds.has(c.id);
    const isReplying = replyingTo[c.id];
    const replyText = replyTexts[c.id] || '';
    const isEditing = editingId === c.id;
    const hasError = errors[c.id];
    
    return (
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={c.author?.avatar_url || undefined} />
          <AvatarFallback className="bg-muted text-xs">
            {c.author?.full_name?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm">{c.author?.full_name || 'Anonymous'}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(c.created_at).toLocaleDateString()}
              {c.updated_at && c.updated_at !== c.created_at && (
                <span className="ml-1">(edited)</span>
              )}
            </span>
          </div>
          
          {isDeleting ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Deleting comment...</span>
            </div>
          ) : isEditing ? (
            <div className="space-y-2">
              <Textarea 
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="min-h-[80px] text-sm"
                placeholder="Edit your comment..."
              />
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => editComment(c.id, editText)}
                  disabled={!editText.trim()}
                  className="h-7"
                >
                  Save
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={cancelEdit}
                  className="h-7"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm leading-relaxed">{c.content}</p>
              
              {hasError && (
                <p className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
                  {hasError}
                </p>
              )}
              
              <div className="flex items-center gap-2 flex-wrap">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => startReply(c.id)}
                  className="h-7 px-2 text-xs transition-all duration-200 hover:scale-105"
                >
                  Reply
                </Button>
                
                {isOwner && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => startEdit(c)}
                    className="h-7 px-2 text-xs transition-all duration-200 hover:scale-105"
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                )}
                
                {isOwner && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => deleteComment(c.id)}
                    disabled={isDeleting}
                    className="h-7 px-2 text-xs transition-all duration-200 hover:scale-105 hover:bg-destructive/10 hover:text-destructive"
                  >
                    Delete
                  </Button>
                )}
                
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    size="sm"
                    variant={c.user_reaction === "up" ? "default" : "ghost"}
                    onClick={() => reactToComment(c.id)}
                    disabled={isReacting}
                    className="h-7 px-2 transition-all duration-200 hover:scale-105 hover:bg-green-500/10 hover:text-green-600"
                  >
                    {isReacting ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <ThumbsUp className="h-3 w-3 mr-1" />
                    )}
                    {reactions.up > 0 && <span className="text-xs">{reactions.up}</span>}
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Reply form */}
          {isReplying && (
            <div className="mt-3 space-y-2 border-l-2 border-muted pl-4">
              <Textarea 
                value={replyText}
                onChange={(e) => setReplyTexts(prev => ({ ...prev, [c.id]: e.target.value }))}
                placeholder="Write a reply..."
                className="min-h-[60px] text-sm"
                disabled={!user?.email_confirmed_at}
              />
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => submitComment(replyText, c.id)}
                  disabled={busy || !replyText.trim() || !user?.email_confirmed_at}
                  className="h-7"
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Reply
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => cancelReply(c.id)}
                  className="h-7"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          
          {/* Nested replies */}
          {c.replies && c.replies.length > 0 && (
            <div className="mt-4 space-y-4 border-l-2 border-muted pl-4 ml-2">
              {c.replies.map(r => <Item key={r.id} c={r} />)}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto mt-8 space-y-6">
      <h3 className="text-xl font-semibold">Comments</h3>
      
      {user ? (
        <div className="bg-card border rounded-2xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-muted">
                {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={user?.email_confirmed_at ? "Share your thoughts..." : "Verify your email to comment"}
                disabled={!user?.email_confirmed_at}
                className="min-h-[100px] resize-none border-0 bg-muted/50 focus:bg-background transition-colors"
              />
              {errors.submit && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg flex items-start justify-between">
                  <span>{errors.submit}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setErrors(prev => ({ ...prev, submit: '' }))}
                    className="h-auto p-1 text-xs hover:bg-destructive/20"
                  >
                    ✕
                  </Button>
                </div>
              )}
              <div className="flex justify-end">
                <Button 
                  onClick={() => submitComment(text)}
                  disabled={!text.trim() || busy || !user?.email_confirmed_at}
                  className="transition-all duration-200 hover:scale-105"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    'Post Comment'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-muted/30 border rounded-2xl p-6 text-center">
          <p className="text-muted-foreground">Please sign in to join the discussion.</p>
        </div>
      )}
      
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-3 animate-pulse">
                  <div className="w-8 h-8 bg-muted rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-muted rounded w-1/4" />
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded w-full" />
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-6 bg-muted rounded w-12" />
                      <div className="h-6 bg-muted rounded w-12" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : errors.load ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 text-center">
            <p className="text-destructive mb-3">{errors.load}</p>
            <Button 
              variant="outline" 
              onClick={() => loadComments()}
              className="transition-all duration-200 hover:scale-105"
            >
              Try Again
            </Button>
          </div>
        ) : tree.length === 0 ? (
          <div className="bg-muted/30 border rounded-2xl p-6 text-center">
            <p className="text-muted-foreground">No comments yet. Be the first to share your thoughts!</p>
          </div>
        ) : (
          tree.map((comment) => (
            <div key={comment.id} className="bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <Item c={comment} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}