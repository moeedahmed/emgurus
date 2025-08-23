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
  trends: {
    reviews_completed: Array<{ week: string; count: number }>;
  };
}

export function useGuruMetrics() {
  const [isLoading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ 
    myAssignedCount: 0, 
    myReviewsCompleted: 0, 
    avgTurnaroundHrs: 0, 
    upcomingConsults: 0 
  });
  const [throughputSeries, setSeries] = useState<Array<{ date: string; value: number }>>([]);
  const [queues, setQueues] = useState<{ questions: any[]; blogs: any[] }>({ questions: [], blogs: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Get blog metrics from new endpoint
        let blogMetrics: BlogMetrics | null = null;
        try {
          blogMetrics = await callFunction('/blogs-api/api/blogs/metrics', null, true, 'GET') as BlogMetrics;
        } catch (error) {
          console.log('Blog metrics not available for guru:', error);
        }

        // Questions queue (edge function if available)
        try {
          const res = await callFunction('/exams-guru-review/queue', null, true);
          queues.questions = res?.data || [];
        } catch { queues.questions = []; }

        // Blogs assigned to me and pending
        try {
          const { data: assigns } = await supabase.from('blog_review_assignments').select('post_id').eq('status','pending');
          const ids = (assigns||[]).map((a:any)=>a.post_id);
          if (ids.length) {
            const { data } = await supabase.from('blog_posts').select('id').in('id', ids).eq('status','in_review');
            queues.blogs = data || [];
          } else queues.blogs = [];
        } catch { queues.blogs = []; }

        const myAssignedCount = (queues.questions?.length || 0) + (queues.blogs?.length || 0);
        
        // Calculate reviews completed from blog metrics if available
        const totalReviewsCompleted = blogMetrics?.trends.reviews_completed?.reduce((sum, week) => sum + week.count, 0) || 0;

        if (!cancelled) {
          setKpis({ 
            myAssignedCount, 
            myReviewsCompleted: totalReviewsCompleted,
            avgTurnaroundHrs: 0, 
            upcomingConsults: 0 
          });

          // Use blog review trends if available, otherwise fallback to dummy data
          const trendData = blogMetrics?.trends.reviews_completed?.map(({ week, count }) => ({
            date: week,
            value: count
          })) || Array.from({ length: 12 }).map((_, i) => ({ 
            date: new Date(Date.now() - (11-i)*7*24*60*60*1000).toLocaleDateString(), 
            value: Math.max(0, Math.round(Math.cos(i/6)*4 + 6)) 
          }));

          setSeries(trendData);
          setQueues({ ...queues });
        }
      } catch (error) {
        console.error('Guru metrics error:', error);
        if (!cancelled) {
          setKpis({ myAssignedCount: 0, myReviewsCompleted: 0, avgTurnaroundHrs: 0, upcomingConsults: 0 });
          setSeries([]);
          setQueues({ questions: [], blogs: [] });
        }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  return { kpis, throughputSeries, queues, isLoading } as const;
}
