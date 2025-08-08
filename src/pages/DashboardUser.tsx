import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const DashboardUser = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<{ id: string; title: string; status: string | null; updated_at: string }[]>([]);

  useEffect(() => {
    document.title = "Learner Dashboard | EM Gurus";
  }, []);

  useEffect(() => {
    const loadDrafts = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("blog_posts")
        .select("id,title,status,updated_at")
        .eq("author_id", user.id)
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(5);
      setDrafts((data as any) || []);
    };
    loadDrafts();
  }, [user?.id]);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Learner Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Start Exams</h2>
          <p className="text-muted-foreground mb-4">Practice questions tailored to your exam and level.</p>
          <Button onClick={() => navigate('/exams')}>Go to Exams</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Explore Blogs</h2>
          <p className="text-muted-foreground mb-4">Read expert articles and learning resources.</p>
          <Button onClick={() => navigate('/blogs')}>View Blog</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Book Consultation</h2>
          <p className="text-muted-foreground mb-4">Schedule 1:1 mentoring with verified Gurus.</p>
          <Button variant="secondary" onClick={() => navigate('/consultations')}>Go to Consultations</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Track Progress</h2>
          <p className="text-muted-foreground mb-4">Review your exam attempts and strengths.</p>
          <Button variant="secondary" onClick={() => navigate('/dashboard/user/progress')}>Open Progress</Button>
        </Card>
        <Card className="p-6 md:col-span-2">
          <h2 className="text-xl font-semibold mb-2">My Drafts</h2>
          {drafts.length > 0 ? (
            <ul className="space-y-2">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center justify-between">
                  <span className="text-sm">{d.title}</span>
                  <span className="text-xs text-muted-foreground">{new Date(d.updated_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No drafts yet. Start one from Blogs.</p>
          )}
        </Card>
      </div>
    </main>
  );
};

export default DashboardUser;
