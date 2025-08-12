import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { useRoles } from "@/hooks/useRoles";

interface PostItem {
  id: string;
  title: string;
  description: string | null;
  author_id: string;
  created_at: string;
  status: string;
}

interface ReviewerProfile { user_id: string; full_name: string | null; email: string | null; }
interface Assignment { id: string; post_id: string; reviewer_id: string; status: string; notes: string | null; }

const ModeratePosts = () => {
  const { user } = useAuth();
  const { roles } = useRoles();
  const isAdmin = roles.includes("admin");
  const isGuru = roles.includes("guru") || isAdmin;
  const [searchParams, setSearchParams] = useSearchParams();

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [reviewers, setReviewers] = useState<ReviewerProfile[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({});
  const [loading, setLoading] = useState(false);

  const view = (searchParams.get('view') as 'admin' | 'reviewer') || (isAdmin ? 'admin' : 'reviewer');
  const tab = searchParams.get('tab') || (view === 'admin' ? 'unassigned' : 'pending');
  const setTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', view);
    next.set('tab', t);
    setSearchParams(next);
  };

  useEffect(() => {
    document.title = "Moderate Blog Posts | EMGurus";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Admin moderation: assign, publish, and reject submitted EMGurus blog posts.");
  }, []);

  const loadReviewers = async () => {
    // Fetch gurus from user_roles, then profiles
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "guru");
    if (error) return;
    const ids = (roles || []).map((r: any) => r.user_id);
    if (ids.length === 0) { setReviewers([]); return; }
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id,full_name,email")
      .in("user_id", ids);
    setReviewers((profs as any) || []);
  };

  const loadPosts = async () => {
    setLoading(true);
    try {
      if (view === 'admin') {
        // Admin view: either unassigned or assigned in-review posts
        let query = supabase
          .from('blog_posts')
          .select('id,title,description,author_id,created_at,status,reviewer_id')
          .eq('status', 'in_review');
        if (tab === 'unassigned') query = query.is('reviewer_id', null);
        if (tab === 'assigned') query = query.not('reviewer_id', 'is', null);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        const list = (data as any) || [];
        setPosts(list);
        // Load assignments info for admin context
        const ids = list.map((p: PostItem) => p.id);
        if (ids.length) {
          const { data: asg } = await supabase
            .from('blog_review_assignments')
            .select('id,post_id,reviewer_id,status,notes')
            .in('post_id', ids);
          const map: Record<string, Assignment[]> = {};
          (asg || []).forEach((a: any) => { (map[a.post_id] ||= []).push(a as Assignment); });
          setAssignments(map);
        } else {
          setAssignments({});
        }
      } else {
        // Reviewer view: assigned to me (pending) or completed by me
        if (tab === 'pending') {
          const { data, error } = await (supabase as any).rpc('list_reviewer_queue', { p_limit: 100, p_offset: 0 });
          if (error) throw error;
          let list = (data as any) || [];
          // Exclude items I already approved (have an approve log)
          const ids = list.map((p: any) => p.id);
          if (ids.length && user) {
            const { data: logs } = await supabase
              .from('blog_review_logs')
              .select('post_id')
              .eq('actor_id', user.id)
              .eq('action', 'approve')
              .in('post_id', ids);
            const approvedSet = new Set((logs || []).map((l: any) => l.post_id));
            list = list.filter((p: any) => !approvedSet.has(p.id));
          }
          setPosts(list);
        } else {
          if (!user) { setPosts([]); return; }
          const { data, error } = await supabase
            .from('blog_review_logs')
            .select('post_id, created_at, post:blog_posts(id,title,description,author_id,created_at,status)')
            .eq('actor_id', user.id)
            .eq('action', 'approve')
            .order('created_at', { ascending: false });
          if (error) throw error;
          const mapped = (data || []).map((r: any) => ({ id: r.post?.id, title: r.post?.title, description: r.post?.description, author_id: r.post?.author_id, created_at: r.created_at, status: r.post?.status }));
          setPosts(mapped.filter((p: any) => p.id));
        }
        setAssignments({});
      }
    } catch (e) {
      console.error(e);
      setPosts([]);
      setAssignments({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPosts(); if (isAdmin) loadReviewers(); }, [view, tab, user?.id, isAdmin]);

  const assign = async (postId: string) => {
    const reviewerId = selectedReviewer[postId];
    if (!user || !reviewerId) return;
    try {
      const { error } = await supabase.rpc('assign_reviewer', { p_post_id: postId, p_reviewer_id: reviewerId, p_note: '' });
      if (error) throw error;
      toast.success("Reviewer assigned");
      loadPosts();
    } catch (e) {
      console.error(e);
      toast.error("Assignment failed");
    }
  };

  const act = async (postId: string, status: "published" | "archived") => {
    if (!user) return;
    try {
      if (status === 'published') {
        const { error } = await supabase.rpc('review_approve_publish', { p_post_id: postId });
        if (error) throw error;
        toast.success('Post published');
      } else {
        const { error } = await supabase.rpc('review_request_changes', { p_post_id: postId, p_note: '' });
        if (error) throw error;
        toast.success('Changes requested');
      }
      loadPosts();
    } catch (e) {
      console.error(e);
      toast.error("Action failed");
    }
  };

  const reviewerName = (id: string) => reviewers.find(r => r.user_id === id)?.full_name || reviewers.find(r => r.user_id === id)?.email || id;

  const empty = !loading && posts.length === 0;

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Moderate Blog Posts</h1>

      {/* Tabs / view controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {view === 'admin' ? (
            <>
              <Button variant={tab==='unassigned' ? 'secondary' : 'outline'} size="sm" onClick={() => setTab('unassigned')}>Submitted</Button>
              <Button variant={tab==='assigned' ? 'secondary' : 'outline'} size="sm" onClick={() => setTab('assigned')}>Assigned</Button>
            </>
          ) : (
            <>
              <Button variant={tab==='pending' ? 'secondary' : 'outline'} size="sm" onClick={() => setTab('pending')}>Assigned</Button>
              <Button variant={tab==='completed' ? 'secondary' : 'outline'} size="sm" onClick={() => setTab('completed')}>Approved</Button>
            </>
          )}
        </div>
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('view', view === 'admin' ? 'reviewer' : 'admin');
              next.set('tab', view === 'admin' ? 'pending' : 'unassigned');
              setSearchParams(next);
            }}
          >
            Switch to {view === 'admin' ? 'Reviewer' : 'Admin'} view
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {posts.map((p) => (
          <Card key={p.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold">{p.title}</div>
                <div className="text-sm text-muted-foreground line-clamp-2">{p.description}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(assignments[p.id] || []).map((a) => (
                    <Badge key={a.id} variant={a.status === "pending" ? "secondary" : "default"}>
                      {reviewerName(a.reviewer_id)} · {a.status}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {view === 'admin' ? (
                  <>
                    <Button asChild variant="secondary">
                      <Link to={`/blogs/editor/${p.id}`}>Edit</Link>
                    </Button>
                    <Button variant="outline" onClick={async () => {
                      const note = window.prompt('Provide a short note for rejection (visible to author):');
                      if (!note || !note.trim()) { toast.error('Note is required'); return; }
                      try {
                        const { error } = await supabase.rpc('review_request_changes', { p_post_id: p.id, p_note: note.trim() });
                        if (error) throw error;
                        toast.success('Changes requested');
                        loadPosts();
                      } catch (e) { console.error(e); toast.error('Failed'); }
                    }}>Reject</Button>
                    <Button onClick={async () => {
                      try {
                        const { error } = await supabase.rpc('review_approve_publish', { p_post_id: p.id });
                        if (error) throw error;
                        toast.success('Post published');
                        loadPosts();
                      } catch (e) { console.error(e); toast.error('Failed'); }
                    }}>Publish</Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="secondary">
                      <Link to={`/blogs/editor/${p.id}`}>Open Review</Link>
                    </Button>
                    <Button variant="outline" onClick={async () => {
                      const note = window.prompt('Provide a short note for rejection (visible to author):');
                      if (!note || !note.trim()) { toast.error('Note is required'); return; }
                      try {
                        const { error } = await supabase.rpc('review_request_changes', { p_post_id: p.id, p_note: note.trim() });
                        if (error) throw error;
                        toast.success('Rejected with note');
                        loadPosts();
                      } catch (e) { console.error(e); toast.error('Failed'); }
                    }}>Reject</Button>
                    <Button onClick={async () => {
                      try {
                        const { error } = await supabase.from('blog_review_logs').insert({ post_id: p.id, actor_id: user?.id, action: 'approve', note: '' });
                        if (error) throw error as any;
                        toast.success('Approved — sent to Admin Reviewed');
                        loadPosts();
                      } catch (e) { console.error(e); toast.error('Failed'); }
                    }}>Approve</Button>
                  </>
                )}
              </div>
            </div>

            {isAdmin && view === 'admin' && (
              <div className="flex items-center gap-3">
                <Select value={selectedReviewer[p.id] || ""} onValueChange={(v) => setSelectedReviewer(prev => ({ ...prev, [p.id]: v }))}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Assign a reviewer" />
                  </SelectTrigger>
                  <SelectContent>
                    {reviewers.map(r => (
                      <SelectItem key={r.user_id} value={r.user_id}>{r.full_name || r.email || r.user_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="secondary" onClick={() => assign(p.id)} disabled={!selectedReviewer[p.id]}>Assign</Button>
              </div>
            )}
          </Card>
        ))}

        {empty && <Card className="p-6">No submissions to moderate.</Card>}
      </div>

      <link rel="canonical" href={`${window.location.origin}/admin/moderate-posts`} />
    </main>
  );
};

export default ModeratePosts;
