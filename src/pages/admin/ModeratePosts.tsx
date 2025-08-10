import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [reviewers, setReviewers] = useState<ReviewerProfile[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({});
  const [loading, setLoading] = useState(false);

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
    const { data, error } = await (supabase as any).rpc("list_all_posts_admin", { p_status: "in_review", p_limit: 100, p_offset: 0 });
    if (error) console.error(error);
    const list = (data as any) || [];
    setPosts(list);

    // Load existing assignments for these posts
    const ids = list.map((p: PostItem) => p.id);
    if (ids.length) {
      const { data: asg } = await supabase
        .from("blog_review_assignments")
        .select("id,post_id,reviewer_id,status,notes")
        .in("post_id", ids);
      const map: Record<string, Assignment[]> = {};
      (asg || []).forEach((a: any) => {
        (map[a.post_id] ||= []).push(a as Assignment);
      });
      setAssignments(map);
    } else {
      setAssignments({});
    }
    setLoading(false);
  };

  useEffect(() => { loadPosts(); loadReviewers(); }, []);

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
                <Button variant="outline" onClick={() => act(p.id, "archived")}>Reject</Button>
                <Button onClick={() => act(p.id, "published")}>Publish</Button>
              </div>
            </div>

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
          </Card>
        ))}

        {empty && <Card className="p-6">No submissions to moderate.</Card>}
      </div>

      <link rel="canonical" href={`${window.location.origin}/admin/moderate-posts`} />
    </main>
  );
};

export default ModeratePosts;
