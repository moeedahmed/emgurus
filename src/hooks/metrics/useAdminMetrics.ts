import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callFunction } from "@/lib/functionsUrl";

interface BlogMetrics {
  kpis: {
    submitted: number;
    assigned: number;
    published: number;
    rejected: number;
    turnaround_avg_days: number;
  };
  workload: {
    total_active_assignments: number;
    per_guru: Array<{
      guru_id: string;
      name: string;
      active_assignments: number;
    }>;
  };
  trends: {
    submissions: Array<{ week: string; count: number }>;
    publications: Array<{ week: string; count: number }>;
    reviews_completed: Array<{ week: string; count: number }>;
  };
}

export function useAdminMetrics() {
  const [isLoading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ 
    newUsers7d: 0, 
    postsSubmitted: 0, 
    postsAssigned: 0,
    postsPublished: 0, 
    postsRejected: 0,
    questionsPending: 0, 
    avgTurnaroundDays: 0 
  });
  const [submissionsSeries, setSeries] = useState<Array<{ date: string; value: number }>>([]);
  const [workload, setWorkload] = useState<BlogMetrics['workload']>({ total_active_assignments: 0, per_guru: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Get blog metrics from new endpoint
        const blogMetrics = await callFunction('/blogs-api/api/blogs/metrics', null, true, 'GET') as BlogMetrics;
        
        // Get other admin metrics
        const from = new Date(Date.now() - 7*24*60*60*1000).toISOString();
        const [{ count: users7d }, { count: qPending }] = await Promise.all([
          supabase.from('profiles').select('user_id', { count: 'exact', head: true }).gte('created_at', from),
          supabase.from('review_exam_questions').select('id', { count: 'exact', head: true }).in('status', ['under_review','draft'])
        ]);

        if (!cancelled) {
          setKpis({ 
            newUsers7d: users7d ?? 0,
            postsSubmitted: blogMetrics.kpis.submitted,
            postsAssigned: blogMetrics.kpis.assigned,
            postsPublished: blogMetrics.kpis.published,
            postsRejected: blogMetrics.kpis.rejected,
            questionsPending: qPending ?? 0,
            avgTurnaroundDays: blogMetrics.kpis.turnaround_avg_days
          });

          // Convert weekly trends to daily format for chart
          const trendData = blogMetrics.trends.submissions.map(({ week, count }, index) => ({
            date: week,
            value: count
          }));
          setSeries(trendData);
          setWorkload(blogMetrics.workload);
        }
      } catch (error) {
        console.error('Admin metrics error:', error);
        if (!cancelled) { 
          setKpis({ newUsers7d: 0, postsSubmitted: 0, postsAssigned: 0, postsPublished: 0, postsRejected: 0, questionsPending: 0, avgTurnaroundDays: 0 }); 
          setSeries([]); 
          setWorkload({ total_active_assignments: 0, per_guru: [] });
        }
      } finally { 
        if (!cancelled) setLoading(false); 
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { kpis, submissionsSeries, workload, isLoading } as const;
}
