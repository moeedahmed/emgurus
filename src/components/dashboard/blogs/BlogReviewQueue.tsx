import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";
import { Button } from "@/components/ui/button";

export default function BlogReviewQueue() {
  const { user, loading: userLoading } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Guard against loading states
  if (userLoading) {
    return <div className="p-4">Loading review queue…</div>;
  }

  if (!user) {
    return <div className="p-4">Please sign in to view the review queue.</div>;
  }

  useEffect(() => {
    let cancelled = false;
    
    const fetchReviews = async () => {
      try {
        setLoading(true);
        // Query real data from blog_review_assignments joined with blog_posts
        const { data, error } = await supabase
          .from('blog_review_assignments')
          .select(`
            id,
            post_id,
            status,
            created_at,
            blog_posts!inner(
              title,
              status,
              author_id,
              submitted_at
            )
          `)
          .eq('reviewer_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        // Get author info separately
        let authorsMap = new Map();
        if (data && data.length > 0) {
          const authorIds = data.map(a => a.blog_posts.author_id).filter(Boolean);
          if (authorIds.length > 0) {
            const { data: authors } = await supabase
              .from('profiles')
              .select('user_id, full_name')
              .in('user_id', authorIds);
            authorsMap = new Map(authors?.map(a => [a.user_id, a]) || []);
          }
        }

        if (error) throw error;
        
        if (!cancelled) {
          setRows(data?.map(assignment => ({
            id: assignment.post_id,
            title: assignment.blog_posts.title,
            status: assignment.blog_posts.status,
            created_at: assignment.created_at,
            updated_at: assignment.created_at,
            author: authorsMap.get(assignment.blog_posts.author_id)?.full_name || 'Unknown',
            assignment_id: assignment.id
          })) || []);
        }
      } catch (error) {
        console.error('Error fetching blog reviews:', error);
        if (!cancelled) {
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchReviews();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading) {
    return <div className="p-4">Loading reviews...</div>;
  }

  return (
    <div className="p-0">
      {/* Removed duplicate description - handled by WorkspaceLayout */}
      <TableCard
        title="Review Queue"
        columns={[
          { key: 'title', header: 'Title' },
          { key: 'author', header: 'Author' },
          { key: 'created_at', header: 'Assigned', render: (r: any) => new Date(r.created_at).toLocaleDateString() },
          { 
            key: 'actions', 
            header: 'Actions', 
            render: (r: any) => (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => window.open(`/blogs/editor/${r.id}`, '_blank')}
              >
                Review
              </Button>
            )
          },
        ]}
        rows={rows}
        isLoading={loading}
        emptyText="No blogs pending review."
      />
    </div>
  );
}