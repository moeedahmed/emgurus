import Dashboard from "./Dashboard";

// Blog Reviews Component - combines Assigned, Approved, Rejected with chips
function BlogReviews() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'assigned' | 'approved' | 'rejected'>('assigned');
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setRows([]); return; }
      
      if (activeFilter === 'assigned') {
        // Use existing ModeratePosts logic for assigned items
        const { data } = await supabase.rpc('list_reviewer_queue', { p_limit: 100, p_offset: 0 });
        if (!cancelled) setRows((data as any) || []);
      } else if (activeFilter === 'approved') {
        const { data } = await supabase
          .from('blog_review_logs')
          .select('post_id, created_at, note, post:blog_posts(id,title,slug)')
          .eq('actor_id', user.id)
          .eq('action', 'approve')
          .order('created_at', { ascending: false })
          .limit(100);
        if (!cancelled) setRows((data as any) || []);
      } else if (activeFilter === 'rejected') {
        const { data } = await supabase
          .from('blog_review_logs')
          .select('post_id, created_at, note, post:blog_posts(id,title,slug)')
          .eq('actor_id', user.id)
          .eq('action', 'request_changes')
          .order('created_at', { ascending: false })
          .limit(100);
        if (!cancelled) setRows((data as any) || []);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, activeFilter]);

  const getColumns = () => {
    if (activeFilter === 'assigned') {
      return [
        { key: 'title', header: 'Title', render: (r: any) => r.title || '-' },
        { key: 'submitted_at', header: 'Submitted', render: (r: any) => new Date(r.submitted_at).toLocaleString() },
        { key: 'actions', header: 'Actions', render: (r: any) => <a className="underline" href={`/blogs/editor/${r.id}`}>Review</a> },
      ];
    } else {
      return [
        { key: 'title', header: 'Title', render: (r: any) => r.post?.title || '-' },
        { key: 'created_at', header: 'When', render: (r: any) => new Date(r.created_at).toLocaleString() },
        { key: 'note', header: 'Note', render: (r: any) => r.note || '-' },
      ];
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 text-sm text-muted-foreground">
        Edit and approve assigned blog posts.
      </div>
      
      <div className="flex gap-2 mb-4">
        {[
          { id: 'assigned' as const, label: 'Assigned' },
          { id: 'approved' as const, label: 'Approved' },
          { id: 'rejected' as const, label: 'Rejected' },
        ].map(chip => (
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

      <TableCard
        title="Reviews"
        columns={getColumns()}
        rows={rows}
        emptyText="Nothing here yet."
      />
    </div>
  );
}

// Exam Reviews Component - combines queue and history
function ExamReviews() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'assigned' | 'approved' | 'rejected'>('assigned');
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setRows([]); return; }
      
      if (activeFilter === 'assigned') {
        try {
          const { data, error } = await supabase.rpc("list_exam_reviewer_queue", { p_limit: 100, p_offset: 0 });
          if (!cancelled && !error) setRows((data as any) || []);
        } catch (e) { if (!cancelled) setRows([]); }
      } else {
        // For approved/rejected, would need to query review logs or similar tables
        // Using placeholder for now as this would need proper exam review logs
        if (!cancelled) setRows([]);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, activeFilter]);

  return (
    <div className="p-4">
      <div className="mb-4 text-sm text-muted-foreground">
        Review assigned questions and finalize decisions.
      </div>
      
      <div className="flex gap-2 mb-4">
        {[
          { id: 'assigned' as const, label: 'Assigned' },
          { id: 'approved' as const, label: 'Approved' },
          { id: 'rejected' as const, label: 'Rejected' },
        ].map(chip => (
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

      <TableCard
        title="Review & Assignment"
        columns={[
          { key: 'created_at', header: 'When', render: (r: any) => new Date(r.created_at).toLocaleString() },
          { key: 'stem', header: 'Question', render: (r: any) => r.stem || '-' },
          { key: 'exam_type', header: 'Exam', render: (r: any) => r.exam_type || '-' },
        ]}
        rows={rows}
        emptyText="Nothing assigned yet."
      />
    </div>
  );
}

// Remove unused components from old structure

// Remove unused components

function MyBlogStatusPanel({ filter }: { filter: 'draft' | 'in_review' }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setRows([]); return; }
      const orderCol = filter === 'in_review' ? 'submitted_at' : 'updated_at';
      const { data } = await supabase
        .from('blog_posts')
        .select('id,title,slug,updated_at,submitted_at')
        .eq('author_id', user.id)
        .eq('status', filter)
        .order(orderCol as any, { ascending: false })
        .limit(50);
      if (!cancelled) setRows((data as any) || []);
    })();
    return () => { cancelled = true; };
  }, [user?.id, filter]);

  return (
    <div className="p-4">
      <div className="mb-4 text-sm text-muted-foreground">
        {filter === 'draft' ? 'Write or continue your own posts.' : 'Posts awaiting review.'}
      </div>
      
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant="default" aria-pressed={true}>
          {filter === 'draft' ? 'Draft' : 'Submitted'}
        </Button>
      </div>

      <TableCard
        title={filter === 'draft' ? 'My Blogs' : 'Submitted'}
        columns={[
          { key: 'title', header: 'Title' },
          { key: 'updated_at', header: filter === 'draft' ? 'Updated' : 'Submitted', render: (r: any) => new Date(r.submitted_at || r.updated_at).toLocaleString() },
          { key: 'slug', header: 'Link', render: (r: any) => (r.slug ? <a className="underline" href={`/blogs/editor/${r.id}`}>Edit</a> : '-') },
        ]}
        rows={rows}
        emptyText="Nothing here yet."
      />
    </div>
  );
}
function MySubmittedPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    if (!user) { setRows([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('list_my_exam_submissions', { p_limit: 100, p_offset: 0 });
      if (error) throw error as any;
      setRows((data as any) || []);
    } catch (e) {
      setRows([]);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user?.id]);
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-muted-foreground">Questions you submitted for review.</div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>Refresh</Button>
      </div>
      <TableCard
        title="Submitted"
        columns={[
          { key: 'created_at', header: 'When', render: (r: any) => new Date(r.created_at).toLocaleString() },
          { key: 'stem', header: 'Question', render: (r: any) => r.stem || '-' },
          { key: 'exam_type', header: 'Exam', render: (r: any) => r.exam_type || '-' },
        ]}
        rows={rows}
        emptyText="No submissions yet."
      />
    </div>
  );
}

export default function DashboardGuru() {
  // Redirect to unified dashboard
  return <Dashboard />;
}
