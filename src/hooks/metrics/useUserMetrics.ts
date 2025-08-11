import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUserMetrics() {
  const { user } = useAuth();
  const [isLoading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ attempts7d: 0, accuracy7d: 0, dueSRCount: 0, blogReads7d: 0 });
  const [activitySeries, setSeries] = useState<Array<{ date: string; value: number }>>([]);
  const [drafts, setDrafts] = useState<Array<{ id: string; title: string; updated_at: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Drafts
        if (user) {
          const { data } = await supabase.from('blog_posts').select('id,title,updated_at').eq('author_id', user.id).eq('status','draft').order('updated_at', { ascending: false }).limit(5);
          setDrafts((data as any) || []);
        } else setDrafts([]);
        // Dummy kpis + series
        setKpis({ attempts7d: 0, accuracy7d: 0, dueSRCount: 0, blogReads7d: 0 });
        const days = Array.from({ length: 7 }).map((_, i) => ({ date: new Date(Date.now() - (6-i)*24*60*60*1000).toLocaleDateString(), value: Math.max(0, Math.round(Math.sin(i/2)*3 + 4)) }));
        if (!cancelled) setSeries(days);
      } catch {
        if (!cancelled) { setKpis({ attempts7d: 0, accuracy7d: 0, dueSRCount: 0, blogReads7d: 0 }); setSeries([]); setDrafts([]); }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { kpis, activitySeries, drafts, isLoading } as const;
}
