import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import TableCard from "@/components/dashboard/TableCard";
import FilterChips from "@/components/ui/filter-chips";

type ThreadFilter = 'questions' | 'answers';

interface MyThreadsWithChipsProps {
  defaultFilter?: ThreadFilter;
}

export default function MyThreadsWithChips({ defaultFilter = 'questions' }: MyThreadsWithChipsProps) {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<ThreadFilter>(defaultFilter);
  const [threads, setThreads] = useState<any[]>([]);
  const [cats, setCats] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setThreads([]); return; }
      setLoading(true);
      
      try {
        if (activeFilter === 'questions') {
          // Get threads user authored
          const [{ data: th }, { data: c }] = await Promise.all([
            supabase.from('forum_threads').select('id,title,created_at,category_id,updated_at').eq('author_id', user.id).order('updated_at', { ascending: false }).limit(100),
            supabase.from('forum_categories').select('id,name')
          ]);
          if (!cancelled) {
            setThreads((th as any) || []);
            setCats(Object.fromEntries(((c as any) || []).map((cat: any) => [cat.id, cat.name])));
          }
        } else {
          // Get threads user replied to
          const { data: reps } = await supabase.from('forum_replies').select('thread_id, created_at').eq('author_id', user.id).order('created_at', { ascending: false }).limit(200);
          if (!cancelled && reps) {
            const threadIds = [...new Set(reps.map(r => r.thread_id))];
            if (threadIds.length > 0) {
              const [{ data: th }, { data: c }] = await Promise.all([
                supabase.from('forum_threads').select('id,title,created_at,category_id,updated_at').in('id', threadIds).order('updated_at', { ascending: false }),
                supabase.from('forum_categories').select('id,name')
              ]);
              if (!cancelled) {
                setThreads((th as any) || []);
                setCats(Object.fromEntries(((c as any) || []).map((cat: any) => [cat.id, cat.name])));
              }
            } else {
              if (!cancelled) setThreads([]);
            }
          }
        }
      } catch (e) {
        if (!cancelled) setThreads([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, activeFilter]);

  const filterItems = [
    { label: 'Questions', value: 'questions' },
    { label: 'Answers', value: 'answers' },
  ];

  const columns = [
    { key: 'title', header: 'Title', render: (r: any) => <a href={`/threads/${r.id}`} className="underline hover:no-underline">{r.title}</a> },
    { key: 'category_id', header: 'Category', render: (r: any) => cats[r.category_id] || '-' },
    { key: 'updated_at', header: 'Last Activity', render: (r: any) => new Date(r.updated_at).toLocaleDateString() },
  ];

  return (
    <div className="p-0">
      <div className="mb-4 text-sm text-muted-foreground px-6 pt-4">
        Your forum activity at a glance.
      </div>

      <div className="flex gap-2 mb-6 px-6 overflow-x-auto scrollbar-hide">
        {filterItems.map(item => (
          <Button
            key={item.value}
            size="sm"
            variant={activeFilter === item.value ? "default" : "outline"}
            onClick={() => setActiveFilter(item.value as ThreadFilter)}
            aria-pressed={activeFilter === item.value}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="px-6">
        <TableCard
          title="My Threads"
          columns={columns}
          rows={threads}
          emptyText={activeFilter === 'questions' ? "No threads yet." : "No answered threads yet."}
          isLoading={loading}
        />
      </div>
    </div>
  );
}