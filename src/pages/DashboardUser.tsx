import React, { useEffect } from "react";
import WorkspaceLayout, { WorkspaceSection } from "@/components/dashboard/WorkspaceLayout";
import { BookOpen, MessageSquare, Stethoscope, GraduationCap } from "lucide-react";
import Blogs from "@/pages/Blogs";
import ReviewedQuestionBank from "@/pages/exams/ReviewedQuestionBank";
import AiPracticeConfig from "@/pages/exams/AiPracticeConfig";
import Consultations from "@/pages/Consultations";
import Forums from "@/pages/Forums";
import Bookings from "@/pages/Bookings";

export default function DashboardUser() {
  useEffect(() => { document.title = "Learner Workspace | EMGurus"; }, []);

  const sections: WorkspaceSection[] = [
    {
      id: "blogs",
      title: "Blogs",
      icon: BookOpen,
      tabs: [
        { id: "browse", title: "Browse", render: <div className="p-0"><Blogs embedded /></div> },
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
        { id: "bookings", title: "My Bookings", render: <div className="p-4"><Bookings /></div> },
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

  return <WorkspaceLayout title="User Workspace" sections={sections} defaultSectionId="blogs" />;
}
