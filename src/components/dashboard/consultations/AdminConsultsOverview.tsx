import { useEffect, useMemo, useState } from "react";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendCard from "@/components/dashboard/TrendCard";
import { supabase } from "@/integrations/supabase/client";

export default function AdminConsultsOverview() {
  const [isLoading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ upcoming7d: 0, completed30d: 0, cancellations30d: 0, noShows30d: "—", avgRating: "—" });
  const [series, setSeries] = useState<Array<{ date: string; value: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const now = new Date();
        const in7 = new Date(now.getTime() + 7*24*60*60*1000);
        const ago30 = new Date(now.getTime() - 30*24*60*60*1000);
        const ago56 = new Date(now.getTime() - 56*24*60*60*1000);

        const [{ count: up }, { count: comp }, { count: canc }, { data: last56 } ] = await Promise.all([
          supabase.from('consult_bookings').select('id', { count: 'exact', head: true }).gte('start_datetime', now.toISOString()).lte('start_datetime', in7.toISOString()).neq('status','cancelled'),
          supabase.from('consult_bookings').select('id', { count: 'exact', head: true }).gte('end_datetime', ago30.toISOString()).lte('end_datetime', now.toISOString()).eq('status','completed'),
          supabase.from('consult_bookings').select('id', { count: 'exact', head: true }).gte('updated_at', ago30.toISOString()).lte('updated_at', now.toISOString()).eq('status','cancelled'),
          supabase.from('consult_bookings').select('id, start_datetime').gte('start_datetime', ago56.toISOString()).lte('start_datetime', now.toISOString()),
        ]);

        const byWeek: Record<string, number> = {};
        (last56 as any[] || []).forEach((b) => {
          const d = new Date(b.start_datetime);
          const weekStart = new Date(d);
          // Normalize to Monday
          const day = weekStart.getDay();
          const diff = (day === 0 ? -6 : 1) - day;
          weekStart.setDate(weekStart.getDate() + diff);
          weekStart.setHours(0,0,0,0);
          const key = weekStart.toISOString().slice(0,10);
          byWeek[key] = (byWeek[key] || 0) + 1;
        });
        const weeks: Array<{ date: string; value: number }> = Array.from({ length: 8 }).map((_, i) => {
          const start = new Date(now);
          start.setDate(start.getDate() - (7*(7-i)));
          start.setHours(0,0,0,0);
          const key = start.toISOString().slice(0,10);
          return { date: new Date(start).toLocaleDateString(), value: byWeek[key] || 0 };
        });

        if (!cancelled) {
          setKpis({ upcoming7d: up ?? 0, completed30d: comp ?? 0, cancellations30d: canc ?? 0, noShows30d: "—", avgRating: "—" });
          setSeries(weeks);
        }
      } catch {
        if (!cancelled) {
          setKpis({ upcoming7d: 0, completed30d: 0, cancellations30d: 0, noShows30d: "—", avgRating: "—" });
          setSeries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-4 grid gap-4 md:grid-cols-4">
      <KpiCard title="Upcoming (7d)" value={kpis.upcoming7d} isLoading={isLoading} />
      <KpiCard title="Completed (30d)" value={kpis.completed30d} isLoading={isLoading} />
      <KpiCard title="Cancellations (30d)" value={kpis.cancellations30d} isLoading={isLoading} />
      <KpiCard title="Avg rating" value={kpis.avgRating} isLoading={isLoading} />
      <div className="md:col-span-4">
        <TrendCard title="Bookings / week" series={series} rangeLabel="Last 8 weeks" isLoading={isLoading} />
      </div>
    </div>
  );
}
