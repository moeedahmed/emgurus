import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PostItem { id: string; title: string; description: string | null; author_id: string; }

const Review = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostItem[]>([]);

  useEffect(() => {
    document.title = "Review Queue | EMGurus";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Guru review queue for submitted EMGurus articles.");
  }, []);

  const load = async () => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("id,title,description,author_id")
      .eq("status", "submitted")
      .order("created_at", { ascending: true });
    if (!error) setPosts((data as any) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, status: "published" | "rejected") => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("blog_posts")
        .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      // Log the action
      await supabase.from("blog_review_logs").insert({
        post_id: id,
        action: status,
        actor_id: user.id,
        note: null,
      } as any);

      // Mark assignment as completed for this reviewer if exists
      await supabase
        .from("blog_review_assignments")
        .update({ status: "completed" })
        .eq("post_id", id)
        .eq("reviewer_id", user.id)
        .eq("status", "pending");

      toast.success(status === "published" ? "Post published" : "Post rejected");
      load();
    } catch (e) {
      console.error(e);
      toast.error("Action failed");
    }
  };

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold mb-6">Review Queue</h1>
      <div className="space-y-4">
        {posts.map((p) => (
          <Card key={p.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">{p.title}</div>
              <div className="text-sm text-muted-foreground line-clamp-2">{p.description}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => act(p.id, "rejected")}>Reject</Button>
              <Button onClick={() => act(p.id, "published")}>Publish</Button>
            </div>
          </Card>
        ))}
        {posts.length === 0 && <Card className="p-6">No submissions to review.</Card>}
      </div>
      <link rel="canonical" href={`${window.location.origin}/review`} />
    </main>
  );
};

export default Review;
