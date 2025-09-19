import React, { useEffect, useState } from "react";
import WorkspaceLayout, { WorkspaceSection } from "@/components/dashboard/WorkspaceLayout";
import { BookOpen, Stethoscope, GraduationCap, MessageSquare, Eye, ThumbsUp, MessageCircle, Share2, Flag, Clock, CheckCircle } from "lucide-react";
import ReviewedByMe from "@/pages/guru/ReviewedByMe";
import GuruReviewQueue from "@/pages/guru/ReviewQueue";
import MyExamDrafts from "@/pages/tools/MyExamDrafts";
import RejectedByMe from "@/pages/guru/RejectedByMe";
import Bookings from "@/pages/Bookings";
import Availability from "@/pages/guru/Availability";
import Pricing from "@/pages/guru/Pricing";
import ForumsModerationQueue from "@/components/dashboard/forums/ForumsModerationQueue";
import MyThreadsWithChips from "@/components/dashboard/forums/MyThreadsWithChips";
import TableCard from "@/components/dashboard/TableCard";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendCard from "@/components/dashboard/TrendCard";
import { useGuruMetrics } from "@/hooks/metrics/useGuruMetrics";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import BlogsMarkedList from "@/components/dashboard/blogs/BlogsMarkedList";

import { useAuth } from "@/contexts/AuthContext";

