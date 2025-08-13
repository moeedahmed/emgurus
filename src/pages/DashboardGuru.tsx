import React, { useEffect, useState } from "react";
import WorkspaceLayout, { WorkspaceSection } from "@/components/dashboard/WorkspaceLayout";
import { BookOpen, Stethoscope, GraduationCap, MessageSquare } from "lucide-react";
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
import { Button } from "@/components/ui/button";

import { useAuth } from "@/contexts/AuthContext";

function ReviewerAssigned() { useEffect(() => { const p = new URLSearchParams(window.location.search); p.set('view','reviewer'); p.set('tab','pending'); history.replaceState(null,'',`${location.pathname}?${p.toString()}${location.hash}`); }, []); return <ModeratePosts embedded />; }
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

function MyBlogsPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      if (!user) { setRows([]); return; }
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, status, created_at')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      setRows((data as any) || []);
    })();
  }, [user?.id]);
  return (
    <div className="p-4">
      <TableCard
        title="My Blogs"
        columns={[
          { key: 'title', header: 'Title', render: (r: any) => r.title || '-' },
          { key: 'status', header: 'Status', render: (r: any) => r.status || '-' },
          { key: 'created_at', header: 'Created', render: (r: any) => new Date(r.created_at).toLocaleString() },
          { key: 'link', header: 'Link', render: (r: any) => (r.slug ? <a className="underline" href={`/blogs/${r.slug}`}>Open</a> : '-') },
        ]}
        rows={rows}
        emptyText="No posts yet."
      />
    </div>
  );
}

function MyThreadsPanel() {
  // Minimal placeholder to avoid heavy queries; can be enhanced later
  return (
    <div className="p-4">
      <TableCard
        title="My Threads"
        columns={[
          { key: 'title', header: 'Title' },
          { key: 'activity', header: 'Last activity' },
        ]}
        rows={[]}
        emptyText="No threads yet."
      />
    </div>
  );
}

function MyBlogStatusPanel({ status }: { status: 'draft' | 'in_review' }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setRows([]); return; }
      const orderCol = status === 'in_review' ? 'submitted_at' : 'updated_at';
      const { data } = await supabase
        .from('blog_posts')
        .select('id,title,slug,updated_at,submitted_at')
        .eq('author_id', user.id)
        .eq('status', status)
        .order(orderCol as any, { ascending: false })
        .limit(50);
      if (!cancelled) setRows((data as any) || []);
    })();
    return () => { cancelled = true; };
  }, [user?.id, status]);
  return (
    <div className="p-4">
      <TableCard
        title={status === 'draft' ? 'Drafts' : 'Submitted'}
        columns={[
          { key: 'title', header: 'Title' },
          { key: 'updated_at', header: status === 'draft' ? 'Updated' : 'Submitted', render: (r: any) => new Date(r.submitted_at || r.updated_at).toLocaleString() },
          { key: 'slug', header: 'Link', render: (r: any) => (r.slug ? <a className="underline" href={`/blogs/${r.slug}`}>Open</a> : '-') },
        ]}
        rows={rows}
        emptyText="Nothing here yet."
      />
    </div>
  );
}

function MySubmittedPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    if (!user) { setRows([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('list_my_exam_submissions', { p_limit: 100, p_offset: 0 });
      if (error) throw error as any;
      setRows((data as any) || []);
    } catch (e) {
      setRows([]);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user?.id]);
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-muted-foreground">Questions you submitted for review.</div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>Refresh</Button>
      </div>
      <TableCard
        title="Submitted"
        columns={[
          { key: 'created_at', header: 'When', render: (r: any) => new Date(r.created_at).toLocaleString() },
          { key: 'stem', header: 'Question', render: (r: any) => r.stem || '-' },
          { key: 'exam_type', header: 'Exam', render: (r: any) => r.exam_type || '-' },
        ]}
        rows={rows}
        emptyText="No submissions yet."
      />
    </div>
  );
}

export default function DashboardGuru() {
  useEffect(() => { document.title = "Guru Workspace | EM Gurus"; }, []);

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



  const sections: WorkspaceSection[] = [
    {
      id: "blogs",
      title: "Blogs",
      icon: BookOpen,
      tabs: [
        { id: "overview", title: "Overview", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Your recent reviews and publishing impact.</div><AnalyticsPanel /></div> },
        { id: "assigned", title: "Assigned", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Blogs waiting for your review.</div><ReviewerAssigned /></div> },
        { id: "approved", title: "Approved", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Blogs you approved.</div><ReviewerApprovedPanel /></div> },
        { id: "rejected", title: "Rejected", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Blogs you rejected with notes.</div><ReviewerRejectedPanel /></div> },
        { id: "my-drafts", title: "Drafts", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Your blog drafts.</div><MyBlogStatusPanel status="draft" /></div> },
        { id: "my-submitted", title: "Submitted", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Posts awaiting review.</div><MyBlogStatusPanel status="in_review" /></div> },
      ],
    },
    {
      id: "exams",
      title: "Exams",
      icon: GraduationCap,
      tabs: [
        { id: "overview", title: "Overview", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Your exam reviews and contribution.</div><AnalyticsPanel /></div> },
        { id: "drafts", title: "Drafts", render: (
          <div className="p-0">
            <div className="p-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Your saved drafts.</div>
              <Button asChild><a href="/tools/submit-question">Create Question</a></Button>
            </div>
            <MyExamDrafts />
          </div>
        ) },
        { id: "submitted", title: "Submitted", render: <div className="p-0"><MySubmittedPanel /></div> },
        { id: "assigned", title: "Assigned", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Questions assigned to you.</div><GuruReviewQueue /></div> },
        { id: "approved", title: "Approved", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Your completed approvals.</div><ReviewedByMe /></div> },
        { id: "rejected", title: "Rejected", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Items you sent back with notes.</div><RejectedByMe /></div> },
      ],
    },
    {
      id: "consultations",
      title: "Consultations",
      icon: Stethoscope,
      tabs: [
        { id: "overview", title: "Overview", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Your booking stats at a glance.</div><AnalyticsPanel /></div> },
        { id: "availability", title: "Availability", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Manage your slots and rates.</div><Availability /></div> },
        { id: "bookings", title: "Bookings", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Upcoming and past sessions.</div><Bookings /></div> },
      ],
    },
    {
      id: "forums",
      title: "Forums",
      icon: MessageSquare,
      tabs: [
        { id: "overview", title: "Overview", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Your forum activity.</div><AnalyticsPanel /></div> },
        { id: "drafts", title: "Drafts", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Your draft threads.</div><MyThreadsPanel /></div> },
        { id: "threads", title: "Threads", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Your published threads.</div><MyThreadsPanel /></div> },
      ],
    },
  ];

  return <WorkspaceLayout title="Guru Workspace" sections={sections} defaultSectionId="exams" />;
}
