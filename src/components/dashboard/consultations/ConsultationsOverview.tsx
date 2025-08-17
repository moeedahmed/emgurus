import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendCard from "@/components/dashboard/TrendCard";

export default function ConsultationsOverview(){
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGuru, setIsGuru] = useState(false);

  // Check if user is a guru
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'guru').maybeSingle();
      setIsGuru(!!data);
    })();
  }, [user]);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      if(!user){ setRows([]); return; }
      setLoading(true);
      try{
        // Query bookings based on user role - guru sees their guru bookings, user sees their customer bookings
        const column = isGuru ? 'guru_id' : 'user_id';
        const { data } = await supabase
          .from('consult_bookings')
          .select('id,start_datetime,end_datetime,status')
          .eq(column, user.id)
          .order('start_datetime', { ascending: false })
          .limit(200);
        if(!cancelled) setRows((data as any[])||[]);
      } finally { if(!cancelled) setLoading(false); }
    })();
    return ()=>{ cancelled=true; };
  },[user?.id, isGuru]);

  const stats = useMemo(()=>{
    const now = Date.now();
    let upcoming=0, past=0, minutes=0;
    rows.forEach(r=>{
      const end = new Date(r.end_datetime).getTime();
      const start = new Date(r.start_datetime).getTime();
      if(end >= now) upcoming++; else past++;
      minutes += Math.max(0, Math.round((end-start)/60000));
    });
    return { upcoming, past, minutes };
  },[rows]);

  const series = useMemo(()=>{
    const days = Array.from({length:7}).map((_,i)=>{
      const d = new Date(Date.now() - (6-i)*24*60*60*1000);
      const key = d.toISOString().slice(0,10);
      const cnt = rows.filter(r => String(r.start_datetime).slice(0,10) === key).length;
      return { date: d.toLocaleDateString(), value: cnt };
    });
    return days;
  },[rows]);

  return (
    <div className="p-4 grid gap-4">
      <div>
        <h3 className="text-lg font-semibold">Overview</h3>
        <p className="text-sm text-muted-foreground">Your consultation activity over time.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Upcoming" value={stats.upcoming} isLoading={loading} />
        <KpiCard title="Past sessions" value={stats.past} isLoading={loading} />
        <KpiCard title="Total time" value={`${stats.minutes} min`} isLoading={loading} />
      </div>
      <TrendCard title="Sessions (7d)" series={series} rangeLabel="Last 7 days" isLoading={loading} />
      <div className="text-sm text-muted-foreground">Need a mentor? <a className="underline" href="/consultations">Find a Guru</a></div>
    </div>
  );
}