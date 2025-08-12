import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { submitPost, publishPost } from "@/lib/blogsApi";

interface PostRow {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  author_id: string;
  created_at: string;
}

export default function BlogsDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { roles, primaryRole } = useRoles();

  const [status, setStatus] = useState<"draft" | "submitted" | "in_review" | "published">("draft");
  const [myPosts, setMyPosts] = useState<PostRow[]>([]);
  const [reviewQueue, setReviewQueue] = useState<PostRow[]>([]);
  const isGuruOrAdmin = roles.includes("guru") || roles.includes("admin");

  useEffect(() => {
    document.title = "Blogs Dashboard | EMGurus";
    const link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", `${window.location.origin}/blogs/dashboard`);
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadMine = async () => {
      const base = supabase
        .from("blog_posts")
        .select("id, title, slug, status, author_id, created_at, reviewer_id")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false });

      let query = base as any;
      if (status === "draft" || status === "published") {
        query = query.eq("status", status);
      } else if (status === "submitted") {
        query = query.eq("status", "in_review").is("reviewer_id", null);
      } else if (status === "in_review") {
        query = query.eq("status", "in_review").not("reviewer_id", "is", null);
      }

      const { data, error } = await query;
      if (!error) setMyPosts((data as any) || []);
    };
    loadMine();
  }, [user?.id, status]);

  useEffect(() => {
    if (!user || !isGuruOrAdmin) { setReviewQueue([]); return; }
    const loadQueue = async () => {
      try {
        // Try to scope by assignments first
        const { data: assigns, error: assignErr } = await supabase
          .from("blog_review_assignments")
          .select("post_id")
          .eq("reviewer_id", user.id)
          .eq("status", "pending");
        if (!assignErr && assigns && assigns.length) {
          const ids = assigns.map((a: any) => a.post_id);
          const { data } = await supabase
            .from("blog_posts")
            .select("id, title, slug, status, author_id, created_at")
            .in("id", ids)
            .eq("status", "in_review")
            .order("created_at", { ascending: false });
          setReviewQueue((data as any) || []);
          return;
        }
      } catch {}
      // Fallback: all in_review
      const { data } = await supabase
        .from("blog_posts")
        .select("id, title, slug, status, author_id, created_at")
        .eq("status", "in_review")
        .order("created_at", { ascending: false });
      setReviewQueue((data as any) || []);
    };
    loadQueue();
  }, [user?.id, isGuruOrAdmin]);

  const onSubmitDraft = async (id: string) => {
    try {
      await submitPost(id);
      toast.success("Submitted for review");
      setMyPosts((arr) => arr.filter((p) => p.id !== id));
    } catch (e: any) {
      toast.error(e.message || "Failed to submit");
    }
  };

  const onPublish = async (id: string) => {
    try {
      if (!window.confirm("Publish this post?")) return;
      await publishPost(id);
      toast.success("Published");
      setReviewQueue((arr) => arr.filter((p) => p.id !== id));
    } catch (e: any) {
      toast.error(e.message || "Failed to publish");
    }
  };

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Blogs Dashboard</h1>
          <p className="text-muted-foreground">Role: {primaryRole ?? "guest"}</p>
        </div>
        <Button onClick={() => navigate("/blogs/editor/new")}>New Blog</Button>
      </header>

      {/* User section */}
      {user && (
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-semibold">My Posts</h2>
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            {myPosts.map((p) => (
              <Card key={p.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.slug}</div>
                </div>
                <div className="flex gap-2">
                  {p.status === "draft" && (
                    <>
                      <Button variant="outline" onClick={() => navigate(`/blogs/editor/${p.id}`)}>Edit</Button>
                      <Button onClick={() => onSubmitDraft(p.id)}>Submit</Button>
                    </>
                  )}
                  {p.status === "published" && p.slug && (
                    <Button variant="outline" onClick={() => navigate(`/blogs/${p.slug}`)}>View</Button>
                  )}
                </div>
              </Card>
            ))}
            {myPosts.length === 0 && <Card className="p-6">No posts.</Card>}
          </div>
        </section>
      )}

      {/* Review queue */}
      {isGuruOrAdmin && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-semibold">Review Queue</h2>
          </div>
          <div className="space-y-3">
            {reviewQueue.map((p) => (
              <Card key={p.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.slug}</div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => onPublish(p.id)}>Publish</Button>
                </div>
              </Card>
            ))}
            {reviewQueue.length === 0 && <Card className="p-6">No posts awaiting review.</Card>}
          </div>
        </section>
      )}
    </main>
  );
}
