import React, { useEffect, useState } from "react";
import WorkspaceLayout, { WorkspaceSection } from "@/components/dashboard/WorkspaceLayout";
import { BookOpen, Stethoscope, GraduationCap, BarChart3, MessageSquare } from "lucide-react";
import ReviewedQuestionBank from "@/pages/exams/ReviewedQuestionBank";
import AiPracticeConfig from "@/pages/exams/AiPracticeConfig";
import Bookings from "@/pages/Bookings";
import Availability from "@/pages/guru/Availability";
import ModeratePosts from "@/pages/admin/ModeratePosts";
import TableCard from "@/components/dashboard/TableCard";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendCard from "@/components/dashboard/TrendCard";
import { useGuruMetrics } from "@/hooks/metrics/useGuruMetrics";
import { supabase } from "@/integrations/supabase/client";
import Pricing from "@/pages/guru/Pricing";
import ForumsModeration from "@/pages/ForumsModeration";
import { Button } from "@/components/ui/button";

// Small wrappers that preset reviewer/admin tabs via URL params without leaving the route
function ReviewerPending() { useEffect(() => { const p = new URLSearchParams(window.location.search); p.set('view','reviewer'); p.set('tab','pending'); history.replaceState(null,'',`${location.pathname}?${p.toString()}${location.hash}`); }, []); return <ModeratePosts />; }
function ReviewerCompleted() { useEffect(() => { const p = new URLSearchParams(window.location.search); p.set('view','reviewer'); p.set('tab','completed'); history.replaceState(null,'',`${location.pathname}?${p.toString()}${location.hash}`); }, []); return <ModeratePosts />; }

export default function DashboardGuru() {
  useEffect(() => { document.title = "Guru Workspace | EMGurus"; }, []);

  const AnalyticsPanel: React.FC = () => {
    const { kpis, throughputSeries, isLoading } = useGuruMetrics();
    return (
      <div className="p-4 grid gap-4 md:grid-cols-4">
        <KpiCard title="Assigned" value={kpis.myAssignedCount} isLoading={isLoading} />
        <KpiCard title="Approved (7d)" value={kpis.myApproved7d} isLoading={isLoading} />
        <KpiCard title="Avg Turnaround" value={`${kpis.avgTurnaroundHrs}h`} isLoading={isLoading} />
        <KpiCard title="Upcoming Consults" value={kpis.upcomingConsults} isLoading={isLoading} />
        <div className="md:col-span-4">
          <TrendCard title="Throughput" series={throughputSeries} rangeLabel="Last 28 days" isLoading={isLoading} />
        </div>
      </div>
    );
  };

  const ExamShortcutsBar: React.FC = () => (
    <div className="px-4 py-3 border-b flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline"><a href="/guru/exams/review">Review Pending</a></Button>
      <Button asChild size="sm" variant="outline"><a href="/guru/reviewed">Reviewed by Me</a></Button>
      <Button asChild size="sm" variant="outline"><a href="/guru/questions">My Questions</a></Button>
    </div>
  );


  const sections: WorkspaceSection[] = [
    {
      id: "blogs",
      title: "Blogs",
      icon: BookOpen,
      tabs: [
        { id: "pending", title: "Review Pending", render: <div className="p-4"><ReviewerPending /></div> },
        { id: "completed", title: "Review Completed", render: <div className="p-4"><ReviewerCompleted /></div> },
      ],
    },
    {
      id: "exams",
      title: "Exams",
      icon: GraduationCap,
      tabs: [
        { id: "question-bank", title: "Question Bank", render: <div className="p-0"><ExamShortcutsBar /><ReviewedQuestionBank embedded /></div> },
        { id: "ai-practice", title: "AI Practice", render: <div className="p-0"><ExamShortcutsBar /><AiPracticeConfig /></div> },
      ],
    },
    {
      id: "consultations",
      title: "Consultations",
      icon: Stethoscope,
      tabs: [
        { id: "availability", title: "Availability", render: <div className="p-0"><Availability /></div> },
        { id: "pricing", title: "Pricing", render: <div className="p-4"><Pricing /></div> },
        { id: "bookings", title: "My Bookings", render: <div className="p-4"><Bookings /></div> },
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
      tabs: [
        { id: "overview", title: "Overview", render: <AnalyticsPanel /> },
      ],
    },
  ];

  return <WorkspaceLayout title="Guru Workspace" sections={sections} defaultSectionId="blogs" />;
}
