import React, { useEffect, useState } from "react";
import WorkspaceLayout, { WorkspaceSection } from "@/components/dashboard/WorkspaceLayout";
import { BookOpen, Stethoscope, GraduationCap, BarChart3, MessageSquare } from "lucide-react";
import ReviewedByMe from "@/pages/guru/ReviewedByMe";
import GuruReviewQueue from "@/pages/guru/ReviewQueue";
import MyExamDrafts from "@/pages/tools/MyExamDrafts";
import RejectedByMe from "@/pages/guru/RejectedByMe";
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
import { useAuth } from "@/contexts/AuthContext";

function ReviewerAssigned() { useEffect(() => { const p = new URLSearchParams(window.location.search); p.set('view','reviewer'); p.set('tab','pending'); history.replaceState(null,'',`${location.pathname}?${p.toString()}${location.hash}`); }, []); return <ModeratePosts />; }
function ReviewerApprovedPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { (async () => {
    if (!user) { setRows([]); return; }
    const { data } = await supabase
      .from('blog_review_logs')
      .select('post_id, created_at, note, post:blog_posts(id,title,slug)')
      .eq('actor_id', user.id)
      .eq('action', 'approve')
      .order('created_at', { ascending: false })
      .limit(100);
    setRows((data as any) || []);
  })(); }, [user?.id]);
  return (
    <div className="p-4">
      <TableCard
        title="Approved"
        columns={[
          { key: 'title', header: 'Title', render: (r: any) => r.post?.title || '-' },
          { key: 'created_at', header: 'When', render: (r: any) => new Date(r.created_at).toLocaleString() },
          { key: 'slug', header: 'Link', render: (r: any) => (r.post?.slug ? <a className="underline" href={`/blogs/${r.post.slug}`}>Open</a> : '-') },
        ]}
        rows={rows}
        emptyText="No approvals yet."
      />
    </div>
  );
}
function ReviewerRejectedPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { (async () => {
    if (!user) { setRows([]); return; }
    const { data } = await supabase
      .from('blog_review_logs')
      .select('post_id, created_at, note, post:blog_posts(id,title,slug)')
      .eq('actor_id', user.id)
      .eq('action', 'request_changes')
      .order('created_at', { ascending: false })
      .limit(100);
    setRows((data as any) || []);
  })(); }, [user?.id]);
  return (
    <div className="p-4">
      <TableCard
        title="Rejected"
        columns={[
          { key: 'title', header: 'Title', render: (r: any) => r.post?.title || '-' },
          { key: 'note', header: 'Note', render: (r: any) => r.note || '-' },
          { key: 'created_at', header: 'When', render: (r: any) => new Date(r.created_at).toLocaleString() },
        ]}
        rows={rows}
        emptyText="No rejections yet."
      />
    </div>
  );
}


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

  const ExamShortcutsBar: React.FC = () => {
    const goto = (tab: string) => {
      const p = new URLSearchParams(window.location.search);
      p.set('tab', tab);
      history.replaceState(null, '', `${location.pathname}?${p.toString()}#exams`);
      // Nudge WorkspaceLayout to pick up changes if already on #exams
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };
    return (
      <div className="px-4 py-3 border-b flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => goto('assigned')}>Assigned</Button>
        <Button size="sm" variant="outline" onClick={() => goto('approved')}>Approved</Button>
        <Button size="sm" variant="outline" onClick={() => goto('submitted')}>Submitted</Button>
      </div>
    );
  };


  const sections: WorkspaceSection[] = [
    {
      id: "blogs",
      title: "Blogs",
      icon: BookOpen,
      tabs: [
        { id: "assigned", title: "Assigned", render: <div className="p-4"><ReviewerAssigned /></div> },
        { id: "approved", title: "Approved", render: <div className="p-4"><ReviewerApprovedPanel /></div> },
        { id: "rejected", title: "Rejected", render: <div className="p-4"><ReviewerRejectedPanel /></div> },
      ],
    },
    {
      id: "exams",
      title: "Exams",
      icon: GraduationCap,
      tabs: [
        { id: "assigned", title: "Assigned", render: <div className="p-0"><ExamShortcutsBar /><GuruReviewQueue /></div> },
        { id: "approved", title: "Approved", render: <div className="p-0"><ExamShortcutsBar /><ReviewedByMe /></div> },
        { id: "rejected", title: "Rejected", render: <div className="p-0"><ExamShortcutsBar /><RejectedByMe /></div> },
        { id: "submitted", title: "Submitted", render: <div className="p-0"><ExamShortcutsBar /><MyExamDrafts /></div> },
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

  return <WorkspaceLayout title="Guru Workspace" sections={sections} defaultSectionId="exams" />;
}
