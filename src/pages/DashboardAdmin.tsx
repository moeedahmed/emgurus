import React, { useEffect, useState } from "react";
import WorkspaceLayout, { WorkspaceSection } from "@/components/dashboard/WorkspaceLayout";
import { BookOpen, MessageSquare, GraduationCap, BarChart3, UsersRound, Settings } from "lucide-react";
import ReviewedQuestionBank from "@/pages/exams/ReviewedQuestionBank";
import AiPracticeConfig from "@/pages/exams/AiPracticeConfig";
import ForumsModeration from "@/pages/ForumsModeration";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendCard from "@/components/dashboard/TrendCard";
import { useAdminMetrics } from "@/hooks/metrics/useAdminMetrics";
import ModeratePosts from "@/pages/admin/ModeratePosts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { publishPost } from "@/lib/blogsApi";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const AdminAnalyticsPanel: React.FC = () => {
  const { kpis, submissionsSeries, isLoading } = useAdminMetrics();
  return (
    <div className="p-4 grid gap-4 md:grid-cols-4">
      <KpiCard title="New Users (7d)" value={kpis.newUsers7d} isLoading={isLoading} />
      <KpiCard title="Posts Submitted (7d)" value={kpis.postsSubmitted7d} isLoading={isLoading} />
      <KpiCard title="Questions Pending" value={kpis.questionsPending} isLoading={isLoading} />
      <KpiCard title="Chat Error Rate (7d)" value={`${kpis.chatErrorRate7d}%`} isLoading={isLoading} />
      <div className="md:col-span-4">
        <TrendCard title="Submissions" series={submissionsSeries} rangeLabel="Last 28 days" isLoading={isLoading} />
      </div>
    </div>
  );
};

const AdminExamShortcutsBar: React.FC = () => (
  <div className="px-4 py-3 border-b flex flex-wrap gap-2">
    <Button asChild size="sm" variant="outline"><a href="/admin/exams-curation">AI Curation & Assign</a></Button>
    <Button asChild size="sm" variant="outline"><a href="/admin/question-sets">Question Sets</a></Button>
    <Button asChild size="sm" variant="outline"><a href="/admin/marked-questions">Marked Questions</a></Button>
  </div>
);

// Admin ▸ Blogs tab components (reusing existing flows)
const AdminSubmitted: React.FC = () => {
  // Default admin view in ModeratePosts shows 'Submitted (Unassigned)'
  return <ModeratePosts />;
};

const AdminReviewed: React.FC = () => {
  const [posts, setPosts] = useState<Array<{ id: string; title: string; description: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Pull in_review posts and filter to those with an approve log (Guru approved)
        const { data: list } = await supabase
          .from('blog_posts')
          .select('id,title,description,created_at')
          .eq('status', 'in_review')
          .order('created_at', { ascending: false });
        const ids = (list || []).map((p: any) => p.id);
        if (!ids.length) { if (!cancelled) setPosts([]); return; }
        const { data: logs } = await supabase
          .from('blog_review_logs')
          .select('post_id, created_at')
          .eq('action', 'approve')
          .in('post_id', ids);
        const approved = new Set((logs || []).map((l: any) => l.post_id));
        const filtered = (list || []).filter((p: any) => approved.has(p.id));
        if (!cancelled) setPosts(filtered as any);
      } catch (e) {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const publish = async (postId: string) => {
    try {
      const { error } = await supabase.rpc('review_approve_publish', { p_post_id: postId });
      if (error) throw error as any;
      toast.success('Post published');
      // Refresh list
      const { data: list } = await supabase
        .from('blog_posts')
        .select('id,title,description,created_at')
        .eq('status', 'in_review')
        .order('created_at', { ascending: false });
      const ids = (list || []).map((p: any) => p.id);
      if (!ids.length) { setPosts([]); return; }
      const { data: logs } = await supabase
        .from('blog_review_logs')
        .select('post_id')
        .eq('action', 'approve')
        .in('post_id', ids);
      const approved = new Set((logs || []).map((l: any) => l.post_id));
      setPosts(((list || []) as any).filter((p: any) => approved.has(p.id)));
    } catch (e) {
      console.error(e);
      toast.error('Failed to publish');
    }
  };

  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <Card key={p.id} className="p-4 flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold">{p.title}</div>
            <div className="text-sm text-muted-foreground line-clamp-2">{p.description}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary"><Link to={`/blogs/editor/${p.id}`}>Edit</Link></Button>
            <Button onClick={() => publish(p.id)}>Publish</Button>
          </div>
        </Card>
      ))}
      {!loading && posts.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">No Guru‑approved items awaiting publish.</Card>
      )}
    </div>
  );
};

