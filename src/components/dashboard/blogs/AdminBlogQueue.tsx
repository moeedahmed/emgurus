import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TableCard from "@/components/dashboard/TableCard";
import { ErrorBoundary } from "react-error-boundary";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { callFunction } from "@/lib/functionsUrl";

interface BlogPost {
  id: string;
  title: string;
  status: string;
  submitted_at: string;
  author?: { display_name?: string; email?: string };
  reviewers?: Array<{ full_name: string; user_id: string }>;
}

function AdminBlogQueueContent() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'submitted' | 'assigned' | 'approved' | 'rejected'>('submitted');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [gurus, setGurus] = useState<Array<{ user_id: string; full_name: string }>>([]);
  const [selectedGuru, setSelectedGuru] = useState<string>("");
  const [assigning, setAssigning] = useState<string | null>(null);

  const loadPosts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let postsQuery;
      
      switch (activeFilter) {
        case 'submitted':
          // Get posts with no assignments
          const { data: assignedPostIds } = await supabase
            .from('blog_review_assignments')
            .select('post_id')
            .eq('status', 'pending');
          
          const assignedIds = (assignedPostIds || []).map(a => a.post_id);
          
          postsQuery = supabase
            .from('blog_posts')
            .select(`
              id,
              title,
              status,
              submitted_at,
              author_id,
              profiles!blog_posts_author_id_fkey(full_name)
            `)
            .eq('status', 'in_review');
            
          if (assignedIds.length > 0) {
            postsQuery = postsQuery.not('id', 'in', `(${assignedIds.join(',')})`);
          }
          break;
        case 'assigned':
          // Get assigned post IDs first
          const { data: pendingAssignments } = await supabase
            .from('blog_review_assignments')
            .select('post_id')
            .eq('status', 'pending');
          
          const pendingIds = (pendingAssignments || []).map(a => a.post_id);
          
          if (pendingIds.length === 0) {
            // No assigned posts
            postsQuery = supabase
              .from('blog_posts')
              .select(`
                id,
                title,
                status,
                submitted_at,
                author_id,
                profiles!blog_posts_author_id_fkey(full_name)
              `)
              .eq('id', '00000000-0000-0000-0000-000000000000'); // No results
          } else {
            postsQuery = supabase
              .from('blog_posts')
              .select(`
                id,
                title,
                status,
                submitted_at,
                author_id,
                profiles!blog_posts_author_id_fkey(full_name)
              `)
              .eq('status', 'in_review')
              .in('id', pendingIds);
          }
          break;
        case 'approved':
          postsQuery = supabase
            .from('blog_posts')
            .select(`
              id,
              title,
              status,
              submitted_at,
              author_id,
              profiles!blog_posts_author_id_fkey(full_name)
            `)
            .eq('status', 'published');
          break;
        case 'rejected':
          postsQuery = supabase
            .from('blog_posts')
            .select(`
              id,
              title,
              status,
              submitted_at,
              author_id,
              profiles!blog_posts_author_id_fkey(full_name)
            `)
            .eq('status', 'archived');
          break;
      }

      const { data, error } = await postsQuery
        .order('submitted_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // For assigned posts, get reviewer info
      let postsWithReviewers = data || [];
      if (activeFilter === 'assigned' && data && data.length > 0) {
        const postIds = data.map(p => p.id);
        const { data: assignments } = await supabase
          .from('blog_review_assignments')
          .select(`
            post_id,
            reviewer_id
          `)
          .in('post_id', postIds)
          .eq('status', 'pending');

        // Get reviewer profiles separately
        const reviewerIds = (assignments || []).map(a => a.reviewer_id).filter(Boolean);
        const { data: reviewerProfiles } = reviewerIds.length > 0 ? await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', reviewerIds) : { data: [] };

        const profileMap = new Map((reviewerProfiles || []).map(p => [p.user_id, p]));

        // Group reviewers by post
        const reviewerMap = new Map<string, Array<{ full_name: string; user_id: string }>>();
        for (const assignment of assignments || []) {
          const existing = reviewerMap.get(assignment.post_id) || [];
          const profile = profileMap.get(assignment.reviewer_id);
          if (profile) {
            existing.push(profile);
          }
          reviewerMap.set(assignment.post_id, existing);
        }

        postsWithReviewers = data.map(p => ({
          ...p,
          reviewers: reviewerMap.get(p.id) || []
        }));
      }

      setPosts(postsWithReviewers);
    } catch (error) {
      console.error('Failed to load posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadGurus = async () => {
    try {
      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'guru');

      if (error) throw error;
      
      const guruIds = (userRoles || []).map(ur => ur.user_id);
      if (guruIds.length === 0) {
        setGurus([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', guruIds);
      
      const guruList = (profiles || [])
        .filter(p => p.full_name)
        .map(p => ({
          user_id: p.user_id,
          full_name: p.full_name
        }));
      
      setGurus(guruList);
    } catch (error) {
      console.error('Failed to load gurus:', error);
    }
  };

  useEffect(() => {
    loadPosts();
    loadGurus();
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

  const assignReviewer = async (postId: string) => {
    if (!selectedGuru) {
      toast.error('Please select a reviewer');
      return;
    }

    setAssigning(postId);
    try {
      await callFunction(`blogs-api/api/blogs/${postId}/assign`, { 
        reviewer_id: selectedGuru,
        note: `Assigned to ${gurus.find(g => g.user_id === selectedGuru)?.full_name || 'reviewer'}`
      });
      toast.success('Reviewer assigned');
      setSelectedGuru("");
      loadPosts();
    } catch (error) {
      console.error('Failed to assign reviewer:', error);
      toast.error('Failed to assign reviewer');
    } finally {
      setAssigning(null);
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
        key: 'reviewers',
        header: 'Reviewers',
        render: (post: any) => {
          if (!post.reviewers || post.reviewers.length === 0) return 'No reviewers';
          return post.reviewers.map((r: any) => r.full_name).join(', ');
        }
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
    } else if (activeFilter === 'submitted') {
      baseColumns.push({
        key: 'actions',
        header: 'Actions',
        render: (post: any) => (
          <div className="flex gap-2 items-center">
            <Select value={selectedGuru} onValueChange={setSelectedGuru}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select guru" />
              </SelectTrigger>
              <SelectContent>
                {gurus.map(guru => (
                  <SelectItem key={guru.user_id} value={guru.user_id}>
                    {guru.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={() => assignReviewer(post.id)}
              size="sm"
              variant="default"
              disabled={!selectedGuru || assigning === post.id}
            >
              {assigning === post.id ? 'Assigning...' : 'Assign'}
            </Button>
          </div>
        )
      });
    } else if (activeFilter === 'assigned') {
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
    <div className="p-0">
      {/* Removed duplicate description - handled by WorkspaceLayout */}
      
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