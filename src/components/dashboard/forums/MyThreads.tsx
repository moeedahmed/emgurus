import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";
import { Button } from "@/components/ui/button";

type ThreadFilter = 'questions' | 'answers';

export default function MyThreads() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<ThreadFilter>('questions');
  const [threads, setThreads] = useState<any[]>([]);
  const [cats, setCats] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setThreads([]); return; }
      
      if (activeFilter === 'questions') {
        // User's own threads
        const [{ data: th }, { data: c }] = await Promise.all([
          supabase.from('forum_threads').select('id, title, content, category_id, created_at, updated_at').eq('author_id', user.id).order('updated_at', { ascending: false }).limit(100),
          supabase.from('forum_categories').select('id, title'),
        ]);
        if (!cancelled) {
          setThreads((th as any[]) || []);
          const map: Record<string, string> = {};
          (c as any[] || []).forEach((x: any) => { map[x.id] = x.title; });
          setCats(map);
        }
      } else {
        // Threads where user replied
        const { data: reps } = await supabase.from('forum_replies').select('thread_id, created_at').eq('author_id', user.id).order('created_at', { ascending: false }).limit(200);
        const ids = Array.from(new Set(((reps as any[]) || []).map(r => r.thread_id)));
        const [{ data: th }, { data: c }] = await Promise.all([
          ids.length ? supabase.from('forum_threads').select('id,title,category_id,updated_at,created_at').in('id', ids) : Promise.resolve({ data: [] } as any),
          supabase.from('forum_categories').select('id, title'),
        ]);
        if (!cancelled) {
          setThreads((th as any[]) || []);
          const map: Record<string, string> = {};
          (c as any[] || []).forEach((x: any) => { map[x.id] = x.title; });
          setCats(map);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, activeFilter]);

  const cols = useMemo(() => [
    { key: 'title', header: 'Title', render: (r: any) => <a className="underline" href={`/threads/${r.id}`}>{r.title}</a> },
    { key: 'category_id', header: 'Category', render: (r: any) => cats[r.category_id] || '—' },
    { key: 'updated_at', header: 'Last activity', render: (r: any) => new Date(r.updated_at || r.created_at).toLocaleString() },
  ], [cats]);

  const filterChips = [
    { id: 'questions' as ThreadFilter, label: 'Questions', desc: 'Threads you started.' },
    { id: 'answers' as ThreadFilter, label: 'Answers', desc: 'Threads where you replied.' },
  ];

  return (
    <div className="p-4">
      <div className="mb-4 text-sm text-muted-foreground">
        Your posts and replies.
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {filterChips.map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>
      
      <div className="mb-2 text-sm text-muted-foreground">
        {filterChips.find(c => c.id === activeFilter)?.desc}
      </div>
      
      <TableCard
        title={activeFilter === 'questions' ? 'My Questions' : 'My Answers'}
        columns={cols as any}
        rows={threads}
        emptyText={activeFilter === 'questions' ? 'No threads yet.' : 'No replies yet.'}
      />
    </div>
  );
}