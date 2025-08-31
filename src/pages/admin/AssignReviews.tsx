import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface PostItem { id: string; title: string; description: string | null; created_at: string; }
interface ReviewerProfile { user_id: string; full_name: string | null; email: string | null; }

const AssignReviews = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [reviewers, setReviewers] = useState<ReviewerProfile[]>([]);
  const [reviewerId, setReviewerId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Assign Reviews | EMGurus";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Admin tool to assign submitted blog posts to Gurus for review.");
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("list_all_posts_admin", { p_status: "in_review", p_limit: 100, p_offset: 0 });
    if (error) console.error(error);
    setPosts((data as any) || []);

    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "guru");
    const ids = (roles || []).map((r: any) => r.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id,full_name,email").in("user_id", ids);
      setReviewers((profs as any) || []);
    } else {
      setReviewers([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const allChecked = useMemo(() => posts.length > 0 && posts.every(p => selected[p.id]), [posts, selected]);

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    posts.forEach(p => next[p.id] = checked);
    setSelected(next);
  };

  const assignSelected = async () => {
    if (!user) return;
    const ids = posts.filter(p => selected[p.id]).map(p => p.id);
    if (!reviewerId || ids.length === 0) return toast.error("Pick a reviewer and at least one post");
    try {
      await Promise.all(ids.map(pid => supabase.rpc('assign_reviewer', { p_post_id: pid, p_reviewer_id: reviewerId, p_note: '' })));
      toast.success("Assigned successfully");
      setSelected({});
      load();
    } catch (e) {
      console.error(e);
      toast.error("Assignment failed");
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Assign Reviews</h1>

      <Card className="p-4 mb-6 flex items-center gap-3">
        <Select value={reviewerId} onValueChange={setReviewerId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Select reviewer" /></SelectTrigger>
          <SelectContent>
            {reviewers.map(r => (
              <SelectItem key={r.user_id} value={r.user_id}>{r.full_name || r.email || r.user_id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={assignSelected} disabled={!reviewerId}>Assign to Selected</Button>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Checkbox id="check-all" checked={allChecked} onCheckedChange={(c) => toggleAll(!!c)} />
            <label htmlFor="check-all" className="text-sm">Select All</label>
          </div>
          <div className="text-sm text-muted-foreground">{posts.filter(p => selected[p.id]).length} selected</div>
        </div>
        <div className="space-y-3">
          {posts.map(p => (
            <div key={p.id} className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox checked={!!selected[p.id]} onCheckedChange={(c) => setSelected(prev => ({ ...prev, [p.id]: !!c }))} />
              <div className="flex-1">
                <div className="font-medium">{p.title}</div>
                <div className="text-sm text-muted-foreground line-clamp-2">{p.description}</div>
              </div>
            </div>
          ))}
          {(!loading && posts.length === 0) && <div className="text-sm text-muted-foreground">No submissions found.</div>}
        </div>
      </Card>

      <link rel="canonical" href={`${window.location.origin}/admin/assign-reviews`} />
    </main>
  );
};

export default AssignReviews;