const AdminPublished: React.FC = () => {
  const [posts, setPosts] = useState<Array<{ id: string; title: string; slug: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('blog_posts')
          .select('id,title,slug,created_at')
          .eq('status', 'published')
          .order('published_at', { ascending: false, nullsFirst: false });
        if (!cancelled) setPosts((data as any) || []);
      } catch {
        if (!cancelled) setPosts([]);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <Card key={p.id} className="p-4 flex items-center justify-between">
          <div className="font-semibold">{p.title}</div>
          <Button asChild variant="outline"><a href={p.slug ? `/blogs/${p.slug}` : `/blogs`}>View</a></Button>
        </Card>
      ))}
      {!loading && posts.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">No published posts.</Card>
      )}
    </div>
  );
};

const AdminRejected: React.FC = () => {
  const [items, setItems] = useState<Array<{ id: string; title: string; note?: string }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Map "Rejected" to archived per spec
        const { data: posts } = await supabase
          .from('blog_posts')
          .select('id,title')
          .eq('status', 'archived')
          .order('updated_at', { ascending: false });
        const ids = (posts || []).map((p: any) => p.id);
        let notes: Record<string, string> = {};
        if (ids.length) {
          const { data: logs } = await supabase
            .from('blog_review_logs')
            .select('post_id, note, created_at')
            .in('post_id', ids)
            .eq('action', 'request_changes')
            .order('created_at', { ascending: false });
          (logs || []).forEach((l: any) => { if (!notes[l.post_id]) notes[l.post_id] = l.note || ''; });
        }
        const merged = ((posts || []) as any).map((p: any) => ({ id: p.id, title: p.title, note: notes[p.id] }));
        if (!cancelled) setItems(merged);
      } catch {
        if (!cancelled) setItems([]);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div className="space-y-3">
      {items.map((p) => (
        <Card key={p.id} className="p-4">
          <div className="font-semibold">{p.title}</div>
          {p.note && <div className="text-sm text-muted-foreground mt-1">Note: {p.note}</div>}
        </Card>
      ))}
      {!loading && items.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">No rejected posts.</Card>
      )}
    </div>
  );
};

const AdminArchived: React.FC = () => {
  // Same source as Rejected for now (archived = rejected mapping)
  return <AdminRejected />;
};

export default function DashboardAdmin() {
  useEffect(() => { document.title = "Admin Workspace | EMGurus"; }, []);

  const sections: WorkspaceSection[] = [
    {
      id: "blogs",
      title: "Blogs",
      icon: BookOpen,
      tabs: [
        { id: "submitted", title: "Submitted", render: <div className="p-4"><AdminSubmitted /></div> },
        { id: "reviewed", title: "Reviewed", render: <div className="p-4"><AdminReviewed /></div> },
        { id: "published", title: "Published", render: <div className="p-4"><AdminPublished /></div> },
        { id: "rejected", title: "Rejected", render: <div className="p-4"><AdminRejected /></div> },
        { id: "archived", title: "Archived", render: <div className="p-4"><AdminArchived /></div> },
      ],
    },
    {
      id: "exams",
      title: "Exams",
      icon: GraduationCap,
      tabs: [
        { id: "question-bank", title: "Question Bank", render: <div className="p-0"><AdminExamShortcutsBar /><ReviewedQuestionBank embedded /></div> },
        { id: "ai-practice", title: "AI Practice", render: <div className="p-0"><AdminExamShortcutsBar /><AiPracticeConfig /></div> },
      ],
    },
    {
      id: "forums",
      title: "Forums",
      icon: MessageSquare,
      tabs: [
        { id: "moderation", title: "Moderation Queue", render: <div className="p-4"><ForumsModeration /></div> },
      ],
    },
    {
      id: "analytics",
      title: "Analytics",
      icon: BarChart3,
      tabs: [ { id: "overview", title: "Overview", render: <AdminAnalyticsPanel /> } ],
    },
    { id: "users", title: "Users", icon: UsersRound, tabs: [ { id: "m", title: "Manage", render: <div className="p-4 text-sm text-muted-foreground">User management shortcuts coming soon.</div> } ] },
    { id: "settings", title: "Settings", icon: Settings, tabs: [ { id: "prefs", title: "Preferences", render: <div className="p-4 text-sm text-muted-foreground">Workspace settings.</div> } ] },
  ];

  return <WorkspaceLayout title="Admin Workspace" sections={sections} defaultSectionId="blogs" />;
}
