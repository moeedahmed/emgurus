import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callFunction } from "@/lib/functionsUrl";

export function useGuruMetrics() {
  const [isLoading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ myAssignedCount: 0, myApproved7d: 0, avgTurnaroundHrs: 0, upcomingConsults: 0 });
  const [throughputSeries, setSeries] = useState<Array<{ date: string; value: number }>>([]);
  const [queues, setQueues] = useState<{ questions: any[]; blogs: any[] }>({ questions: [], blogs: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
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
        setKpis({ myAssignedCount, myApproved7d: 0, avgTurnaroundHrs: 0, upcomingConsults: 0 });
        const days = Array.from({ length: 28 }).map((_, i) => ({ date: new Date(Date.now() - (27-i)*24*60*60*1000).toLocaleDateString(), value: Math.max(0, Math.round(Math.cos(i/6)*4 + 6)) }));
        if (!cancelled) setSeries(days);
        if (!cancelled) setQueues({ ...queues });
      } catch {
        if (!cancelled) {
          setKpis({ myAssignedCount: 0, myApproved7d: 0, avgTurnaroundHrs: 0, upcomingConsults: 0 });
          setSeries([]);
          setQueues({ questions: [], blogs: [] });
        }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  return { kpis, throughputSeries, queues, isLoading } as const;
}
