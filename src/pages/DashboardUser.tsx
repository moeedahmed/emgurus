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
import MyBlogs from "@/components/dashboard/blogs/MyBlogs";
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
        { id: "drafts", title: "Drafts", description: "Private posts you're still working on.", render: <MyBlogs filter="draft" /> },
        { id: "submitted", title: "Submitted", description: "Posts awaiting review by the team.", render: <MyBlogs filter="in_review" /> },
        { id: "published", title: "Published", description: "Your posts that are live on EMGurus.", render: <MyBlogs filter="published" /> },
        { id: "rejected", title: "Rejected", description: "Changes requested. Edit and resubmit when ready.", render: <MyBlogs filter="rejected" /> },
        { id: "feedback", title: "Feedback", description: "Blog feedback you've submitted.", render: <div className="p-0"><BlogsFeedbackList /></div> },
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
      title: "Consults",
      icon: Stethoscope,
      tabs: [
        { id: "overview", title: "Overview", render: <div className="p-0"><ConsultationsOverview /></div> },
        { id: "bookings", title: "Bookings", description: "Your consult history and upcoming sessions.", render: <div className="p-4"><Bookings embedded={true} /></div> },
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