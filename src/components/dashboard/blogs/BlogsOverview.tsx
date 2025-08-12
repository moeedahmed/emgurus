import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendCard from "@/components/dashboard/TrendCard";
import { Button } from "@/components/ui/button";

export default function BlogsOverview() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [range, setRange] = useState<7 | 30>(7);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setPosts([]); return; }
      setLoading(true);
      try {
        const since = new Date(Date.now() - 90*24*60*60*1000).toISOString();
        const { data } = await supabase
          .from('blog_posts')
          .select('id,status,created_at,updated_at,submitted_at,published_at')
          .eq('author_id', user.id)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(500);
        if (!cancelled) setPosts((data as any[]) || []);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const counts = useMemo(() => {
    const c = { draft: 0, in_review: 0, published: 0, rejected: 0 } as Record<string, number>;
    posts.forEach(p => { c[p.status] = (c[p.status]||0) + 1; });
    // Rejected: drafts with review_notes not null are counted elsewhere in dashboard; keep zero if unknown
    return c;
  }, [posts]);

  const series = useMemo(() => {
    const days = Array.from({ length: range }).map((_, i) => {
      const d = new Date(Date.now() - (range-1-i)*24*60*60*1000);
      const key = d.toISOString().slice(0,10);
      const daily = posts.filter(p => (p.updated_at || p.created_at).slice(0,10) === key).length;
      return { date: d.toLocaleDateString(), value: daily };
    });
    return days;
  }, [posts, range]);

  return (
    <div className="p-4 grid gap-4">
      <div>
        <h3 className="text-lg font-semibold">Overview</h3>
        <p className="text-sm text-muted-foreground">Your blog activity at a glance.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Drafts" value={counts.draft} isLoading={loading} />
        <KpiCard title="Submitted" value={counts.in_review} isLoading={loading} />
        <KpiCard title="Published" value={counts.published} isLoading={loading} />
        <KpiCard title="Rejected" value={counts.rejected} isLoading={loading} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Activity</div>
          <div className="flex gap-2">
            <Button size="sm" variant={range===7?"default":"outline"} onClick={()=>setRange(7)}>7d</Button>
            <Button size="sm" variant={range===30?"default":"outline"} onClick={()=>setRange(30)}>30d</Button>
          </div>
        </div>
        <TrendCard title={`Updates (${range}d)`} series={series} rangeLabel={`Last ${range} days`} isLoading={loading} />
        <div className="text-sm text-muted-foreground mt-2">No complex charts here. <a className="underline" href="/blogs">Go to Blogs</a></div>
      </div>
    </div>
  );
}
