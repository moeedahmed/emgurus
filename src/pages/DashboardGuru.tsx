import React, { useEffect } from "react";
import WorkspaceLayout, { WorkspaceSection } from "@/components/dashboard/WorkspaceLayout";
import { BookOpen, MessageSquare, Stethoscope, GraduationCap } from "lucide-react";
import Blogs from "@/pages/Blogs";
import ReviewedQuestionBank from "@/pages/exams/ReviewedQuestionBank";
import AiPracticeConfig from "@/pages/exams/AiPracticeConfig";
import Consultations from "@/pages/Consultations";
import Forums from "@/pages/Forums";
import ModeratePosts from "@/pages/admin/ModeratePosts";

// Small wrappers that preset reviewer/admin tabs via URL params without leaving the route
function ReviewerPending() { useEffect(() => { const p = new URLSearchParams(window.location.search); p.set('view','reviewer'); p.set('tab','pending'); history.replaceState(null,'',`${location.pathname}?${p.toString()}${location.hash}`); }, []); return <ModeratePosts />; }
function ReviewerCompleted() { useEffect(() => { const p = new URLSearchParams(window.location.search); p.set('view','reviewer'); p.set('tab','completed'); history.replaceState(null,'',`${location.pathname}?${p.toString()}${location.hash}`); }, []); return <ModeratePosts />; }

export default function DashboardGuru() {
  useEffect(() => { document.title = "Guru Workspace | EMGurus"; }, []);

  const sections: WorkspaceSection[] = [
    {
      id: "blogs",
      title: "Blogs",
      icon: BookOpen,
      tabs: [
        { id: "pending", title: "Review Pending", render: <div className="p-4"><ReviewerPending /></div> },
        { id: "completed", title: "Review Completed", render: <div className="p-4"><ReviewerCompleted /></div> },
        { id: "my", title: "My Blogs", render: <div className="p-0"><Blogs embedded /></div> },
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
        { id: "mentors", title: "Mentors", render: <div className="p-0"><Consultations embedded /></div> },
      ],
    },
    {
      id: "forums",
      title: "Forums",
      icon: MessageSquare,
      tabs: [
        { id: "all", title: "All Threads", render: <div className="p-0"><Forums embedded /></div> },
      ],
    },
  ];

  return <WorkspaceLayout title="Guru Workspace" sections={sections} defaultSectionId="blogs" />;
}
