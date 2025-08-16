import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendCard from "@/components/dashboard/TrendCard";

export default function BlogAnalytics() {
  const { user, loading: userLoading } = useAuth();
  const [stats, setStats] = useState({
    totalBlogs: 0,
    totalViews: 0,
    totalLikes: 0,
    averageViews: 0
  });

  // Guard against loading states
  if (userLoading) {
    return <div className="p-4">Loading analytics…</div>;
  }

  if (!user) {
    return <div className="p-4">Please sign in to view analytics.</div>;
  }

  useEffect(() => {
    let cancelled = false;
    
    const fetchAnalytics = async () => {
      try {
        // Simulate blog stats for now since blogs table doesn't exist
        const blogs = Array.from({ length: 25 }, (_, i) => ({
          id: i,
          views: Math.floor(Math.random() * 1000),
          likes: Math.floor(Math.random() * 50)
        }));

        if (!cancelled && blogs) {
          const totalBlogs = blogs.length;
          const totalViews = blogs.reduce((sum, blog) => sum + (blog.views || 0), 0);
          const totalLikes = blogs.reduce((sum, blog) => sum + (blog.likes || 0), 0);
          const averageViews = totalBlogs > 0 ? Math.round(totalViews / totalBlogs) : 0;

          setStats({
            totalBlogs,
            totalViews,
            totalLikes,
            averageViews
          });
        }
      } catch (error) {
        console.error('Error fetching blog analytics:', error);
      }
    };

    fetchAnalytics();
    return () => { cancelled = true; };
  }, [user?.id]);

  const trendData = Array.from({ length: 7 }, (_, i) => ({
    name: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en', { weekday: 'short' }),
    value: Math.floor(Math.random() * 100) // Placeholder data
  }));

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Blog Analytics</h2>
        <p className="text-sm text-muted-foreground">Performance metrics for all published blogs.</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="Total Blogs"
          value={stats.totalBlogs.toString()}
          helpText="Published articles"
        />
        <KpiCard
          title="Total Views"
          value={stats.totalViews.toLocaleString()}
          helpText="All-time page views"
        />
        <KpiCard
          title="Total Likes"
          value={stats.totalLikes.toString()}
          helpText="Community engagement"
        />
        <KpiCard
          title="Avg Views"
          value={stats.averageViews.toString()}
          helpText="Per article"
        />
      </div>

      <TrendCard
        title="Daily Views (Last 7 Days)"
        series={trendData.map(d => ({ date: d.name, value: d.value }))}
        rangeLabel="Blog view trends"
      />
    </div>
  );
}