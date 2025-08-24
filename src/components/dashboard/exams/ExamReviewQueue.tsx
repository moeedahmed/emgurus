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
        
        // Get questions assigned to this reviewer
        const { data: assignments } = await supabase
          .from('exam_review_assignments')
          .select(`
            question_id,
            status,
            assigned_at,
            review_exam_questions (
              id,
              question,
              exam_type,
              created_at,
              status
            )
          `)
          .eq('reviewer_id', user.id)
          .eq('status', 'pending_review')
          .order('assigned_at', { ascending: false })
          .limit(50);
        
        const reviewRows = (assignments || []).map((a: any) => ({
          id: a.review_exam_questions?.id,
          question: a.review_exam_questions?.question,
          exam_type: a.review_exam_questions?.exam_type,
          created_at: a.review_exam_questions?.created_at,
          status: a.status,
          assigned_at: a.assigned_at
        })).filter(r => r.id);
        
        if (!cancelled) {
          setRows(reviewRows);
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
          { key: 'exam_type', header: 'Exam Type' },
          { key: 'status', header: 'Status' },
          { key: 'assigned_at', header: 'Assigned', render: (r: any) => r.assigned_at ? new Date(r.assigned_at).toLocaleDateString() : 'N/A' },
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