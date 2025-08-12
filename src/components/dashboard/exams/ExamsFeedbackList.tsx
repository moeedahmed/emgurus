import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";

export default function ExamsFeedbackList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setRows([]); return; }
      const { data } = await (supabase as any)
        .from('exam_question_flags')
        .select('id, created_at, question_id, comment, status, resolution_note')
        .eq('flagged_by', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      setRows((data as any[]) || []);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <div className="p-4">
      <div className="mb-2 text-sm text-muted-foreground">Question feedback you’ve sent.</div>
      <TableCard
        title="My Feedback"
        columns={[
          { key: 'created_at', header: 'Date', render: (r: any) => new Date(r.created_at).toLocaleString() },
          { key: 'question', header: 'Question', render: (r: any) => r.question_id },
          { key: 'your', header: 'Your feedback', render: (r: any) => (r.comment || '').slice(0,120) },
          { key: 'status', header: 'Status' },
          { key: 'reply', header: 'Response', render: (r: any) => (r.resolution_note || '-').slice(0,120) },
        ] as any}
        rows={rows}
        emptyText="No feedback yet."
      />
    </div>
  );
}