// Blog Reviews Component - combines Assigned, Approved, Rejected with chips
function BlogReviews() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'assigned' | 'approved' | 'rejected'>('assigned');
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setRows([]); return; }
      
      if (activeFilter === 'assigned') {
        // Use existing ModeratePosts logic for assigned items
        const { data } = await supabase.rpc('list_reviewer_queue', { p_limit: 100, p_offset: 0 });
        if (!cancelled) setRows((data as any) || []);
      } else if (activeFilter === 'approved') {
        const { data } = await supabase
          .from('blog_review_logs')
          .select('post_id, created_at, note, post:blog_posts(id,title,slug)')
          .eq('actor_id', user.id)
          .eq('action', 'approve')
          .order('created_at', { ascending: false })
          .limit(100);
        if (!cancelled) setRows((data as any) || []);
      } else if (activeFilter === 'rejected') {
        const { data } = await supabase
          .from('blog_review_logs')
          .select('post_id, created_at, note, post:blog_posts(id,title,slug)')
          .eq('actor_id', user.id)
          .eq('action', 'request_changes')
          .order('created_at', { ascending: false })
          .limit(100);
        if (!cancelled) setRows((data as any) || []);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, activeFilter]);

  const getColumns = () => {
    if (activeFilter === 'assigned') {
      return [
        { key: 'title', header: 'Title', render: (r: any) => r.title || '-' },
        { key: 'submitted_at', header: 'Submitted', render: (r: any) => new Date(r.submitted_at).toLocaleString() },
        { key: 'actions', header: 'Actions', render: (r: any) => <a className="underline" href={`/blogs/editor/${r.id}`}>Review</a> },
      ];
    } else {
      return [
        { key: 'title', header: 'Title', render: (r: any) => r.post?.title || '-' },
        { key: 'created_at', header: 'When', render: (r: any) => new Date(r.created_at).toLocaleString() },
        { key: 'note', header: 'Note', render: (r: any) => r.note || '-' },
      ];
    }
  };

  return (
    <div className="p-0">
      <div className="mb-4 text-sm text-muted-foreground px-6 pt-4">
        Edit and approve assigned blog posts.
      </div>
      
      <div className="flex gap-2 mb-6 px-6 pt-4">
        {[
          { id: 'assigned' as const, label: 'Assigned' },
          { id: 'approved' as const, label: 'Approved' },
          { id: 'rejected' as const, label: 'Rejected' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <div className="px-6">
        <TableCard
          title="Reviews"
          columns={getColumns()}
          rows={rows}
          emptyText="Nothing here yet."
        />
      </div>
    </div>
  );
}

// Exam Reviews Component - combines queue and history
function ExamReviews() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'assigned' | 'approved' | 'rejected'>('assigned');
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setRows([]); return; }
      
      if (activeFilter === 'assigned') {
        try {
          const { data, error } = await supabase.rpc("list_exam_reviewer_queue", { p_limit: 100, p_offset: 0 });
          if (!cancelled && !error) setRows((data as any) || []);
        } catch (e) { if (!cancelled) setRows([]); }
      } else {
        // For approved/rejected, would need to query review logs or similar tables
        // Using placeholder for now as this would need proper exam review logs
        if (!cancelled) setRows([]);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, activeFilter]);

  return (
    <div className="p-0">
      <div className="mb-4 text-sm text-muted-foreground px-6 pt-4">
        Review assigned questions and finalize decisions.
      </div>
      
      <div className="flex gap-2 mb-6 px-6 pt-4">
        {[
          { id: 'assigned' as const, label: 'Assigned' },
          { id: 'approved' as const, label: 'Approved' },
          { id: 'rejected' as const, label: 'Rejected' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <div className="px-6">
        <TableCard
          title="Review & Assignment"
          columns={[
            { key: 'created_at', header: 'When', render: (r: any) => new Date(r.created_at).toLocaleString() },
            { key: 'stem', header: 'Question', render: (r: any) => r.stem || '-' },
            { key: 'exam_type', header: 'Exam', render: (r: any) => r.exam_type || '-' },
          ]}
          rows={rows}
          emptyText="Nothing assigned yet."
        />
      </div>
    </div>
  );
}

// Remove unused components from old structure

// Remove unused components

function MyBlogStatusPanel({ filter }: { filter: 'draft' | 'in_review' }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setRows([]); return; }
      const orderCol = filter === 'in_review' ? 'submitted_at' : 'updated_at';
      const { data } = await supabase
        .from('blog_posts')
        .select('id,title,slug,updated_at,submitted_at')
        .eq('author_id', user.id)
        .eq('status', filter)
        .order(orderCol as any, { ascending: false })
        .limit(50);
      if (!cancelled) setRows((data as any) || []);
    })();
    return () => { cancelled = true; };
  }, [user?.id, filter]);

  return (
    <div className="p-4">
      <div className="mb-4 text-sm text-muted-foreground">
        {filter === 'draft' ? 'Write or continue your own posts.' : 'Posts awaiting review.'}
      </div>
      
      <div className="flex gap-2 mb-6 px-6 pt-4">
        <Button size="sm" variant="default" aria-pressed={true}>
          {filter === 'draft' ? 'Draft' : 'Submitted'}
        </Button>
      </div>

      <TableCard
        title={filter === 'draft' ? 'My Blogs' : 'Submitted'}
        columns={[
          { key: 'title', header: 'Title' },
          { key: 'updated_at', header: filter === 'draft' ? 'Updated' : 'Submitted', render: (r: any) => new Date(r.submitted_at || r.updated_at).toLocaleString() },
          { key: 'slug', header: 'Link', render: (r: any) => (r.slug ? <a className="underline" href={`/blogs/editor/${r.id}`}>Edit</a> : '-') },
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
    const { kpis, throughputSeries, engagement, feedbackSummary, isLoading } = useGuruMetrics();
    return (
      <div className="p-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard title="Active Assignments" value={kpis.myAssignedCount} isLoading={isLoading} icon={BookOpen} iconColor="text-orange-600" />
        <KpiCard title="Reviews Completed" value={kpis.myReviewsCompleted} isLoading={isLoading} icon={CheckCircle} iconColor="text-green-600" />
        <KpiCard title="Avg Turnaround" value={`${kpis.avgTurnaroundHrs}h`} isLoading={isLoading} icon={Clock} iconColor="text-blue-600" />
        <KpiCard title="Upcoming Consults" value={kpis.upcomingConsults} isLoading={isLoading} icon={Stethoscope} iconColor="text-purple-600" />
        
        {/* Engagement KPIs */}
        <KpiCard title="Total Views" value={engagement.views} isLoading={isLoading} icon={Eye} iconColor="text-blue-600" />
        <KpiCard title="Total Likes" value={engagement.likes} isLoading={isLoading} icon={ThumbsUp} iconColor="text-green-600" />
        <KpiCard title="Total Comments" value={engagement.comments} isLoading={isLoading} icon={MessageCircle} iconColor="text-purple-600" />
        <KpiCard title="Total Shares" value={engagement.shares} isLoading={isLoading} icon={Share2} iconColor="text-orange-600" />
        <KpiCard title="Feedback Reports" value={`${feedbackSummary.unresolved}/${feedbackSummary.total}`} helpText="unresolved/total" isLoading={isLoading} icon={Flag} iconColor="text-gray-600" />
        
        <div className="md:col-span-4">
          <TrendCard title="Review Throughput" series={throughputSeries} rangeLabel="Last 12 weeks" isLoading={isLoading} />
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
        { 
          id: "overview", 
          title: "Overview", 
          render: <div className="p-0"><AnalyticsPanel /></div> 
        },
        { 
          id: "reviews", 
          title: "Reviews", 
          description: "Edit and approve assigned blog posts.", 
          render: <BlogReviews /> 
        },
        { 
          id: "authored", 
          title: "Authored", 
          description: "Write or continue your own posts.", 
          render: <MyBlogStatusPanel filter="draft" />
        },
        { 
          id: "marked", 
          title: "Marked", 
          description: "Unresolved blog feedback from users.", 
          render: <div className="p-0"><BlogsMarkedList /></div> 
        },
      ],
    },
    {
      id: "exams",
      title: "Exams",
      icon: GraduationCap,
      tabs: [
        { 
          id: "overview", 
          title: "Overview", 
          render: <div className="p-0"><AnalyticsPanel /></div> 
        },
        { 
          id: "review-assignment", 
          title: "Review & Assignment", 
          description: "Review assigned questions and finalize decisions.", 
          render: <ExamReviews /> 
        },
        { 
          id: "my-submissions", 
          title: "My Submissions", 
          description: "Questions you wrote or edited.", 
          render: <div className="p-0"><MySubmittedPanel /></div> 
        },
      ],
    },
    {
      id: "consultations",
      title: "Consults",
      icon: Stethoscope,
      tabs: [
        { 
          id: "overview", 
          title: "Overview", 
          render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Your booking stats at a glance.</div><AnalyticsPanel /></div> 
        },
        { 
          id: "availability", 
          title: "Availability", 
          description: "Define your available slots.", 
          render: <div className="p-0"><Availability /></div> 
        },
        { 
          id: "pricing", 
          title: "Pricing", 
          description: "Set your hourly rate.", 
          render: <div className="p-0"><Pricing /></div> 
        },
        { 
          id: "bookings", 
          title: "Bookings", 
          description: "Your consultation schedule.", 
          render: <div className="p-0"><Bookings embedded={true} /></div> 
        },
      ],
    },
    {
      id: "forums",
      title: "Forums",
      icon: MessageSquare,
      tabs: [
        { 
          id: "overview", 
          title: "Overview", 
          description: "Incoming flags and trends.",
          render: <div className="p-0"><AnalyticsPanel /></div> 
        },
        { 
          id: "moderation", 
          title: "Moderation Queue", 
          description: "Review and resolve flagged posts.", 
          render: <div className="p-0"><ForumsModerationQueue isAdmin={false} /></div> 
        },
        { 
          id: "my-threads", 
          title: "My Threads", 
          description: "Your questions and answers.", 
          render: <div className="p-0"><MyThreadsWithChips /></div> 
        },
      ],
    },
  ];

  return <WorkspaceLayout title="Guru Workspace" sections={sections} defaultSectionId="blogs" />;
}
