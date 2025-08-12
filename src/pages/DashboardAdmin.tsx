import React, { useEffect } from "react";
import WorkspaceLayout, { WorkspaceSection } from "@/components/dashboard/WorkspaceLayout";
import { BookOpen, ClipboardList, MessageSquare, GraduationCap, BarChart3, UsersRound, Settings } from "lucide-react";
import ReviewedQuestionBank from "@/pages/exams/ReviewedQuestionBank";
import AiPracticeConfig from "@/pages/exams/AiPracticeConfig";
import ForumsModeration from "@/pages/ForumsModeration";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendCard from "@/components/dashboard/TrendCard";
import { useAdminMetrics } from "@/hooks/metrics/useAdminMetrics";
import ModeratePosts from "@/pages/admin/ModeratePosts";
import AssignReviews from "@/pages/admin/AssignReviews";

function AdminUnassigned() { useEffect(() => { const p = new URLSearchParams(location.search); p.set('view','admin'); p.set('tab','unassigned'); history.replaceState(null,'',`${location.pathname}?${p.toString()}${location.hash}`); }, []); return <ModeratePosts />; }
function AdminAssigned() { useEffect(() => { const p = new URLSearchParams(location.search); p.set('view','admin'); p.set('tab','assigned'); history.replaceState(null,'',`${location.pathname}?${p.toString()}${location.hash}`); }, []); return <ModeratePosts />; }

// Minimal Completed list for admin using existing table
import { supabase } from "@/integrations/supabase/client";
function AdminCompleted() {
  const [items, setItems] = React.useState<any[]>([]);
  useEffect(() => { (async () => {
    const { data } = await supabase.from('blog_posts').select('id,title,slug,published_at').eq('status','published').order('published_at',{ascending:false}).limit(50);
    setItems((data as any) || []);
  })(); }, []);
  return (
    <div className="p-4 space-y-2">
      {items.map((p:any) => (
        <div key={p.id} className="flex items-center justify-between rounded border p-3">
          <div>
            <div className="font-medium">{p.title}</div>
            <div className="text-xs text-muted-foreground">{p.slug}</div>
          </div>
          {p.slug && <a className="text-sm underline" href={`/blogs/${p.slug}`}>View</a>}
        </div>
      ))}
      {items.length===0 && <div className="text-sm text-muted-foreground">No published posts yet.</div>}
    </div>
  );
}

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

export default function DashboardAdmin() {
  useEffect(() => { document.title = "Admin Workspace | EMGurus"; }, []);

  const sections: WorkspaceSection[] = [
    {
      id: "blogs",
      title: "Blogs",
      icon: BookOpen,
      tabs: [
        { id: "submitted", title: "Submitted/Unassigned", render: <div className="p-4"><AdminUnassigned /></div> },
        { id: "assigned", title: "Assigned", render: <div className="p-4"><AdminAssigned /></div> },
        { id: "completed", title: "Completed", render: <div className="p-4"><AdminCompleted /></div> },
        { id: "assign", title: "Assign Reviews", render: <div className="p-4"><AssignReviews /></div> },
      ],
    },
    {
      id: "exams",
      title: "Exams",
      icon: GraduationCap,
      tabs: [
        { id: "question-bank", title: "Question Bank", render: <div className="p-0"><ReviewedQuestionBank embedded /></div> },
        { id: "ai-practice", title: "AI Practice", render: <div className="p-0"><AiPracticeConfig /></div> },
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
