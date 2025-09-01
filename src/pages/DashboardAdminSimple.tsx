import React, { useEffect, useState } from "react";
import WorkspaceLayout, { WorkspaceSection } from "@/components/dashboard/WorkspaceLayout";
import { BookOpen, MessageSquare, GraduationCap, BarChart3, UsersRound, Settings, Stethoscope } from "lucide-react";
import AdminAnalyticsPanel from "@/components/admin/AdminAnalyticsPanel";
import KpiCard from "@/components/dashboard/KpiCard";
import { supabase } from "@/integrations/supabase/client";

export default function DashboardAdmin() {
  useEffect(() => { document.title = "Admin Workspace | EM Gurus"; }, []);

  const [examKpis, setExamKpis] = useState({ approved: 0, under_review: 0, draft: 0, rejected: 0, flaggedOpen: 0 });
  
  useEffect(() => {
    (async () => {
      try {
        const [{ count: appr }, { count: und }, { count: dr }, { count: rej }, { count: flg }] = await Promise.all([
          (supabase as any).from('review_exam_questions').select('id', { count: 'exact', head: true }).eq('status','approved'),
          (supabase as any).from('review_exam_questions').select('id', { count: 'exact', head: true }).eq('status','under_review'),
          (supabase as any).from('review_exam_questions').select('id', { count: 'exact', head: true }).eq('status','draft'),
          (supabase as any).from('review_exam_questions').select('id', { count: 'exact', head: true }).eq('status','rejected'),
          (supabase as any).from('exam_question_flags').select('id', { count: 'exact', head: true }).eq('status','open'),
        ]);
        setExamKpis({ approved: appr ?? 0, under_review: und ?? 0, draft: dr ?? 0, rejected: rej ?? 0, flaggedOpen: flg ?? 0 });
      } catch {
        setExamKpis({ approved: 0, under_review: 0, draft: 0, rejected: 0, flaggedOpen: 0 });
      }
    })();
  }, []);

  const sections: WorkspaceSection[] = [
    {
      id: "blogs",
      title: "Blogs",
      icon: BookOpen,
      tabs: [
        { 
          id: "overview", 
          title: "Overview", 
          description: "Blog moderation and publishing at a glance.",
          render: <AdminAnalyticsPanel /> 
        },
        { 
          id: "queue", 
          title: "Queue", 
          description: "Coming soon - Triage incoming posts and assign to reviewers.", 
          render: <div className="p-4">Queue functionality will be restored soon.</div>
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
          render: (
            <div className="p-4 grid gap-4 md:grid-cols-5">
              <KpiCard title="Generated (7d)" value="0" isLoading={false} />
              <KpiCard title="In Review" value={examKpis.under_review} isLoading={false} />
              <KpiCard title="Published" value={examKpis.approved} isLoading={false} />
              <KpiCard title="Quality Flags Open" value={examKpis.flaggedOpen} isLoading={false} />
              <div className="text-sm text-muted-foreground">Coverage chart coming soon</div>
            </div>
          )
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
          description: "Forum moderation overview.",
          render: <div className="p-4">Forum management coming soon.</div>
        },
      ],
    },
    {
      id: "consultations",
      title: "Consultations",
      icon: Stethoscope,
      tabs: [
        { 
          id: "overview", 
          title: "Overview", 
          description: "Consultation platform management.",
          render: <div className="p-4">Consultations management coming soon.</div>
        },
      ],
    },
    {
      id: "users",
      title: "Users",
      icon: UsersRound,
      tabs: [
        { 
          id: "directory", 
          title: "Directory", 
          description: "User management and guru approvals.",
          render: <div className="p-4">User management coming soon.</div>
        },
      ],
    },
    {
      id: "experimental",
      title: "Experimental",
      icon: Settings,
      tabs: [
        { 
          id: "database", 
          title: "Database", 
          description: "Direct database management (dev/admin only).",
          render: <div className="p-4">Database management coming soon.</div>
        },
      ],
    },
  ];

  return <WorkspaceLayout title="Admin Workspace" sections={sections} defaultSectionId="blogs" />;
}