import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";

export default function ForumsQuestions(){
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [cats, setCats] = useState<Record<string,string>>({});

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      if(!user){ setRows([]); return; }
      const [{ data: th }, { data: c }] = await Promise.all([
        supabase.from('forum_threads').select('id, title, content, category_id, created_at, updated_at').eq('author_id', user.id).order('updated_at',{ascending:false}).limit(100),
        supabase.from('forum_categories').select('id, title'),
      ]);
      if(!cancelled){
        setRows((th as any[])||[]);
        const map: Record<string,string> = {};
        (c as any[] || []).forEach((x:any)=>{ map[x.id] = x.title; });
        setCats(map);
      }
    })();
    return ()=>{ cancelled=true; };
  },[user?.id]);

  const cols = useMemo(()=>[
    { key:'title', header:'Title', render:(r:any)=> <a className="underline" href={`/threads/${r.id}`}>{r.title}</a> },
    { key:'category_id', header:'Category', render:(r:any)=> cats[r.category_id] || '—' },
    { key:'updated_at', header:'Last activity', render:(r:any)=> new Date(r.updated_at || r.created_at).toLocaleString() },
  ],[cats]);

  return (
    <div className="p-4">
      <div className="mb-2 text-sm text-muted-foreground">Threads you started.</div>
      <TableCard title="My Questions" columns={cols as any} rows={rows} emptyText="No threads yet." />
    </div>
  );
}
