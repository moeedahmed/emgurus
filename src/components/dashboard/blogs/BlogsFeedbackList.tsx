import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";
import { callFunction } from "@/lib/functionsUrl";
import BlogStatusBadge from "./BlogStatusBadge";

export default function BlogsFeedbackList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    
    const loadFeedback = async () => {
      if (!user) { 
        setRows([]);
        setLoading(false);
        return; 
      }
      
      try {
        setLoading(true);
        const response = await callFunction('blogs-api/api/user/feedback', {}, true, 'GET');
        if (!cancelled) {
          setRows(response.items || []);
        }
      } catch (error) {
        console.error('Error loading feedback:', error);
        if (!cancelled) {
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadFeedback();
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <div className="p-0">
      {/* Removed duplicate description - handled by WorkspaceLayout */}
      <TableCard
        title="Feedback"
        columns={[
          { key: 'created_at', header: 'Date', render: (r: any) => new Date(r.created_at).toLocaleString() },
          { key: 'post', header: 'Blog Post', render: (r: any) => r.post?.title || 'Unknown Post' },
          { key: 'message', header: 'Your feedback', render: (r: any) => (r.message || '').slice(0,120) },
          { key: 'status', header: 'Status', render: (r: any) => <BlogStatusBadge status={r.status} /> },
          { key: 'resolution_note', header: 'Response', render: (r: any) => (r.resolution_note || '-').slice(0,120) },
        ] as any}
        rows={rows}
        isLoading={loading}
        emptyText="No feedback yet."
      />
    </div>
  );
}