import React, { useEffect } from "react";
import WorkspaceLayout, { WorkspaceSection } from "@/components/dashboard/WorkspaceLayout";
import { BookOpen, Stethoscope, GraduationCap, MessagesSquare } from "lucide-react";
import Bookings from "@/pages/Bookings";
import ExamsOverview from "@/components/dashboard/exams/ExamsOverview";
import ExamsAttempts from "@/components/dashboard/exams/ExamsAttempts";
import ExamsProgressMatrix from "@/components/dashboard/exams/ExamsProgressMatrix";
import ExamsFeedbackList from "@/components/dashboard/exams/ExamsFeedbackList";
import BlogsOverview from "@/components/dashboard/blogs/BlogsOverview";
import ConsultationsOverview from "@/components/dashboard/consultations/ConsultationsOverview";
import ForumsOverview from "@/components/dashboard/forums/ForumsOverview";
import MyBlogs from "@/components/dashboard/blogs/MyBlogs";
import MyThreads from "@/components/dashboard/forums/MyThreads";

export default function DashboardUser() {
  useEffect(() => { document.title = "Learner Workspace | EMGurus"; }, []);

  const sections: WorkspaceSection[] = [
    {
      id: "blogs",
      title: "Blogs",
      icon: BookOpen,
      tabs: [
        { id: "overview", title: "Overview", render: <div className="p-0"><BlogsOverview /></div> },
        { id: "my-blogs", title: "My Blogs", render: <MyBlogs /> },
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
        { id: "overview", title: "Overview", render: <div className="p-0"><ForumsOverview /></div> },
        { id: "my-threads", title: "My Threads", render: <div className="p-0"><MyThreads /></div> },
      ],
    },
  ];

  return <WorkspaceLayout title="User Workspace" sections={sections} defaultSectionId="blogs" />;
}