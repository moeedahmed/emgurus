import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendCard from "@/components/dashboard/TrendCard";

export default function ConsultAnalytics() {
  const { user, loading: userLoading } = useAuth();
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalRevenue: 0,
    avgSessionDuration: 0,
    activeGurus: 0
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
        // Simulate consultation stats for now
        const bookings = Array.from({ length: 20 }, (_, i) => ({
          duration_minutes: Math.floor(Math.random() * 60) + 30,
          price_paid: Math.floor(Math.random() * 200) + 50,
          status: Math.random() > 0.3 ? 'completed' : 'cancelled'
        }));

        if (!cancelled && bookings) {
          const completedBookings = bookings.filter(b => b.status === 'completed');
          const totalBookings = completedBookings.length;
          const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.price_paid || 0), 0);
          const avgSessionDuration = totalBookings > 0 
            ? Math.round(completedBookings.reduce((sum, b) => sum + (b.duration_minutes || 60), 0) / totalBookings)
            : 0;

          // Simulate active gurus count
          const activeGurus = Math.floor(Math.random() * 25) + 15;

          setStats({
            totalBookings,
            totalRevenue,
            avgSessionDuration,
            activeGurus
          });
        }
      } catch (error) {
        console.error('Error fetching consultation analytics:', error);
      }
    };

    fetchAnalytics();
    return () => { cancelled = true; };
  }, [user?.id]);

  const trendData = Array.from({ length: 7 }, (_, i) => ({
    name: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en', { weekday: 'short' }),
    value: Math.floor(Math.random() * 50) + 10 // Placeholder data
  }));

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Consultation Analytics</h2>
        <p className="text-sm text-muted-foreground">Performance metrics for consultation services.</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="Total Bookings"
          value={stats.totalBookings.toString()}
          helpText="Completed sessions"
        />
        <KpiCard
          title="Total Revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          helpText="Platform earnings"
        />
        <KpiCard
          title="Avg Duration"
          value={`${stats.avgSessionDuration}m`}
          helpText="Per session"
        />
        <KpiCard
          title="Active Gurus"
          value={stats.activeGurus.toString()}
          helpText="This month"
        />
      </div>

      <TrendCard
        title="Daily Bookings (Last 7 Days)"
        series={trendData.map(d => ({ date: d.name, value: d.value }))}
        rangeLabel="Consultation booking trends"
      />
    </div>
  );
}