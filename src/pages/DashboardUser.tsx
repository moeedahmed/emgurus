import React, { useEffect } from "react";
import WorkspaceLayout, { WorkspaceSection } from "@/components/dashboard/WorkspaceLayout";
import { BookOpen, Stethoscope, GraduationCap, MessagesSquare } from "lucide-react";
import Bookings from "@/pages/Bookings";
import ExamsOverview from "@/components/dashboard/exams/ExamsOverview";
import ExamsAttempts from "@/components/dashboard/exams/ExamsAttempts";
import ExamsProgressMatrix from "@/components/dashboard/exams/ExamsProgressMatrix";
import ExamsFeedbackList from "@/components/dashboard/exams/ExamsFeedbackList";
import BlogsOverview from "@/components/dashboard/blogs/BlogsOverview";
import BlogsFeedbackList from "@/components/dashboard/blogs/BlogsFeedbackList";
import ConsultationsOverview from "@/components/dashboard/consultations/ConsultationsOverview";
import ForumsOverview from "@/components/dashboard/forums/ForumsOverview";
import AuthoredBlogTabs from "@/components/dashboard/blogs/AuthoredBlogTabs";
import MyThreadsWithChips from "@/components/dashboard/forums/MyThreadsWithChips";

export default function DashboardUser() {
  useEffect(() => { document.title = "Learner Workspace | EMGurus"; }, []);

  const sections: WorkspaceSection[] = [
    {
      id: "blogs",
      title: "Blogs",
      icon: BookOpen,
      tabs: [
        { id: "overview", title: "Overview", render: <div className="p-0"><BlogsOverview /></div> },
        { id: "authored", title: "Authored", description: "Your authored blog posts across all stages.", render: <AuthoredBlogTabs /> },
        { id: "generator", title: "Generator", description: "AI-powered blog draft generation.", render: <div className="p-4"><iframe src="/tools/generate-blog-draft" className="w-full h-[800px] border rounded-lg" title="Blog Generator" /></div> },
      ],
    },
    {
      id: "exams",
      title: "Exams",
      icon: GraduationCap,
      tabs: [
        { id: "overview", title: "Overview", render: <div className="p-0"><ExamsOverview /></div> },
        { id: "attempts", title: "Attempts", description: "Your recent practice and exam sessions.", render: <div className="p-0"><ExamsAttempts /></div> },
        { id: "progress", title: "Progress", description: "Where you're strong or need work.", render: <div className="p-0"><ExamsProgressMatrix /></div> },
        { id: "feedback", title: "Feedback", description: "Questions you flagged and your notes.", render: <div className="p-0"><ExamsFeedbackList /></div> },
        { id: "generator", title: "Generator", description: "AI-powered exam question generation.", render: <div className="p-4"><iframe src="/tools/generate-exam-question" className="w-full h-[800px] border rounded-lg" title="Exam Generator" /></div> },
      ],
    },
    {
      id: "consultations",
      title: "Consultations",
      icon: Stethoscope,
      tabs: [
        { id: "overview", title: "Overview", render: <div className="p-0"><ConsultationsOverview /></div> },
        { id: "bookings", title: "Bookings", description: "Your consultation history and upcoming sessions.", render: <div className="p-4"><Bookings embedded={true} /></div> },
      ],
    },
    {
      id: "forums",
      title: "Forums",
      icon: MessagesSquare,
      tabs: [
        { id: "overview", title: "Overview", description: "Your forum activity at a glance.", render: <div className="p-0"><ForumsOverview /></div> },
        { id: "my-threads", title: "My Threads", description: "Your questions and answers.", render: <div className="p-0"><MyThreadsWithChips /></div> },
      ],
    },
  ];

  return <WorkspaceLayout title="User Workspace" sections={sections} defaultSectionId="blogs" />;
}