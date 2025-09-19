import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendCard from "@/components/dashboard/TrendCard";

export default function ForumsOverview(){
  const { user } = useAuth();
  const [threads, setThreads] = useState<any[]>([]);
  const [replies, setReplies] = useState<any[]>([]);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      if(!user){ setThreads([]); setReplies([]); return; }
      const [{ data: th }, { data: rep }] = await Promise.all([
        supabase.from('forum_threads').select('id, created_at, updated_at').eq('author_id', user.id).order('updated_at',{ascending:false}).limit(200),
        supabase.from('forum_replies').select('id, created_at').eq('author_id', user.id).order('created_at',{ascending:false}).limit(400),
      ]);
      if(!cancelled){ setThreads((th as any[])||[]); setReplies((rep as any[])||[]); }
    })();
    return ()=>{ cancelled=true; };
  },[user?.id]);

  const lastActivity = useMemo(()=>{
    const ts = [
      ...threads.map(t=>new Date(t.updated_at||t.created_at).getTime()),
      ...replies.map(r=>new Date(r.created_at).getTime()),
    ];
    if(!ts.length) return '—';
    const d = new Date(Math.max(...ts));
    return d.toLocaleString();
  },[threads,replies]);

  const series = useMemo(()=>{
    const range=7;
    const days = Array.from({length:range}).map((_,i)=>{
      const d = new Date(Date.now() - (range-1-i)*24*60*60*1000);
      const key = d.toISOString().slice(0,10);
      const cnt = threads.filter(t => String(t.created_at).slice(0,10)===key).length +
                  replies.filter(r => String(r.created_at).slice(0,10)===key).length;
      return { date: d.toLocaleDateString(), value: cnt };
    });
    return days;
  },[threads,replies]);

  return (
    <div className="p-4 grid gap-4">
      <div>
        <h3 className="text-lg font-semibold">Overview</h3>
        <p className="text-sm text-muted-foreground">Your forum participation at a glance.</p>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard title="Threads" value={threads.length} />
        <KpiCard title="Replies" value={replies.length} />
        <KpiCard title="Last activity" value={lastActivity} />
      </div>
      <TrendCard title="Posts (7d)" series={series} rangeLabel="Last 7 days" />
      <div className="text-sm text-muted-foreground"><a className="underline" href="/forums">Go to Forums</a></div>
    </div>
  );
}
