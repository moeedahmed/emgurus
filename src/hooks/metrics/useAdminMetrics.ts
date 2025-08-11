import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAdminMetrics() {
  const [isLoading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ newUsers7d: 0, postsSubmitted7d: 0, questionsPending: 0, chatErrorRate7d: 0 });
  const [submissionsSeries, setSeries] = useState<Array<{ date: string; value: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // New users past 7d
        const from = new Date(Date.now() - 7*24*60*60*1000).toISOString();
        const { count: users7d } = await supabase.from('profiles').select('user_id', { count: 'exact', head: true }).gte('created_at', from);
        // Posts submitted with status in_review past 7d
        const { count: posts7d } = await supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status','in_review').gte('submitted_at', from);
        // Questions pending (review_exam_questions under_review or draft)
        const { count: qPending } = await supabase.from('review_exam_questions').select('id', { count: 'exact', head: true }).in('status', ['under_review','draft']);
        setKpis({ newUsers7d: users7d ?? 0, postsSubmitted7d: posts7d ?? 0, questionsPending: qPending ?? 0, chatErrorRate7d: 0 });
        // Dummy series
        const days = Array.from({ length: 28 }).map((_, i) => ({ date: new Date(Date.now() - (27-i)*24*60*60*1000).toLocaleDateString(), value: Math.max(0, Math.round(Math.sin(i/5)*5 + 8)) }));
        if (!cancelled) setSeries(days);
      } catch {
        if (!cancelled) { setKpis({ newUsers7d: 0, postsSubmitted7d: 0, questionsPending: 0, chatErrorRate7d: 0 }); setSeries([]); }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  return { kpis, submissionsSeries, isLoading } as const;
}
