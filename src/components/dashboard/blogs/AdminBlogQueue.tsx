import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import TableCard from "@/components/dashboard/TableCard";
import { ErrorBoundary } from "react-error-boundary";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { callFunction } from "@/lib/functionsUrl";

interface BlogPost {
  id: string;
  title: string;
  status: string;
  submitted_at: string;
  author?: { display_name?: string; email?: string };
}

function AdminBlogQueueContent() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'submitted' | 'assigned' | 'approved' | 'rejected'>('submitted');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPosts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('blog_posts')
        .select(`
          id,
          title,
          status,
          submitted_at,
          author_id,
          reviewer_id,
          profiles!blog_posts_author_id_fkey(full_name)
        `);

      switch (activeFilter) {
        case 'submitted':
          query = query.eq('status', 'in_review').is('reviewer_id', null);
          break;
        case 'assigned':
          query = query.eq('status', 'in_review').not('reviewer_id', 'is', null);
          break;
        case 'approved':
          query = query.eq('status', 'published');
          break;
        case 'rejected':
          query = query.eq('status', 'archived');
          break;
      }

      const { data, error } = await query
        .order('submitted_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // For assigned posts, also get reviewer info
      let postsWithReviewers = data || [];
      if (activeFilter === 'assigned' && data && data.length > 0) {
        const reviewerIds = data.map(p => p.reviewer_id).filter(Boolean);
        if (reviewerIds.length > 0) {
          const { data: reviewers } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', reviewerIds);

          const reviewerMap = new Map(reviewers?.map(r => [r.user_id, r]) || []);
          postsWithReviewers = data.map(p => ({
            ...p,
            reviewer: p.reviewer_id ? reviewerMap.get(p.reviewer_id) : null
          }));
        }
      }

      setPosts(postsWithReviewers);
    } catch (error) {
      console.error('Failed to load posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [user, activeFilter]);

  const publishPost = async (postId: string) => {
    try {
      const { error } = await supabase.rpc('review_approve_publish', { p_post_id: postId });
      if (error) throw error;
      toast.success('Post published');
      loadPosts();
    } catch (error) {
      console.error('Failed to publish:', error);
      toast.error('Failed to publish post');
    }
  };

  const requestChanges = async (postId: string) => {
    const note = prompt('What changes are needed?') || 'Changes requested';
    if (!note) return;
    
    try {
      await callFunction(`blogs-api/api/blogs/${postId}/request-changes`, { note });
      toast.success('Changes requested');
      loadPosts();
    } catch (error) {
      console.error('Failed to request changes:', error);
      toast.error('Failed to request changes');
    }
  };

  const rejectPost = async (postId: string) => {
    const note = prompt('Reason for rejection:') || 'Post rejected';
    if (!note) return;
    
    try {
      await callFunction(`blogs-api/api/blogs/${postId}/reject`, { note });
      toast.success('Post rejected');
      loadPosts();
    } catch (error) {
      console.error('Failed to reject post:', error);
      toast.error('Failed to reject post');
    }
  };

  const getColumns = () => {
    const baseColumns = [
      { 
        key: 'title', 
        header: 'Title'
      },
      { 
        key: 'author', 
        header: 'Author',
        render: (post: any) => post.profiles?.full_name || 'Unknown'
      },
      { 
        key: 'submitted_at', 
        header: 'Submitted',
        render: (post: any) => new Date(post.submitted_at).toLocaleDateString()
      }
    ];

    // Add reviewer column for assigned posts
    if (activeFilter === 'assigned') {
      baseColumns.push({
        key: 'reviewer',
        header: 'Reviewer',
        render: (post: any) => post.reviewer?.full_name || 'Unassigned'
      });
    }

    if (activeFilter === 'approved') {
      baseColumns.push({
        key: 'actions',
        header: 'Actions',
        render: (post: any) => (
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link to={`/blogs/editor/${post.id}`}>Edit</Link>
            </Button>
            <Button 
              onClick={() => publishPost(post.id)}
              size="sm"
              variant="default"
            >
              Publish
            </Button>
          </div>
        )
      });
    } else if (activeFilter === 'submitted' || activeFilter === 'assigned') {
      baseColumns.push({
        key: 'actions',
        header: 'Actions',
        render: (post: any) => (
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/blogs/editor/${post.id}`}>Review</Link>
            </Button>
            <Button 
              onClick={() => requestChanges(post.id)}
              size="sm"
              variant="secondary"
            >
              Request Changes
            </Button>
            <Button 
              onClick={() => rejectPost(post.id)}
              size="sm"
              variant="destructive"
            >
              Reject
            </Button>
          </div>
        )
      });
    } else {
      baseColumns.push({
        key: 'actions',
        header: 'Actions',
        render: (post: any) => (
          <Button asChild variant="outline" size="sm">
            <Link to={`/blogs/editor/${post.id}`}>Review</Link>
          </Button>
        )
      });
    }

    return baseColumns;
  };

  if (!user) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Please sign in to view the blog queue.</p>
      </Card>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 text-sm text-muted-foreground">
        Review and manage blog submissions.
      </div>
      
      <div className="flex gap-2 mb-4">
        {[
          { id: 'submitted' as const, label: 'Submitted' },
          { id: 'assigned' as const, label: 'Assigned' },
          { id: 'approved' as const, label: 'Approved' },
          { id: 'rejected' as const, label: 'Rejected' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <TableCard
        title="Queue"
        columns={getColumns()}
        rows={posts}
        isLoading={loading}
        emptyText="No posts in this category."
      />
    </div>
  );
}

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <Card className="p-6 text-center">
      <h3 className="text-sm font-medium mb-2">Failed to load blog queue</h3>
      <p className="text-xs text-muted-foreground mb-4">
        {error.message || 'An error occurred'}
      </p>
      <Button size="sm" variant="outline" onClick={resetErrorBoundary}>
        Retry
      </Button>
    </Card>
  );
}

export default function AdminBlogQueue() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AdminBlogQueueContent />
    </ErrorBoundary>
  );
}