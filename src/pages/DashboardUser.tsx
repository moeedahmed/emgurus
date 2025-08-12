import React, { useEffect, useState } from "react";
import WorkspaceLayout, { WorkspaceSection } from "@/components/dashboard/WorkspaceLayout";
import { BookOpen, Stethoscope, GraduationCap, BarChart3 } from "lucide-react";
import ReviewedQuestionBank from "@/pages/exams/ReviewedQuestionBank";
import AiPracticeConfig from "@/pages/exams/AiPracticeConfig";
import Bookings from "@/pages/Bookings";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendCard from "@/components/dashboard/TrendCard";
import { useUserMetrics } from "@/hooks/metrics/useUserMetrics";
import { submitPost } from "@/lib/blogsApi";

export default function DashboardUser() {
  useEffect(() => { document.title = "Learner Workspace | EMGurus"; }, []);

  const MyPostsPanel: React.FC<{ status: 'draft' | 'in_review' | 'published' | 'rejected' }> = ({ status }) => {
    const { user } = useAuth();
    const [rows, setRows] = useState<any[]>([]);
    useEffect(() => {
      let cancelled = false;
      (async () => {
        if (!user) { setRows([]); return; }
        if (status === 'rejected') {
          // Show drafts that have review notes (i.e., rejected/requested changes) for resubmission
          const { data } = await supabase
            .from('blog_posts')
            .select('id,title,slug,updated_at,review_notes')
            .eq('author_id', user.id)
            .eq('status', 'draft')
            .not('review_notes', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(50);
          if (!cancelled) setRows((data as any) || []);
          return;
        }
        const orderCol = status === 'published' ? 'published_at' : (status === 'in_review' ? 'submitted_at' : 'updated_at');
        const { data } = await supabase
          .from('blog_posts')
          .select('id,title,slug,updated_at,submitted_at,published_at')
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
          title={status === 'draft' ? 'Drafts' : status === 'in_review' ? 'Submitted' : status === 'published' ? 'Published' : 'Rejected'}
          columns={
            status === 'rejected'
              ? [
                  { key: 'title', header: 'Title' },
                  { key: 'updated_at', header: 'Updated', render: (r: any) => new Date(r.updated_at).toLocaleString() },
                  { key: 'review_notes', header: 'Note', render: (r: any) => (r.review_notes || '').split('\n').slice(-1)[0] || '-' },
                  { key: 'actions', header: 'Actions', render: (r: any) => (
                    <div className="flex gap-2">
                      <a className="underline" href={`/blogs/editor/${r.id}`}>Edit</a>
                      <button
                        className="underline"
                        onClick={async () => {
                          try {
                            await submitPost(r.id);
                            // Notify admins (in-app + email if configured)
                            const title = r.title || 'A blog';
                            const body = `<p>Blog resubmitted: <strong>${title}</strong></p>`;
                            try {
                              const { notifyAdmins } = await import("@/lib/notifications");
                              await notifyAdmins({
                                subject: "Blog resubmitted",
                                html: body,
                                inApp: { type: 'blog_resubmitted', title: 'Blog resubmitted', body: `Resubmitted: ${title}`, data: { post_id: r.id } },
                              });
                            } catch (e) { console.warn('notifyAdmins failed', e); }
                            // Optimistic remove
                            setRows(prev => prev.filter(x => x.id !== r.id));
                          } catch (e: any) {}
                        }}
                      >Resubmit</button>
                    </div>
                  ) },
                ]
              : [
                  { key: 'title', header: 'Title' },
                  { key: 'updated_at', header: 'Updated', render: (r: any) => new Date(r.published_at || r.submitted_at || r.updated_at).toLocaleString() },
                  { key: 'slug', header: 'Link', render: (r: any) => (r.slug ? <a className="underline" href={`/blogs/${r.slug}`}>Open</a> : '-') },
                ]
          }
          rows={rows}
          emptyText="Nothing here yet."
        />
      </div>
    );
  };

  const AnalyticsPanel: React.FC = () => {
    const { kpis, activitySeries, drafts, isLoading } = useUserMetrics();
    return (
      <div className="p-4 grid gap-4 md:grid-cols-4">
        <KpiCard title="Attempts (7d)" value={kpis.attempts7d} isLoading={isLoading} />
        <KpiCard title="Accuracy (7d)" value={`${kpis.accuracy7d}%`} isLoading={isLoading} />
        <KpiCard title="SRS Due" value={kpis.dueSRCount} isLoading={isLoading} />
        <KpiCard title="Blog Reads (7d)" value={kpis.blogReads7d} isLoading={isLoading} />
        <div className="md:col-span-4">
          <TrendCard title="Activity" series={activitySeries} rangeLabel="Last 7 days" isLoading={isLoading} />
        </div>
        <div className="md:col-span-4">
          <TableCard
            title="Recent Drafts"
            columns={[
              { key: 'title', header: 'Title' },
              { key: 'updated_at', header: 'Updated', render: (r: any) => new Date(r.updated_at).toLocaleString() },
            ]}
            rows={drafts as any}
            isLoading={isLoading}
            emptyText="No drafts yet."
          />
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
        { id: "drafts", title: "Drafts", render: <MyPostsPanel status="draft" /> },
        { id: "submitted", title: "Submitted", render: <MyPostsPanel status="in_review" /> },
        { id: "published", title: "Published", render: <MyPostsPanel status="published" /> },
        { id: "rejected", title: "Rejected", render: <MyPostsPanel status="rejected" /> },
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
      id: "consultations",
      title: "Consultations",
      icon: Stethoscope,
      tabs: [
        { id: "bookings", title: "My Bookings", render: <div className="p-4"><Bookings /></div> },
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

  return <WorkspaceLayout title="User Workspace" sections={sections} defaultSectionId="blogs" />;
}

