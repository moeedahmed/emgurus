import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";
import { Button } from "@/components/ui/button";

export default function ExamReviewQueue() {
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
        const { data } = await supabase
          .from('exam_questions')
          .select('id, question, difficulty, topic, created_at, status')
          .eq('status', 'pending_review')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (!cancelled) {
          setRows(data || []);
        }
      } catch (error) {
        console.error('Error fetching exam reviews:', error);
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
          { 
            key: 'question', 
            header: 'Question', 
            render: (r: any) => (r.question || '').slice(0, 80) + (r.question?.length > 80 ? '...' : '') 
          },
          { key: 'topic', header: 'Topic' },
          { key: 'difficulty', header: 'Difficulty' },
          { key: 'created_at', header: 'Submitted', render: (r: any) => new Date(r.created_at).toLocaleDateString() },
          { 
            key: 'actions', 
            header: 'Actions', 
            render: (r: any) => (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => window.open(`/guru/review-queue?question=${r.id}`, '_blank')}
              >
                Review
              </Button>
            )
          },
        ]}
        rows={rows}
        emptyText="No questions pending review."
      />
    </div>
  );
}