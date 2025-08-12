import React, { useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { publishPost } from "@/lib/blogsApi";
import { toast } from "sonner";

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
